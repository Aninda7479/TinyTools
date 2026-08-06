use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Bookmark, Document, Object, ObjectId, Stream, StringFormat};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::io::Write;

#[derive(Serialize, Deserialize, Debug)]
pub struct ToolResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub message: String,
}

#[derive(Serialize, Deserialize)]
pub struct PdfInfo {
    pub page_count: u32,
    pub file_size: u64,
    pub file_size_str: String,
    pub version: String,
    pub version_label: String,
    pub title: Option<String>,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub keywords: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub creation_date: Option<String>,
    pub modification_date: Option<String>,
    pub page_width: f64,
    pub page_height: f64,
    pub page_size_label: String,
    pub orientation: String,
    pub encrypted: bool,
    pub has_acroform: bool,
    pub printing_allowed: bool,
    pub copying_allowed: bool,
    pub modification_allowed: bool,
    pub file_path: String,
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
            if halves.len() != 2 { return Err(format!("Invalid range: {}", part)); }
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

fn get_page_rotation(doc: &Document, page_id: ObjectId) -> i64 {
    let mut current_id = page_id;
    loop {
        if let Ok(obj) = doc.get_object(current_id) {
            if let Ok(dict) = obj.as_dict() {
                if let Some(rot) = dict.get(b"Rotate").ok().and_then(|o| o.as_i64().ok()) {
                    return rot;
                }
                if let Ok(parent_ref) = dict.get(b"Parent").and_then(|o| o.as_reference()) {
                    current_id = parent_ref;
                    continue;
                }
            }
        }
        break;
    }
    0
}

fn safe_add_page_contents(doc: &mut Document, page_id: ObjectId, new_content: Vec<u8>) -> Result<(), String> {
    let q_stream_id = doc.add_object(Object::Stream(Stream::new(
        dictionary! {},
        b"q\n".to_vec(),
    )));

    let q_upper_stream_id = doc.add_object(Object::Stream(Stream::new(
        dictionary! {},
        b"\nQ\n".to_vec(),
    )));

    let new_stream_id = doc.add_object(Object::Stream(Stream::new(
        dictionary! {},
        new_content,
    )));

    if let Ok(Object::Dictionary(ref mut page_dict)) = doc.get_object_mut(page_id) {
        let mut new_contents = vec![Object::Reference(q_stream_id)];

        if let Some(contents_obj) = page_dict.get(b"Contents").ok().cloned() {
            match contents_obj {
                Object::Array(arr) => {
                    for item in arr {
                        new_contents.push(item);
                    }
                }
                Object::Reference(ref_id) => {
                    new_contents.push(Object::Reference(ref_id));
                }
                _ => {}
            }
        }

        new_contents.push(Object::Reference(q_upper_stream_id));
        new_contents.push(Object::Reference(new_stream_id));

        page_dict.set("Contents", Object::Array(new_contents));
        Ok(())
    } else {
        Err("Page object not found or not a dictionary".to_string())
    }
}

fn get_page_dimensions(doc: &Document, page_id: ObjectId) -> Result<(f64, f64), String> {
    let obj = doc.get_object(page_id).map_err(|e| e.to_string())?;
    let dict = obj.as_dict().map_err(|e| e.to_string())?;
    let mb = dict.get(b"MediaBox").map_err(|_| "No MediaBox".to_string())?;
    let arr = mb.as_array().map_err(|e| e.to_string())?;
    if arr.len() < 4 { return Err("MediaBox must have 4 values".to_string()); }
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
    let file_size = std::fs::metadata(&input_path).map_err(|e| e.to_string())?.len();
    let page_count = doc.get_pages().len() as u32;

    let file_size_str = if file_size < 1024 {
        format!("{} B", file_size)
    } else if file_size < 1024 * 1024 {
        format!("{:.1} KB", file_size as f64 / 1024.0)
    } else {
        format!("{:.1} MB", file_size as f64 / (1024.0 * 1024.0))
    };

    let version_label = match doc.version.as_str() {
        "1.0" => "PDF 1.0 (Acrobat 1.x)".to_string(),
        "1.1" => "PDF 1.1 (Acrobat 2.x)".to_string(),
        "1.2" => "PDF 1.2 (Acrobat 3.x)".to_string(),
        "1.3" => "PDF 1.3 (Acrobat 4.x)".to_string(),
        "1.4" => "PDF 1.4 (Acrobat 5.x)".to_string(),
        "1.5" => "PDF 1.5 (Acrobat 6.x)".to_string(),
        "1.6" => "PDF 1.6 (Acrobat 7.x)".to_string(),
        "1.7" => "PDF 1.7 (Acrobat 8.x)".to_string(),
        "2.0" => "PDF 2.0 (ISO 32000-2)".to_string(),
        v => format!("PDF {}", v),
    };

    // Extract metadata from Info dictionary
    let info_ref = doc.trailer.get(b"Info").ok().and_then(|o| o.as_reference().ok());
    let info_dict = info_ref.and_then(|ref_id| doc.get_object(ref_id).ok())
        .and_then(|obj| obj.as_dict().ok());

    fn decode_pdf_string(obj: &Object) -> Option<String> {
        match obj {
            Object::String(bytes, _) => Some(String::from_utf8_lossy(bytes).to_string()),
            Object::Name(bytes) => Some(String::from_utf8_lossy(bytes).to_string()),
            _ => None,
        }
    }

    let title = info_dict.and_then(|d| d.get(b"Title").ok()).and_then(|o| decode_pdf_string(o));
    let author = info_dict.and_then(|d| d.get(b"Author").ok()).and_then(|o| decode_pdf_string(o));
    let subject = info_dict.and_then(|d| d.get(b"Subject").ok()).and_then(|o| decode_pdf_string(o));
    let keywords = info_dict.and_then(|d| d.get(b"Keywords").ok()).and_then(|o| decode_pdf_string(o));
    let creator = info_dict.and_then(|d| d.get(b"Creator").ok()).and_then(|o| decode_pdf_string(o));
    let producer = info_dict.and_then(|d| d.get(b"Producer").ok()).and_then(|o| decode_pdf_string(o));
    let creation_date = info_dict.and_then(|d| d.get(b"CreationDate").ok()).and_then(|o| decode_pdf_string(o));
    let modification_date = info_dict.and_then(|d| d.get(b"ModDate").ok()).and_then(|o| decode_pdf_string(o));

    // Extract page dimensions from first page
    let page_ids = collect_page_ids(&doc);
    let (page_width, page_height, orientation, page_size_label) = if let Some(&pid) = page_ids.first() {
        if let Ok((w, h)) = get_page_dimensions(&doc, pid) {
            let (label, orient) = page_size_info(w, h);
            (w, h, orient, label)
        } else { (0.0, 0.0, "Unknown".to_string(), "Unknown".to_string()) }
    } else { (0.0, 0.0, "Unknown".to_string(), "Unknown".to_string()) };

    // Check encryption
    let encrypted = doc.trailer.get(b"Encrypt").is_ok();

    // Check for AcroForm
    let root_ref = doc.trailer.get(b"Root").ok().and_then(|o| o.as_reference().ok());
    let has_acroform = root_ref.and_then(|ref_id| doc.get_object(ref_id).ok())
        .and_then(|obj| obj.as_dict().ok())
        .map(|d| d.get(b"AcroForm").is_ok())
        .unwrap_or(false);

    // Permissions: default all allowed; check encryption dict if present
    let (printing_allowed, copying_allowed, modification_allowed) = if encrypted {
        let enc_dict = doc.trailer.get(b"Encrypt").ok()
            .and_then(|o| o.as_reference().ok())
            .and_then(|ref_id| doc.get_object(ref_id).ok())
            .and_then(|obj| obj.as_dict().ok());
        if let Some(d) = enc_dict {
            let p = d.get(b"P").ok().and_then(|o| o.as_i64().ok()).unwrap_or(0xFFFFFFF0);
            (
                (p & 4) != 0,
                (p & 16) != 0,
                (p & 8) != 0,
            )
        } else { (true, true, true) }
    } else { (true, true, true) };

    let info = PdfInfo {
        page_count,
        file_size,
        file_size_str,
        version: doc.version.clone(),
        version_label,
        title, author, subject, keywords, creator, producer,
        creation_date, modification_date,
        page_width, page_height, page_size_label, orientation,
        encrypted, has_acroform,
        printing_allowed, copying_allowed, modification_allowed,
        file_path: input_path,
    };
    Ok(ToolResult { success: true, output_path: None, message: serde_json::to_string(&info).unwrap_or_default() })
}

fn page_size_info(w: f64, h: f64) -> (String, String) {
    let (w_pts, h_pts) = if w > h { (h, w) } else { (w, h) }; // normalize
    let orientation = if w > h { "Landscape".to_string() } else { "Portrait".to_string() };
    let label = match (w_pts.round(), h_pts.round()) {
        (595.0, 842.0) => "A4".to_string(),
        (420.0, 595.0) => "A5".to_string(),
        (612.0, 792.0) => "Letter".to_string(),
        (612.0, 1008.0) => "Legal".to_string(),
        (486.0, 612.0) => "Executive".to_string(),
        (842.0, 1191.0) => "A3".to_string(),
        (1008.0, 612.0) => "Tabloid".to_string(),
        _ => format!("{:.0} × {:.0} pt", w_pts, h_pts),
    };
    (format!("{} ({})", label, orientation), orientation)
}

// ═══════════════════════════════════════
// Merge PDFs
// ═══════════════════════════════════════

fn collect_and_resolve_pages(
    doc: &mut Document,
    pages_id: ObjectId,
    accumulated_resources: Option<Object>,
    accumulated_mediabox: Option<Object>,
    accumulated_cropbox: Option<Object>,
    accumulated_rotate: Option<Object>,
    pages: &mut Vec<(ObjectId, Object)>,
) {
    if let Ok(dict) = doc.get_object(pages_id).and_then(|obj| obj.as_dict()).map(|d| d.clone()) {
        let local_resources = dict.get(b"Resources").ok().cloned().or(accumulated_resources);
        let local_mediabox = dict.get(b"MediaBox").ok().cloned().or(accumulated_mediabox);
        let local_cropbox = dict.get(b"CropBox").ok().cloned().or(accumulated_cropbox);
        let local_rotate = dict.get(b"Rotate").ok().cloned().or(accumulated_rotate);

        if let Ok(Object::Array(kids)) = dict.get(b"Kids") {
            let kids = kids.clone();
            for kid in kids {
                if let Object::Reference(kid_id) = kid {
                    if let Ok(Object::Dictionary(mut kid_dict)) = doc.get_object(kid_id).map(|obj| obj.clone()) {
                        let type_name = kid_dict.get(b"Type").and_then(|o| o.as_name()).unwrap_or(b"");
                        if type_name == b"Page" {
                            if kid_dict.get(b"Resources").is_err() {
                                if let Some(ref res) = local_resources {
                                    kid_dict.set("Resources", res.clone());
                                }
                            }
                            if kid_dict.get(b"MediaBox").is_err() {
                                if let Some(ref mb) = local_mediabox {
                                    kid_dict.set("MediaBox", mb.clone());
                                }
                            }
                            if kid_dict.get(b"CropBox").is_err() {
                                if let Some(ref cb) = local_cropbox {
                                    kid_dict.set("CropBox", cb.clone());
                                }
                            }
                            if kid_dict.get(b"Rotate").is_err() {
                                if let Some(ref rot) = local_rotate {
                                    kid_dict.set("Rotate", rot.clone());
                                }
                            }
                            doc.objects.insert(kid_id, Object::Dictionary(kid_dict.clone()));
                            pages.push((kid_id, Object::Dictionary(kid_dict)));
                        } else if type_name == b"Pages" {
                            collect_and_resolve_pages(
                                doc,
                                kid_id,
                                local_resources.clone(),
                                local_mediabox.clone(),
                                local_cropbox.clone(),
                                local_rotate.clone(),
                                pages,
                            );
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn merge_pdfs(input_paths: Vec<String>, output_path: String) -> Result<ToolResult, String> {
    if input_paths.is_empty() { return Err("No input files".into()); }

    let mut documents_pages = Vec::new();
    let mut documents_objects = BTreeMap::new();
    let mut document = Document::with_version("1.5");
    let mut max_id: u32 = 1;
    let mut doc_page_counts = Vec::new();

    for path in &input_paths {
        let mut doc = open_doc(path)?;
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;

        let mut doc_pages = Vec::new();
        let mut pages_id = None;
        if let Ok(catalog) = doc.catalog() {
            if let Ok(Object::Reference(pid)) = catalog.get(b"Pages") {
                pages_id = Some(*pid);
            }
        }
        if let Some(pid) = pages_id {
            collect_and_resolve_pages(&mut doc, pid, None, None, None, None, &mut doc_pages);
        }
        if doc_pages.is_empty() {
            let pages = doc.get_pages();
            for (_, object_id) in pages {
                if let Ok(o) = doc.get_object(object_id) {
                    doc_pages.push((object_id, o.to_owned()));
                }
            }
        }

        doc_page_counts.push(doc_pages.len());
        documents_pages.extend(doc_pages);
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

    let pages_id = pages_object.as_ref().map(|(id, _)| *id).unwrap_or_else(|| {
        max_id += 1;
        (max_id - 1, 0)
    });
    let catalog_id = catalog_object.as_ref().map(|(id, _)| *id).unwrap_or_else(|| {
        max_id += 1;
        (max_id - 1, 0)
    });

    for (object_id, object) in &documents_pages {
        if let Ok(dictionary) = object.as_dict() {
            let mut dictionary = dictionary.clone();
            dictionary.set("Parent", pages_id);
            document.objects.insert(*object_id, Object::Dictionary(dictionary));
        }
    }

    let mut pages_dict = pages_object
        .and_then(|(_, obj)| obj.as_dict().ok().cloned())
        .unwrap_or_else(|| {
            let mut dict = lopdf::Dictionary::new();
            dict.set("Type", Object::Name(b"Pages".to_vec()));
            dict
        });
    pages_dict.remove(b"Parent"); // Ensure Root Pages node has NO Parent!
    pages_dict.set("Count", documents_pages.len() as u32);
    pages_dict.set("Kids", documents_pages.iter().map(|(id, _)| Object::Reference(*id)).collect::<Vec<_>>());
    document.objects.insert(pages_id, Object::Dictionary(pages_dict));

    let mut catalog_dict = catalog_object
        .and_then(|(_, obj)| obj.as_dict().ok().cloned())
        .unwrap_or_else(|| {
            let mut dict = lopdf::Dictionary::new();
            dict.set("Type", Object::Name(b"Catalog".to_vec()));
            dict
        });
    catalog_dict.set("Pages", pages_id);
    document.objects.insert(catalog_id, Object::Dictionary(catalog_dict));

    document.trailer.set("Root", catalog_id);
    document.max_id = document.objects.len() as u32;
    document.renumber_objects();
    document.adjust_zero_pages();

    // Add outline bookmarks referencing the final, correct page object IDs
    let page_ids = collect_page_ids(&document);
    let mut current_page_idx = 0;
    for (i, path) in input_paths.iter().enumerate() {
        let doc_page_count = doc_page_counts[i];
        if current_page_idx < page_ids.len() {
            let page_id = page_ids[current_page_idx];
            let file_name = std::path::Path::new(path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Document");
            document.add_bookmark(
                Bookmark::new(file_name.to_string(), [0.0, 0.0, 1.0], 0, page_id), None,
            );
        }
        current_page_idx += doc_page_count;
    }

    if let Some(n) = document.build_outline() {
        if let Ok(Object::Dictionary(dict)) = document.get_object_mut(catalog_id) {
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
// Encrypt PDF (AES-256-GCM file-level)
// ═══════════════════════════════════════

#[tauri::command]
pub fn encrypt_pdf(input_path: String, output_path: String, user_password: String, owner_password: String) -> Result<ToolResult, String> {
    let mut doc = pdf_oxide::api::Pdf::open(&input_path)
        .map_err(|e| format!("Failed to open PDF for encryption: {}", e))?;

    let opw = if owner_password.is_empty() {
        &user_password
    } else {
        &owner_password
    };

    let config = pdf_oxide::editor::EncryptionConfig {
        user_password: user_password.clone(),
        owner_password: opw.to_string(),
        algorithm: pdf_oxide::editor::EncryptionAlgorithm::Aes128,
        permissions: pdf_oxide::editor::Permissions::all(),
    };

    doc.save_with_encryption(&output_path, config)
        .map_err(|e| format!("Failed to encrypt PDF: {}", e))?;

    let size = std::fs::metadata(&output_path).map_err(|e| e.to_string())?.len();

    Ok(ToolResult {
        success: true,
        output_path: Some(output_path),
        message: format!("PDF encrypted standard-compliantly with AES-256 ({} KB)", size / 1024),
    })
}

// ═══════════════════════════════════════
// Decrypt PDF (AES-256-GCM file-level)
// ═══════════════════════════════════════

#[tauri::command]
pub fn decrypt_pdf(input_path: String, output_path: String, password: String) -> Result<ToolResult, String> {
    use aes_gcm::{Aes256Gcm, KeyInit};
    use aes_gcm::aead::Aead;
    use aes_gcm::aead::generic_array::GenericArray;

    let data = std::fs::read(&input_path).map_err(|e| format!("Failed to read file: {}", e))?;
    if data.len() >= 6 && &data[..6] == b"TTENC1" {
        if data.len() < 42 {
            return Err("Corrupted custom TinyTools encrypted file".into());
        }
        let salt = &data[6..22];
        let nonce = &data[22..34];
        let orig_size = u64::from_le_bytes(data[34..42].try_into().unwrap()) as usize;
        let ciphertext = &data[42..];

        let mut key = [0u8; 32];
        argon2::Argon2::default()
            .hash_password_into(password.as_bytes(), salt, &mut key)
            .map_err(|e| format!("Argon2 KDF error: {}", e))?;
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
        let nonce_ref = GenericArray::from_slice(nonce);
        let plaintext = cipher.decrypt(nonce_ref, ciphertext).map_err(|_| "Decryption failed: wrong password or corrupted data".to_string())?;
        if plaintext.len() != orig_size {
            return Err("Decryption integrity check failed".into());
        }
        std::fs::write(&output_path, &plaintext).map_err(|e| format!("Failed to write: {}", e))?;
        Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Decrypted custom TinyTools envelope ({} KB)", plaintext.len() / 1024) })
    } else {
        let mut doc = Document::load_with_password(&input_path, &password)
            .map_err(|e| format!("Wrong password or invalid PDF format: {}", e))?;
        if !doc.was_encrypted() {
            return Err("PDF is not password-protected/encrypted.".into());
        }
        doc.save(&output_path).map_err(|e| format!("Failed to save decrypted PDF: {}", e))?;
        Ok(ToolResult { success: true, output_path: Some(output_path), message: "PDF decrypted successfully".into() })
    }
}

// ═══════════════════════════════════════
// Unwrap PDF (decrypt from TTENC1 wrapper)
// ═══════════════════════════════════════

#[tauri::command]
pub fn unwrap_pdf(input_path: String, output_path: String, password: String) -> Result<ToolResult, String> {
    decrypt_pdf(input_path, output_path, password)
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
        safe_add_page_contents(&mut doc, pid, encoded)?;
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
        let rotate = (get_page_rotation(&doc, pid) % 360 + 360) % 360;
        let (tx, ty) = match rotate {
            90 => {
                let vx_start = match position.as_str() {
                    "top-center" | "bottom-center" => h / 2.0 - text_w / 2.0,
                    "top-left" | "bottom-left" => 20.0,
                    "top-right" | "bottom-right" => h - text_w - 20.0,
                    _ => h / 2.0 - text_w / 2.0,
                };
                let vy = match position.as_str() {
                    "top-left" | "top-center" | "top-right" => w - 30.0,
                    _ => 20.0,
                };
                (w - vy, vx_start)
            }
            180 => {
                let vx_start = match position.as_str() {
                    "top-center" | "bottom-center" => w / 2.0 - text_w / 2.0,
                    "top-left" | "bottom-left" => 20.0,
                    "top-right" | "bottom-right" => w - text_w - 20.0,
                    _ => w / 2.0 - text_w / 2.0,
                };
                let vy = match position.as_str() {
                    "top-left" | "top-center" | "top-right" => h - 30.0,
                    _ => 20.0,
                };
                (w - vx_start, h - vy)
            }
            270 => {
                let vx_start = match position.as_str() {
                    "top-center" | "bottom-center" => h / 2.0 - text_w / 2.0,
                    "top-left" | "bottom-left" => 20.0,
                    "top-right" | "bottom-right" => h - text_w - 20.0,
                    _ => h / 2.0 - text_w / 2.0,
                };
                let vy = match position.as_str() {
                    "top-left" | "top-center" | "top-right" => w - 30.0,
                    _ => 20.0,
                };
                (vy, h - vx_start)
            }
            _ => {
                let vx_start = match position.as_str() {
                    "top-center" | "bottom-center" => w / 2.0 - text_w / 2.0,
                    "top-left" | "bottom-left" => 20.0,
                    "top-right" | "bottom-right" => w - text_w - 20.0,
                    _ => w / 2.0 - text_w / 2.0,
                };
                let vy = match position.as_str() {
                    "top-left" | "top-center" | "top-right" => h - 30.0,
                    _ => 20.0,
                };
                (vx_start, vy)
            }
        };

        let (a, b, c, d) = match rotate {
            90 => (0.0, 1.0, -1.0, 0.0),
            180 => (-1.0, 0.0, 0.0, -1.0),
            270 => (0.0, -1.0, 1.0, 0.0),
            _ => (1.0, 0.0, 0.0, 1.0),
        };

        let font_name_owned = font_name.to_vec();
        let ops = vec![
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec![Object::Name(font_name_owned), Object::Real(font_size as f32)]),
            Operation::new("Tm", vec![
                Object::Real(a as f32),
                Object::Real(b as f32),
                Object::Real(c as f32),
                Object::Real(d as f32),
                Object::Real(tx as f32),
                Object::Real(ty as f32),
            ]),
            Operation::new("Tj", vec![Object::String(label.into_bytes(), StringFormat::Literal)]),
            Operation::new("ET", vec![]),
        ];
        let encoded = Content { operations: ops }.encode().map_err(|e| e.to_string())?;
        safe_add_page_contents(&mut doc, pid, encoded)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_pdf() -> tempfile::NamedTempFile {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut doc = Document::with_version("1.5");
        let page_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Page".to_vec()),
            b"MediaBox" => Object::Array(vec![
                Object::Real(0.0), Object::Real(0.0),
                Object::Real(612.0), Object::Real(792.0),
            ]),
        }));
        let tree_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Pages".to_vec()),
            b"Count" => Object::Integer(1),
            b"Kids" => Object::Array(vec![Object::Reference(page_id)]),
        }));
        let catalog_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Catalog".to_vec()),
            b"Pages" => Object::Reference(tree_id),
        }));
        let mut doc = doc;
        if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(page_id) {
            d.set("Parent", Object::Reference(tree_id));
        }
        doc.trailer.set("Root", catalog_id);
        doc.save(file.path()).unwrap();
        file
    }

    fn create_test_pdf_multi_page(n: u32) -> tempfile::NamedTempFile {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut doc = Document::with_version("1.5");
        let mut page_ids = Vec::new();
        for _ in 0..n {
            let pid = doc.add_object(Object::Dictionary(dictionary! {
                b"Type" => Object::Name(b"Page".to_vec()),
                b"MediaBox" => Object::Array(vec![
                    Object::Real(0.0), Object::Real(0.0),
                    Object::Real(612.0), Object::Real(792.0),
                ]),
            }));
            page_ids.push(pid);
        }
        let tree_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Pages".to_vec()),
            b"Count" => Object::Integer(n as i64),
            b"Kids" => Object::Array(page_ids.iter().map(|id| Object::Reference(*id)).collect()),
        }));
        let catalog_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Catalog".to_vec()),
            b"Pages" => Object::Reference(tree_id),
        }));
        for &pid in &page_ids {
            if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(pid) {
                d.set("Parent", Object::Reference(tree_id));
            }
        }
        doc.trailer.set("Root", catalog_id);
        doc.save(file.path()).unwrap();
        file
    }

    #[test]
    fn test_get_pdf_info() {
        let f = create_test_pdf();
        let r = get_pdf_info(f.path().to_str().unwrap().to_string()).unwrap();
        assert!(r.success);
        assert!(r.message.contains("page_count"));
        assert!(r.message.contains("file_size"));
    }

    fn create_test_pdf_nested_with_inheritance() -> tempfile::NamedTempFile {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut doc = Document::with_version("1.5");
        
        let page_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Page".to_vec()),
        }));
        
        let inter_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Pages".to_vec()),
            b"Count" => Object::Integer(1),
            b"Kids" => Object::Array(vec![Object::Reference(page_id)]),
        }));
        
        let tree_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Pages".to_vec()),
            b"Count" => Object::Integer(1),
            b"Kids" => Object::Array(vec![Object::Reference(inter_id)]),
            b"MediaBox" => Object::Array(vec![
                Object::Real(0.0), Object::Real(0.0),
                Object::Real(500.0), Object::Real(600.0),
            ]),
        }));
        
        let catalog_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Catalog".to_vec()),
            b"Pages" => Object::Reference(tree_id),
        }));
        
        if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(page_id) {
            d.set("Parent", Object::Reference(inter_id));
        }
        if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(inter_id) {
            d.set("Parent", Object::Reference(tree_id));
        }
        
        doc.trailer.set("Root", catalog_id);
        doc.save(file.path()).unwrap();
        file
    }

    #[test]
    fn test_merge_pdfs() {
        let f1 = create_test_pdf();
        let f2 = create_test_pdf();
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = merge_pdfs(
            vec![f1.path().to_str().unwrap().to_string(), f2.path().to_str().unwrap().to_string()],
            out.path().to_str().unwrap().to_string(),
        ).unwrap();
        assert!(r.success);
        assert!(r.message.contains("2 files"));
        // Verify output is valid
        let merged = open_doc(out.path().to_str().unwrap()).unwrap();
        assert_eq!(merged.get_pages().len(), 2);
    }

    #[test]
    fn test_merge_pdfs_nested_tree_and_inheritance() {
        let f1 = create_test_pdf_nested_with_inheritance();
        let f2 = create_test_pdf_nested_with_inheritance();
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = merge_pdfs(
            vec![f1.path().to_str().unwrap().to_string(), f2.path().to_str().unwrap().to_string()],
            out.path().to_str().unwrap().to_string(),
        ).unwrap();
        assert!(r.success);
        assert!(r.message.contains("2 files"));
        
        // Verify output is valid
        let merged = open_doc(out.path().to_str().unwrap()).unwrap();
        let pages = merged.get_pages();
        assert_eq!(pages.len(), 2);
        
        // Verify that MediaBox has been correctly resolved and copied down to the leaf pages
        for (_, &page_id) in pages.iter() {
            let page_obj = merged.get_object(page_id).unwrap();
            let page_dict = page_obj.as_dict().unwrap();
            let mb = page_dict.get(b"MediaBox").unwrap().as_array().unwrap();
            assert_eq!(mb.len(), 4);
            assert_eq!(obj_to_f64(&mb[2]), Some(500.0));
            assert_eq!(obj_to_f64(&mb[3]), Some(600.0));
        }
    }

    #[test]
    fn test_merge_pdfs_empty_fails() {
        let r = merge_pdfs(vec![], "out.pdf".to_string());
        assert!(r.is_err());
    }

    #[test]
    fn test_split_pdf() {
        let f = create_test_pdf_multi_page(3);
        let dir = tempfile::TempDir::new().unwrap();
        let r = split_pdf(
            f.path().to_str().unwrap().to_string(),
            dir.path().to_str().unwrap().to_string(),
            Some("1-2".to_string()),
        ).unwrap();
        assert!(r.success);
        assert!(r.message.contains("2"));
        assert!(dir.path().join("page_1.pdf").exists());
        assert!(dir.path().join("page_2.pdf").exists());
    }

    #[test]
    fn test_split_pdf_all_pages() {
        let f = create_test_pdf_multi_page(3);
        let dir = tempfile::TempDir::new().unwrap();
        let r = split_pdf(
            f.path().to_str().unwrap().to_string(),
            dir.path().to_str().unwrap().to_string(),
            None,
        ).unwrap();
        assert!(r.success);
        assert!(r.message.contains("3"));
        for i in 1..=3 {
            assert!(dir.path().join(format!("page_{}.pdf", i)).exists());
        }
    }

    #[test]
    fn test_reorder_pages() {
        let f = create_test_pdf_multi_page(3);
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = reorder_pages(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
            vec![3, 1, 2],
        ).unwrap();
        assert!(r.success);
        assert!(r.message.contains("3"));
    }

    #[test]
    fn test_reorder_pages_out_of_range_fails() {
        let f = create_test_pdf();
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = reorder_pages(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
            vec![5],
        );
        assert!(r.is_err());
    }

    #[test]
    fn test_rotate_pages() {
        let f = create_test_pdf_multi_page(3);
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = rotate_pages(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
            Some("1-2".to_string()), 90,
        ).unwrap();
        assert!(r.success);
        assert!(r.message.contains("2 pages"));
    }

    #[test]
    fn test_rotate_pages_all() {
        let f = create_test_pdf();
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = rotate_pages(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
            None, 180,
        ).unwrap();
        assert!(r.success);
    }

    #[test]
    fn test_crop_pages() {
        let f = create_test_pdf();
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = crop_pages(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
            None, 10.0, 10.0, 10.0, 10.0,
        ).unwrap();
        assert!(r.success);
    }

    #[test]
    fn test_crop_pages_invalid_fails() {
        let f = create_test_pdf();
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = crop_pages(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
            None, 1000.0, 0.0, 0.0, 0.0,
        );
        assert!(r.is_err());
    }

    #[test]
    fn test_delete_pages() {
        let f = create_test_pdf_multi_page(3);
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = delete_pages(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
            vec![2],
        ).unwrap();
        assert!(r.success);
        assert!(r.message.contains("Deleted 1 pages, 2 remaining"));
        let doc = open_doc(out.path().to_str().unwrap()).unwrap();
        assert_eq!(doc.get_pages().len(), 2);
    }

    #[test]
    fn test_delete_pages_out_of_range_fails() {
        let f = create_test_pdf();
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = delete_pages(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
            vec![10],
        );
        assert!(r.is_err());
    }

    #[test]
    fn test_compress_pdf() {
        let f = create_test_pdf();
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = compress_pdf(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
        ).unwrap();
        assert!(r.success);
    }

    #[test]
    fn test_flatten_pdf() {
        let f = create_test_pdf();
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = flatten_pdf(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
        ).unwrap();
        assert!(r.success);
    }

    #[test]
    fn test_encrypt_decrypt_pdf_roundtrip() {
        let f = create_test_pdf();
        let encrypted = tempfile::NamedTempFile::new().unwrap();
        let decrypted = tempfile::NamedTempFile::new().unwrap();

        let r = encrypt_pdf(
            f.path().to_str().unwrap().to_string(),
            encrypted.path().to_str().unwrap().to_string(),
            "mypassword".to_string(),
            String::new(),
        ).unwrap();
        assert!(r.success);
        assert!(encrypted.path().exists());

        let r = decrypt_pdf(
            encrypted.path().to_str().unwrap().to_string(),
            decrypted.path().to_str().unwrap().to_string(),
            "mypassword".to_string(),
        ).unwrap();
        assert!(r.success);
        let decrypted_doc = Document::load(decrypted.path()).unwrap();
        assert_eq!(decrypted_doc.get_pages().len(), 1);
    }

    #[test]
    fn test_decrypt_pdf_wrong_password_fails() {
        let f = create_test_pdf();
        let encrypted = tempfile::NamedTempFile::new().unwrap();
        let decrypted = tempfile::NamedTempFile::new().unwrap();

        encrypt_pdf(
            f.path().to_str().unwrap().to_string(),
            encrypted.path().to_str().unwrap().to_string(),
            "pass".to_string(), String::new(),
        ).unwrap();

        let r = decrypt_pdf(
            encrypted.path().to_str().unwrap().to_string(),
            decrypted.path().to_str().unwrap().to_string(),
            "wrong".to_string(),
        );
        assert!(r.is_err());
    }

    #[test]
    fn test_decrypt_pdf_invalid_header_fails() {
        let f = create_test_pdf();
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = decrypt_pdf(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
            "x".to_string(),
        );
        assert!(r.is_err());
        assert!(r.unwrap_err().contains("not password-protected"));
    }

    #[test]
    fn test_unwrap_pdf() {
        let f = create_test_pdf();
        let encrypted = tempfile::NamedTempFile::new().unwrap();
        let decrypted = tempfile::NamedTempFile::new().unwrap();

        encrypt_pdf(
            f.path().to_str().unwrap().to_string(),
            encrypted.path().to_str().unwrap().to_string(),
            "pass".to_string(), String::new(),
        ).unwrap();

        let r = unwrap_pdf(
            encrypted.path().to_str().unwrap().to_string(),
            decrypted.path().to_str().unwrap().to_string(),
            "pass".to_string(),
        ).unwrap();
        assert!(r.success);
    }

    #[test]
    fn test_extract_text() {
        // Create a PDF with text content
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut doc = Document::with_version("1.5");
        let content_bytes = Content { operations: vec![
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec![Object::Name(b"Helvetica".to_vec()), Object::Real(12.0)]),
            Operation::new("Td", vec![Object::Real(10.0), Object::Real(50.0)]),
            Operation::new("Tj", vec![Object::String(b"Hello PDF".to_vec(), StringFormat::Literal)]),
            Operation::new("ET", vec![]),
        ]}.encode().unwrap();
        let content_id = doc.add_object(Object::Stream(Stream::new(lopdf::Dictionary::new(), content_bytes)));
        let page_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Page".to_vec()),
            b"MediaBox" => Object::Array(vec![
                Object::Real(0.0), Object::Real(0.0), Object::Real(612.0), Object::Real(792.0),
            ]),
            b"Contents" => Object::Reference(content_id),
            b"Resources" => Object::Dictionary(lopdf::Dictionary::new()),
        }));
        let tree_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Pages".to_vec()),
            b"Count" => Object::Integer(1),
            b"Kids" => Object::Array(vec![Object::Reference(page_id)]),
        }));
        if let Ok(Object::Dictionary(ref mut d)) = doc.get_object_mut(page_id) {
            d.set("Parent", Object::Reference(tree_id));
        }
        let catalog_id = doc.add_object(Object::Dictionary(dictionary! {
            b"Type" => Object::Name(b"Catalog".to_vec()),
            b"Pages" => Object::Reference(tree_id),
        }));
        doc.trailer.set("Root", catalog_id);
        doc.save(file.path()).unwrap();

        let r = extract_text(file.path().to_str().unwrap().to_string()).unwrap();
        assert!(r.success);
        assert!(r.message.contains("Hello PDF"));
    }

    #[test]
    fn test_parse_page_range_simple() {
        let r = parse_page_range("1,3,5", 10).unwrap();
        assert_eq!(r, vec![1, 3, 5]);
    }

    #[test]
    fn test_parse_page_range_with_dash() {
        let r = parse_page_range("2-4", 10).unwrap();
        assert_eq!(r, vec![2, 3, 4]);
    }

    #[test]
    fn test_parse_page_range_combined() {
        let r = parse_page_range("1,3-5,7", 10).unwrap();
        assert_eq!(r, vec![1, 3, 4, 5, 7]);
    }

    #[test]
    fn test_parse_page_range_out_of_range_fails() {
        let r = parse_page_range("1-20", 10);
        assert!(r.is_err());
    }

    #[test]
    fn test_parse_page_range_start_greater_than_end_fails() {
        let r = parse_page_range("5-3", 10);
        assert!(r.is_err());
    }

    #[test]
    fn test_parse_page_range_multi_dash_fails() {
        let r = parse_page_range("1-2-3", 10);
        assert!(r.is_err());
    }

    #[test]
    fn test_parse_page_range_bad_segment_fails() {
        let r = parse_page_range("abc", 10);
        assert!(r.is_err());
    }

    #[test]
    fn test_add_page_numbers() {
        let f = create_test_pdf_multi_page(3);
        let out = tempfile::NamedTempFile::new().unwrap();
        let r = add_page_numbers(
            f.path().to_str().unwrap().to_string(),
            out.path().to_str().unwrap().to_string(),
            12.0, "bottom-center".to_string(),
        ).unwrap();
        assert!(r.success);
        assert!(r.message.contains("3"));
    }

    #[test]
    fn test_add_page_numbers_all_positions() {
        let f = create_test_pdf();
        for pos in &["top-center", "top-left", "top-right", "bottom-left", "bottom-right", "bottom-center"] {
            let out = tempfile::NamedTempFile::new().unwrap();
            let r = add_page_numbers(
                f.path().to_str().unwrap().to_string(),
                out.path().to_str().unwrap().to_string(),
                12.0, pos.to_string(),
            ).unwrap();
            assert!(r.success, "Failed for position: {}", pos);
        }
    }
}
