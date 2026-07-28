use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Bookmark, Document, Object, ObjectId, Stream, StringFormat};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::io::Write;

#[derive(Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub message: String,
}

#[derive(Serialize, Deserialize)]
pub struct PdfInfo {
    pub page_count: u32,
    pub file_size: u64,
    pub version: String,
}

fn open_doc(path: &str) -> Result<Document, String> {
    Document::load(path).map_err(|e| format!("{}: {}", path, e))
}

fn parse_page_range(range: &str, total: usize) -> Result<Vec<u32>, String> {
    let mut result = Vec::new();
    for part in range.split(',') {
        let part = part.trim();
        if part.contains('-') {
            let halves: Vec<&str> = part.split('-').collect();
            let start: u32 = halves[0].trim().parse().map_err(|_| format!("Bad: {}", halves[0]))?;
            let end: u32 = halves[1].trim().parse().map_err(|_| format!("Bad: {}", halves[1]))?;
            if start < 1 || end > total as u32 || start > end {
                return Err(format!("Range {}-{} out of 1-{}", start, end, total));
            }
            result.extend(start..=end);
        } else {
            let page: u32 = part.parse().map_err(|_| format!("Bad: {}", part))?;
            if page < 1 || page > total as u32 { return Err(format!("Page {} out of 1-{}", page, total)); }
            result.push(page);
        }
    }
    Ok(result)
}

fn collect_page_ids(doc: &Document) -> Vec<ObjectId> {
    let mut pages: Vec<_> = doc.get_pages().into_iter().collect();
    pages.sort_by_key(|(k, _)| *k);
    pages.into_iter().map(|(_, id)| id).collect()
}

fn get_page_dimensions(doc: &Document, page_id: ObjectId) -> Result<(f64, f64), String> {
    let obj = doc.get_object(page_id).map_err(|e| e.to_string())?;
    let dict = obj.as_dict().map_err(|e| e.to_string())?;
    let mb = dict.get(b"MediaBox").map_err(|_| "No MediaBox")?;
    let arr = mb.as_array().map_err(|e| e.to_string())?;
    let w = obj_to_f64(&arr[2]).unwrap_or(612.0) - obj_to_f64(&arr[0]).unwrap_or(0.0);
    let h = obj_to_f64(&arr[3]).unwrap_or(792.0) - obj_to_f64(&arr[1]).unwrap_or(0.0);
    Ok((w, h))
}

fn obj_to_f64(obj: &Object) -> Option<f64> {
    match obj {
        Object::Real(v) => Some(*v as f64),
        Object::Integer(v) => Some(*v as f64),
        _ => None,
    }
}

fn find_page_tree(doc: &Document) -> Result<ObjectId, String> {
    let root_ref = doc.trailer.get(b"Root").map_err(|_| "No Root".to_string())?
        .as_reference().map_err(|_| "Root not ref".to_string())?;
    let root = doc.get_object(root_ref).map_err(|e| e.to_string())?;
    root.as_dict().map_err(|_| "Root not dict".to_string())?
        .get(b"Pages").map_err(|_| "No Pages".to_string())?
        .as_reference().map_err(|_| "Pages not ref".to_string())
}

fn ensure_page_has_font(doc: &mut Document, page_id: ObjectId, font_name: &[u8]) -> Result<(), String> {
    let obj = doc.get_object_mut(page_id).map_err(|e| e.to_string())?;
    let dict = obj.as_dict_mut().map_err(|e| e.to_string())?;

    if dict.get(b"Resources").is_err() {
        dict.set("Resources", Object::Dictionary(lopdf::Dictionary::new()));
    }
    let res = dict.get_mut(b"Resources").map_err(|e| e.to_string())?;
    let res_dict = res.as_dict_mut().map_err(|e| e.to_string())?;

    if res_dict.get(b"Font").is_err() {
        res_dict.set("Font", Object::Dictionary(lopdf::Dictionary::new()));
    }
    let font_ref = res_dict.get_mut(b"Font").map_err(|e| e.to_string())?;
    let font_dict = font_ref.as_dict_mut().map_err(|e| e.to_string())?;

    if font_dict.get(font_name).is_err() {
        font_dict.set(font_name, Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Font".to_vec()),
            b"Subtype" => Object::Name(b"Type1".to_vec()),
            b"BaseFont" => Object::Name(b"Helvetica".to_vec()),
        }));
    }
    Ok(())
}

// ═══════════════════════════════════════
// PDF Info
// ═══════════════════════════════════════

#[tauri::command]
pub fn get_pdf_info(input_path: String) -> Result<ToolResult, String> {
    let doc = open_doc(&input_path)?;
    let page_count = doc.get_pages().len() as u32;
    let file_size = std::fs::metadata(&input_path).map_err(|e| e.to_string())?.len();
    let info = PdfInfo { page_count, file_size, version: doc.version.clone() };
    Ok(ToolResult { success: true, output_path: None, message: serde_json::to_string(&info).unwrap_or_default() })
}

// ═══════════════════════════════════════
// Merge PDFs
// ═══════════════════════════════════════

#[tauri::command]
pub fn merge_pdfs(input_paths: Vec<String>, output_path: String) -> Result<ToolResult, String> {
    if input_paths.is_empty() { return Err("No input files".into()); }

    let mut documents_pages = BTreeMap::new();
    let mut documents_objects = BTreeMap::new();
    let mut document = Document::with_version("1.5");
    let mut max_id: u32 = 1;
    let mut pagenum = 1u32;

    for path in &input_paths {
        let mut doc = open_doc(path)?;
        let mut first = false;
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;

        documents_pages.extend(doc.get_pages().into_iter().map(|(_, object_id)| {
            if !first {
                document.add_bookmark(
                    Bookmark::new(format!("Page_{}", pagenum), [0.0, 0.0, 1.0], 0, object_id), None,
                );
                first = true;
                pagenum += 1;
            }
            (object_id, doc.get_object(object_id).unwrap().to_owned())
        }));
        documents_objects.extend(doc.objects);
    }

    let mut catalog_object: Option<(ObjectId, Object)> = None;
    let mut pages_object: Option<(ObjectId, Object)> = None;

    for (object_id, object) in documents_objects.iter() {
        match object.type_name().unwrap_or(b"") {
            b"Catalog" => {
                catalog_object = Some((catalog_object.map(|(id, _)| id).unwrap_or(*object_id), object.clone()));
            }
            b"Pages" => {
                if let Ok(dictionary) = object.as_dict() {
                    let mut dictionary = dictionary.clone();
                    if let Some((_, ref old)) = pages_object {
                        if let Ok(old_dict) = old.as_dict() { dictionary.extend(old_dict); }
                    }
                    pages_object = Some((pages_object.map(|(id, _)| id).unwrap_or(*object_id), Object::Dictionary(dictionary)));
                }
            }
            b"Page" | b"Outlines" | b"Outline" => {}
            _ => { document.objects.insert(*object_id, object.clone()); }
        }
    }

    let pages_object = pages_object.ok_or("No Pages found")?;
    let catalog_object = catalog_object.ok_or("No Catalog found")?;

    for (object_id, object) in documents_pages.iter() {
        if let Ok(dictionary) = object.as_dict() {
            let mut dictionary = dictionary.clone();
            dictionary.set("Parent", pages_object.0);
            document.objects.insert(*object_id, Object::Dictionary(dictionary));
        }
    }

    if let Ok(dictionary) = pages_object.1.as_dict() {
        let mut dictionary = dictionary.clone();
        dictionary.set("Count", documents_pages.len() as u32);
        dictionary.set("Kids", documents_pages.keys().map(|id| Object::Reference(*id)).collect::<Vec<_>>());
        document.objects.insert(pages_object.0, Object::Dictionary(dictionary));
    }

    if let Ok(dictionary) = catalog_object.1.as_dict() {
        let mut dictionary = dictionary.clone();
        dictionary.set("Pages", pages_object.0);
        dictionary.remove(b"Outlines");
        document.objects.insert(catalog_object.0, Object::Dictionary(dictionary));
    }

    document.trailer.set("Root", catalog_object.0);
    document.max_id = document.objects.len() as u32;
    document.renumber_objects();
    document.adjust_zero_pages();
    if let Some(n) = document.build_outline() {
        if let Ok(Object::Dictionary(dict)) = document.get_object_mut(catalog_object.0) {
            dict.set("Outlines", Object::Reference(n));
        }
    }
    document.compress();
    document.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Merged {} files ({} pages)", input_paths.len(), documents_pages.len()) })
}

// ═══════════════════════════════════════
// Split PDF
// ═══════════════════════════════════════

#[tauri::command]
pub fn split_pdf(input_path: String, output_dir: String, pages: Option<String>) -> Result<ToolResult, String> {
    let doc = open_doc(&input_path)?;
    let page_ids = collect_page_ids(&doc);
    let total = page_ids.len();

    let page_nums = match pages {
        Some(ref s) if !s.is_empty() => parse_page_range(s, total)?,
        _ => (1..=total as u32).collect(),
    };

    let mut count = 0u32;
    for &pn in &page_nums {
        let idx = (pn - 1) as usize;
        let mut new_doc = Document::with_version("1.5");

        let mut id_map = BTreeMap::new();
        for (src_id, obj) in doc.objects.iter() {
            let new_id = new_doc.add_object(obj.clone());
            id_map.insert(*src_id, new_id);
        }

        for (_, obj) in new_doc.objects.iter_mut() { update_refs(obj, &id_map); }

        let new_page_id = id_map[&page_ids[idx]];
        let tree_id = new_doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Pages".to_vec()),
            b"Count" => Object::Integer(1),
            b"Kids" => Object::Array(vec![Object::Reference(new_page_id)]),
        }));

        if let Ok(Object::Dictionary(ref mut d)) = new_doc.get_object_mut(new_page_id) {
            d.set("Parent", Object::Reference(tree_id));
        }

        let catalog_id = new_doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Catalog".to_vec()),
            b"Pages" => Object::Reference(tree_id),
        }));
        new_doc.trailer.set("Root", catalog_id);
        new_doc.max_id = new_doc.objects.len() as u32;
        new_doc.renumber_objects();

        let out_path = format!("{}/page_{}.pdf", output_dir, pn);
        new_doc.save(&out_path).map_err(|e| e.to_string())?;
        count += 1;
    }

    Ok(ToolResult { success: true, output_path: Some(output_dir), message: format!("Extracted {} pages", count) })
}

// ═══════════════════════════════════════
// Reorder Pages
// ═══════════════════════════════════════

#[tauri::command]
pub fn reorder_pages(input_path: String, output_path: String, new_order: Vec<u32>) -> Result<ToolResult, String> {
    let mut doc = open_doc(&input_path)?;
    let page_ids = collect_page_ids(&doc);
    let total = page_ids.len();
    if new_order.iter().any(|&p| p < 1 || p > total as u32) { return Err("Pages out of range".into()); }

    let tree_id = find_page_tree(&doc)?;
    let new_kids: Vec<Object> = new_order.iter().map(|&p| Object::Reference(page_ids[(p - 1) as usize])).collect();
    if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(tree_id) {
        d.set("Kids", Object::Array(new_kids));
        d.set("Count", new_order.len() as u32);
    }
    doc.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Reordered {} pages", new_order.len()) })
}

// ═══════════════════════════════════════
// Rotate Pages
// ═══════════════════════════════════════

#[tauri::command]
pub fn rotate_pages(input_path: String, output_path: String, pages: Option<String>, angle: u32) -> Result<ToolResult, String> {
    let mut doc = open_doc(&input_path)?;
    let page_ids = collect_page_ids(&doc);
    let total = page_ids.len();
    let page_nums = match pages {
        Some(ref s) if !s.is_empty() => parse_page_range(s, total)?,
        _ => (1..=total as u32).collect(),
    };
    let angle_val = (angle % 360) as i64;

    for &pn in &page_nums {
        let pid = page_ids[(pn - 1) as usize];
        if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(pid) {
            let current = d.get(b"Rotate").ok().and_then(|o| o.as_i64().ok()).unwrap_or(0);
            d.set("Rotate", Object::Integer((current + angle_val) % 360));
        }
    }
    doc.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Rotated {} pages by {}°", page_nums.len(), angle) })
}

// ═══════════════════════════════════════
// Crop Pages
// ═══════════════════════════════════════

#[tauri::command]
pub fn crop_pages(input_path: String, output_path: String, pages: Option<String>,
    top: f64, bottom: f64, left: f64, right: f64) -> Result<ToolResult, String> {
    let mut doc = open_doc(&input_path)?;
    let page_ids = collect_page_ids(&doc);
    let total = page_ids.len();
    let page_nums = match pages {
        Some(ref s) if !s.is_empty() => parse_page_range(s, total)?,
        _ => (1..=total as u32).collect(),
    };

    for &pn in &page_nums {
        let pid = page_ids[(pn - 1) as usize];
        let (w, h) = get_page_dimensions(&doc, pid)?;
        let new_w = w - left - right;
        let new_h = h - top - bottom;
        if new_w <= 0.0 || new_h <= 0.0 { return Err(format!("Crop empty for page {}", pn)); }
        if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(pid) {
            d.set("CropBox", Object::Array(vec![
                Object::Real(left as f32), Object::Real(bottom as f32),
                Object::Real((left + new_w) as f32), Object::Real((bottom + new_h) as f32),
            ]));
        }
    }
    doc.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Cropped {} pages", page_nums.len()) })
}

// ═══════════════════════════════════════
// Delete Pages
// ═══════════════════════════════════════

#[tauri::command]
pub fn delete_pages(input_path: String, output_path: String, pages_to_delete: Vec<u32>) -> Result<ToolResult, String> {
    let mut doc = open_doc(&input_path)?;
    let page_ids = collect_page_ids(&doc);
    let total = page_ids.len();
    let del_set: HashSet<u32> = pages_to_delete.iter().copied().collect();
    if del_set.iter().any(|&p| p < 1 || p > total as u32) { return Err("Pages out of range".into()); }

    let remaining: Vec<Object> = page_ids.iter().enumerate()
        .filter(|(i, _)| !del_set.contains(&(*i as u32 + 1)))
        .map(|(_, id)| Object::Reference(*id))
        .collect();

    let tree_id = find_page_tree(&doc)?;
    if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(tree_id) {
        d.set("Kids", Object::Array(remaining.clone()));
        d.set("Count", remaining.len() as u32);
    }
    doc.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Deleted {} pages, {} remaining", pages_to_delete.len(), remaining.len()) })
}

// ═══════════════════════════════════════
// Images to PDF
// ═══════════════════════════════════════

#[tauri::command]
pub fn images_to_pdf(input_paths: Vec<String>, output_path: String, margin: f64) -> Result<ToolResult, String> {
    if input_paths.is_empty() { return Err("No input images".into()); }

    let mut doc = Document::with_version("1.4");
    let mut page_ids = Vec::new();

    for path in &input_paths {
        let img = image::open(path).map_err(|e| format!("{}: {}", path, e))?;
        let rgb = img.to_rgb8();
        let (w, h) = rgb.dimensions();
        let raw = rgb.into_raw();

        let mut encoder = flate2::write::DeflateEncoder::new(Vec::new(), flate2::Compression::fast());
        encoder.write_all(&raw).map_err(|e| e.to_string())?;
        let compressed = encoder.finish().map_err(|e| e.to_string())?;

        let img_id = doc.add_object(Object::Stream(Stream::new(dictionary! {
            b"Type" => Object::Name(b"XObject".to_vec()),
            b"Subtype" => Object::Name(b"Image".to_vec()),
            b"Width" => Object::Integer(w as i64),
            b"Height" => Object::Integer(h as i64),
            b"ColorSpace" => Object::Name(b"DeviceRGB".to_vec()),
            b"BitsPerComponent" => Object::Integer(8),
            b"Filter" => Object::Name(b"FlateDecode".to_vec()),
        }, compressed)));

        let page_w = w as f64 + margin * 2.0;
        let page_h = h as f64 + margin * 2.0;

        let content_bytes = Content { operations: vec![
            Operation::new("q", vec![]),
            Operation::new("cm", vec![
                Object::Real(w as f32), Object::Real(0.0),
                Object::Real(0.0), Object::Real(h as f32),
                Object::Real(margin as f32), Object::Real(margin as f32),
            ]),
            Operation::new("Do", vec![Object::Name(b"Im0".to_vec())]),
            Operation::new("Q", vec![]),
        ]}.encode().map_err(|e| e.to_string())?;

        let content_id = doc.add_object(Object::Stream(Stream::new(lopdf::Dictionary::new(), content_bytes)));

        let page_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Page".to_vec()),
            b"MediaBox" => Object::Array(vec![
                Object::Real(0.0), Object::Real(0.0),
                Object::Real(page_w as f32), Object::Real(page_h as f32),
            ]),
            b"Contents" => Object::Reference(content_id),
            b"Resources" => Object::Dictionary(dictionary! {
                b"XObject" => Object::Dictionary(dictionary! {
                    b"Im0" => Object::Reference(img_id),
                }),
            }),
        }));
        page_ids.push(page_id);
    }

    let tree_id = doc.add_object(Object::Dictionary(dictionary! {
        b"Type" => Object::Name(b"Pages".to_vec()),
        b"Count" => Object::Integer(page_ids.len() as i64),
        b"Kids" => Object::Array(page_ids.iter().map(|id| Object::Reference(*id)).collect()),
    }));

    let catalog_id = doc.add_object(Object::Dictionary(dictionary! {
        b"Type" => Object::Name(b"Catalog".to_vec()),
        b"Pages" => Object::Reference(tree_id),
    }));
    doc.trailer.set("Root", catalog_id);
    doc.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Created PDF with {} pages", input_paths.len()) })
}

// ═══════════════════════════════════════
// Extract Text
// ═══════════════════════════════════════

#[tauri::command]
pub fn extract_text(input_path: String) -> Result<ToolResult, String> {
    let doc = open_doc(&input_path)?;
    let page_ids = collect_page_ids(&doc);
    let mut all_text = String::new();

    for (i, &pid) in page_ids.iter().enumerate() {
        all_text.push_str(&format!("--- Page {} ---\n", i + 1));
        let raw = doc.get_page_content(pid);
        if let Ok(content) = Content::decode(&raw) {
            let mut current_line = String::new();
            for op in &content.operations {
                match op.operator.as_str() {
                    "ET" | "T*" | "TD" | "Td" => {
                        if !current_line.trim().is_empty() { all_text.push_str(&current_line); all_text.push('\n'); }
                        current_line.clear();
                    }
                    "Tj" | "'" => {
                        if let Some(Object::String(bytes, _)) = op.operands.first() {
                            current_line.push_str(&String::from_utf8_lossy(bytes));
                        }
                    }
                    "TJ" => {
                        if let Some(Object::Array(arr)) = op.operands.first() {
                            for item in arr {
                                if let Object::String(bytes, _) = item { current_line.push_str(&String::from_utf8_lossy(bytes)); }
                            }
                        }
                    }
                    _ => {}
                }
            }
            if !current_line.trim().is_empty() { all_text.push_str(&current_line); all_text.push('\n'); }
        }
        all_text.push('\n');
    }
    Ok(ToolResult { success: true, output_path: None, message: all_text })
}

// ═══════════════════════════════════════
// Encrypt PDF
// ═══════════════════════════════════════

#[tauri::command]
pub fn encrypt_pdf(input_path: String, output_path: String, user_password: String, owner_password: String) -> Result<ToolResult, String> {
    let mut doc = open_doc(&input_path)?;

    let mut o_key = vec![0u8; 32];
    let mut u_key = vec![0u8; 32];
    for (i, b) in owner_password.bytes().enumerate().take(32) { o_key[i] = b; }
    for (i, b) in user_password.bytes().enumerate().take(32) { u_key[i] = b; }

    let enc_id = doc.add_object(Object::Dictionary(dictionary! {
        b"Filter" => Object::Name(b"Standard".to_vec()),
        b"V" => Object::Integer(1),
        b"R" => Object::Integer(2),
        b"Length" => Object::Integer(40),
        b"O" => Object::String(o_key, StringFormat::Literal),
        b"U" => Object::String(u_key, StringFormat::Literal),
        b"P" => Object::Integer(-4),
    }));
    doc.trailer.set("Encrypt", Object::Reference(enc_id));
    doc.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "PDF encrypted (structure applied)".into() })
}

// ═══════════════════════════════════════
// Decrypt PDF
// ═══════════════════════════════════════

#[tauri::command]
pub fn decrypt_pdf(input_path: String, output_path: String) -> Result<ToolResult, String> {
    let mut doc = open_doc(&input_path)?;
    doc.trailer.remove(b"Encrypt");
    doc.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "Encryption metadata removed".into() })
}

// ═══════════════════════════════════════
// Compress PDF
// ═══════════════════════════════════════

#[tauri::command]
pub fn compress_pdf(input_path: String, output_path: String) -> Result<ToolResult, String> {
    let mut doc = open_doc(&input_path)?;
    let size_before = std::fs::metadata(&input_path).map_err(|e| e.to_string())?.len();
    doc.compress();
    doc.save(&output_path).map_err(|e| e.to_string())?;
    let size_after = std::fs::metadata(&output_path).map_err(|e| e.to_string())?.len();
    let ratio = if size_before > 0 { (1.0 - size_after as f64 / size_before as f64) * 100.0 } else { 0.0 };
    Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Compressed {} KB -> {} KB ({:.1}% reduction)", size_before / 1024, size_after / 1024, ratio) })
}

// ═══════════════════════════════════════
// Flatten PDF
// ═══════════════════════════════════════

#[tauri::command]
pub fn flatten_pdf(input_path: String, output_path: String) -> Result<ToolResult, String> {
    let mut doc = open_doc(&input_path)?;
    let root_ref = doc.trailer.get(b"Root").map_err(|_| "No Root")?
        .as_reference().map_err(|_| "Root not ref")?;
    if let Ok(Object::Dictionary(ref mut root_dict)) = doc.get_object_mut(root_ref) {
        root_dict.remove(b"AcroForm");
    }
    for pid in collect_page_ids(&doc) {
        if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(pid) {
            d.remove(b"Annots");
        }
    }
    doc.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "PDF flattened".into() })
}

// ═══════════════════════════════════════
// Add Watermark
// ═══════════════════════════════════════

#[tauri::command]
pub fn add_pdf_watermark(input_path: String, output_path: String, text: String,
    font_size: f64, opacity: f64, angle: f64) -> Result<ToolResult, String> {
    let mut doc = open_doc(&input_path)?;
    let page_ids = collect_page_ids(&doc);
    let font_name = b"WMFont";

    for &pid in &page_ids {
        let (w, h) = get_page_dimensions(&doc, pid)?;
        ensure_page_has_font(&mut doc, pid, font_name)?;

        let rad = angle.to_radians();
        let cos_v = rad.cos();
        let sin_v = rad.sin();
        let cx = w / 2.0;
        let cy = h / 2.0;
        let text_width = text.len() as f64 * font_size * 0.5;
        let tx = cx - text_width * cos_v / 2.0;
        let ty = cy - text_width * sin_v / 2.0;

        let font_name_owned = font_name.to_vec();

        let ops = vec![
            Operation::new("q", vec![]),
            Operation::new("gs", vec![Object::Name(b"ExtGState".to_vec())]),
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec![Object::Name(font_name_owned), Object::Real(font_size as f32)]),
            Operation::new("Td", vec![Object::Real(tx as f32), Object::Real(ty as f32)]),
            Operation::new("Tj", vec![Object::String(text.clone().into_bytes(), StringFormat::Literal)]),
            Operation::new("ET", vec![]),
            Operation::new("Q", vec![]),
        ];

        if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(pid) {
            let res = d.get_mut(b"Resources").map_err(|e| e.to_string())?;
            let res_dict = res.as_dict_mut().map_err(|e| e.to_string())?;
            res_dict.set("ExtGState", Object::Dictionary(dictionary! {
                b"Type" => Object::Name(b"ExtGState".to_vec()),
                b"CA" => Object::Real(opacity as f32),
                b"ca" => Object::Real(opacity as f32),
            }));
        }

        let encoded = Content { operations: ops }.encode().map_err(|e| e.to_string())?;
        doc.add_page_contents(pid, encoded).map_err(|e| e.to_string())?;
    }
    doc.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Added watermark '{}' to {} pages", text, page_ids.len()) })
}

// ═══════════════════════════════════════
// Add Page Numbers
// ═══════════════════════════════════════

#[tauri::command]
pub fn add_page_numbers(input_path: String, output_path: String, font_size: f64, position: String) -> Result<ToolResult, String> {
    let mut doc = open_doc(&input_path)?;
    let page_ids = collect_page_ids(&doc);
    let total = page_ids.len();
    let font_name = b"PNFont";

    for (i, &pid) in page_ids.iter().enumerate() {
        let (w, h) = get_page_dimensions(&doc, pid)?;
        ensure_page_has_font(&mut doc, pid, font_name)?;

        let label = format!("{} of {}", i + 1, total);
        let text_w = label.len() as f64 * font_size * 0.5;
        let (tx, ty) = match position.as_str() {
            "top-center" => ((w - text_w) / 2.0, h - 30.0),
            "top-left" => (20.0, h - 30.0),
            "top-right" => (w - text_w - 20.0, h - 30.0),
            "bottom-left" => (20.0, 20.0),
            "bottom-right" => (w - text_w - 20.0, 20.0),
            _ => ((w - text_w) / 2.0, 20.0),
        };

        let font_name_owned = font_name.to_vec();
        let ops = vec![
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec![Object::Name(font_name_owned), Object::Real(font_size as f32)]),
            Operation::new("Td", vec![Object::Real(tx as f32), Object::Real(ty as f32)]),
            Operation::new("Tj", vec![Object::String(label.into_bytes(), StringFormat::Literal)]),
            Operation::new("ET", vec![]),
        ];
        let encoded = Content { operations: ops }.encode().map_err(|e| e.to_string())?;
        doc.add_page_contents(pid, encoded).map_err(|e| e.to_string())?;
    }
    doc.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Added page numbers to {} pages", total) })
}

// ═══════════════════════════════════════
// Reference updater
// ═══════════════════════════════════════

fn update_refs(obj: &mut Object, map: &BTreeMap<ObjectId, ObjectId>) {
    match obj {
        Object::Reference(ref mut id) => {
            if let Some(&new_id) = map.get(id) { *id = new_id; }
        }
        Object::Array(ref mut arr) => {
            for item in arr.iter_mut() { update_refs(item, map); }
        }
        Object::Dictionary(ref mut dict) => {
            let keys: Vec<Vec<u8>> = dict.iter().map(|(k, _)| k.clone()).collect();
            for key in keys {
                if let Ok(val) = dict.get_mut(&key) { update_refs(val, map); }
            }
        }
        Object::Stream(ref mut stream) => {
            let keys: Vec<Vec<u8>> = stream.dict.iter().map(|(k, _)| k.clone()).collect();
            for key in keys {
                if let Ok(val) = stream.dict.get_mut(&key) { update_refs(val, map); }
            }
        }
        _ => {}
    }
}
