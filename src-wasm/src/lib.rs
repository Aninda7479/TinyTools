use image_core::{
    add_image_watermark, add_watermark as core_add_watermark, compress_image, convert_format, convert_heic,
    depth_blur, expand_canvas, flip_image, grayscale, inpaint_image, process_image,
    raster_to_svg, redact_regions as core_redact_regions, remove_background, rotate_image, sharpen_image,
    blur_image, resize_image,
    sepia_filter, smart_crop, smart_sharpen, split_image, stitch_images, strip_metadata as core_strip_metadata,
    upscale_image, ToolResult,
};
use js_sys::Uint8Array;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use std::collections::HashMap;
use img_parts::{jpeg::Jpeg, ImageEXIF, ImageICC};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[derive(Serialize, Deserialize)]
struct WasmResult {
    success: bool,
    output_path: Option<String>,
    message: String,
}

impl From<ToolResult> for WasmResult {
    fn from(r: ToolResult) -> Self {
        WasmResult {
            success: r.success,
            output_path: r.output_path,
            message: r.message,
        }
    }
}

// ---------------------------------------------------------
// Functions added by feature/wasm-migration operating on &[u8]
// ---------------------------------------------------------

#[derive(Serialize, Deserialize)]
pub struct MetadataResult {
    pub success: bool,
    pub metadata: HashMap<String, String>,
    pub message: String,
}

#[wasm_bindgen]
pub fn read_metadata(image_data: &[u8]) -> Result<JsValue, JsValue> {
    let mut reader = std::io::Cursor::new(image_data);
    let exif_data = exif::Reader::new()
        .read_from_container(&mut reader)
        .map_err(|e| e.to_string());
        
    let mut metadata = HashMap::new();
    
    match exif_data {
        Ok(parsed_exif) => {
            for f in parsed_exif.fields() {
                let tag = f.tag.to_string();
                let value = f.display_value().with_unit(&parsed_exif).to_string();
                metadata.insert(tag, value);
            }
            let res = MetadataResult {
                success: true,
                metadata,
                message: "Metadata extracted".into(),
            };
            Ok(serde_wasm_bindgen::to_value(&res).map_err(|e| JsValue::from_str(&e.to_string()))?)
        }
        Err(_) => {
            let res = MetadataResult {
                success: true,
                metadata,
                message: "No EXIF metadata found".into(),
            };
            Ok(serde_wasm_bindgen::to_value(&res).map_err(|e| JsValue::from_str(&e.to_string()))?)
        }
    }
}

#[wasm_bindgen]
pub fn strip_metadata(image_data: &[u8], is_jpeg: bool) -> Result<js_sys::Uint8Array, JsValue> {
    if is_jpeg {
        if let Ok(mut jpeg) = Jpeg::from_bytes(image_data.to_vec().into()) {
            jpeg.set_exif(None);
            jpeg.set_icc_profile(None);
            let mut out = Vec::new();
            if jpeg.encoder().write_to(&mut out).is_ok() {
                let js_array = js_sys::Uint8Array::new_with_length(out.len() as u32);
                js_array.copy_from(&out);
                return Ok(js_array);
            }
        }
    }
    
    // Fallback for png and others using the image crate
    let img = image::load_from_memory(image_data).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let mut out = std::io::Cursor::new(Vec::new());
    
    // Default to PNG output for the fallback
    img.write_to(&mut out, image::ImageFormat::Png).map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    let out_bytes = out.into_inner();
    let js_array = js_sys::Uint8Array::new_with_length(out_bytes.len() as u32);
    js_array.copy_from(&out_bytes);
    Ok(js_array)
}

#[wasm_bindgen]
pub fn redact_regions(image_data: &[u8], regions_json: &str, method: &str) -> Result<js_sys::Uint8Array, JsValue> {
    use image::Rgba;
    let img = image::load_from_memory(image_data).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let mut rgba = img.to_rgba8();

    let regions: Vec<(u32, u32, u32, u32)> = serde_json::from_str(regions_json).map_err(|e| JsValue::from_str(&e.to_string()))?;

    for (rx, ry, rw, rh) in &regions {
        match method {
            "pixelate" => {
                let block = 10u32;
                for by in (0..*rh).step_by(block as usize) {
                    for bx in (0..*rw).step_by(block as usize) {
                        let sx = rx + bx;
                        let sy = ry + by;
                        let p = *rgba.get_pixel(sx.min(rgba.width() - 1), sy.min(rgba.height() - 1));
                        for dy in 0..block.min(rh - by) {
                            for dx in 0..block.min(rw - bx) {
                                let px = (sx + dx).min(rgba.width() - 1);
                                let py = (sy + dy).min(rgba.height() - 1);
                                rgba.put_pixel(px, py, p);
                            }
                        }
                    }
                }
            }
            "blur" | _ => {
                let kernel = 7u32;
                let mut pixels: Vec<(u8, u8, u8)> = Vec::new();
                for y in ry.saturating_sub(kernel)..=(ry + rh + kernel).min(rgba.height() - 1) {
                    for x in rx.saturating_sub(kernel)..=(rx + rw + kernel).min(rgba.width() - 1) {
                        let p = *rgba.get_pixel(x, y);
                        pixels.push((p[0], p[1], p[2]));
                    }
                }
                let mut i = 0;
                for y in *ry..(*ry + *rh).min(rgba.height()) {
                    for x in *rx..(*rx + *rw).min(rgba.width()) {
                        if i < pixels.len() {
                            let (r, g, b) = pixels[i];
                            rgba.put_pixel(x, y, Rgba([r, g, b, 255]));
                        }
                        i += 1;
                    }
                }
            }
        }
    }

    let mut out = std::io::Cursor::new(Vec::new());
    let format = image::guess_format(image_data).unwrap_or(image::ImageFormat::Png);
    rgba.write_to(&mut out, format).map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    let out_bytes = out.into_inner();
    let js_array = js_sys::Uint8Array::new_with_length(out_bytes.len() as u32);
    js_array.copy_from(&out_bytes);
    Ok(js_array)
}

#[wasm_bindgen]
pub fn add_watermark(
    image_data: &[u8],
    text: &str,
    opacity: u8,
    position: &str,
) -> Result<js_sys::Uint8Array, JsValue> {
    use image::Rgba;
    use ab_glyph::{FontRef, PxScale, Font, ScaleFont};

    let img = image::load_from_memory(image_data).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let mut rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    let font_data = include_bytes!("../../src-tauri/fonts/Inter.ttf");
    let font = FontRef::try_from_slice(font_data).map_err(|e| JsValue::from_str(&e.to_string()))?;

    let font_size = (w as f32 * 0.04).max(14.0).min(72.0);
    let scale = PxScale::from(font_size);

    let mut text_width = 0.0f32;
    for ch in text.chars() {
        let glyph_id = font.glyph_id(ch);
        text_width += font.as_scaled(scale).h_advance(glyph_id);
    }
    let text_height = font_size * 1.2;

    let (bx, by) = match position {
        "top-left" => (16.0, 16.0),
        "top-right" => ((w as f32 - text_width - 16.0).max(0.0), 16.0),
        "bottom-left" => (16.0, (h as f32 - text_height - 16.0).max(0.0)),
        "center" => ((w as f32 - text_width) / 2.0, (h as f32 - text_height) / 2.0),
        _ => ((w as f32 - text_width - 16.0).max(0.0), (h as f32 - text_height - 16.0).max(0.0)),
    };

    let mut cursor_x = bx;
    for ch in text.chars() {
        let glyph_id = font.glyph_id(ch);
        let glyph = glyph_id.with_scale_and_position(scale, ab_glyph::point(cursor_x, by + font_size * 0.85));
        if let Some(outlined) = font.outline_glyph(glyph) {
            let bounds = outlined.px_bounds();
            outlined.draw(|px, py, coverage| {
                let img_x = bounds.min.x as i32 + px as i32;
                let img_y = bounds.min.y as i32 + py as i32;
                if img_x >= 0 && img_y >= 0 && (img_x as u32) < w && (img_y as u32) < h {
                    let blend = (coverage * opacity as f32 / 255.0).min(1.0);
                    let p = *rgba.get_pixel(img_x as u32, img_y as u32);
                    let r = (p[0] as f32 * (1.0 - blend) + 255.0 * blend) as u8;
                    let g = (p[1] as f32 * (1.0 - blend) + 255.0 * blend) as u8;
                    let b = (p[2] as f32 * (1.0 - blend) + 255.0 * blend) as u8;
                    rgba.put_pixel(img_x as u32, img_y as u32, Rgba([r, g, b, 255]));
                }
            });
        }
        cursor_x += font.as_scaled(scale).h_advance(glyph_id);
    }

    let mut out = std::io::Cursor::new(Vec::new());
    let format = image::guess_format(image_data).unwrap_or(image::ImageFormat::Png);
    rgba.write_to(&mut out, format).map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    let out_bytes = out.into_inner();
    let js_array = js_sys::Uint8Array::new_with_length(out_bytes.len() as u32);
    js_array.copy_from(&out_bytes);
    Ok(js_array)
}

// ---------------------------------------------------------
// Functions from main wrapped around image-core taking String paths
// ---------------------------------------------------------

#[wasm_bindgen]
pub fn wasm_compress_image(input_path: String, output_path: String, quality: u8) -> String {
    match compress_image(input_path, output_path, quality) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_process_image(input_path: String, output_path: String, operation: String, params: Option<String>) -> String {
    match process_image(input_path, output_path, operation, params) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_remove_background(input_path: String, output_path: String) -> String {
    match remove_background(input_path, output_path) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_inpaint_image(input_path: String, output_path: String, regions_json: String) -> String {
    let regions: Vec<(u32, u32, u32, u32)> = serde_json::from_str(&regions_json).unwrap_or_default();
    match inpaint_image(input_path, output_path, regions) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_upscale_image(input_path: String, output_path: String, scale: u32) -> String {
    match upscale_image(input_path, output_path, scale) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_sepia_filter(input_path: String, output_path: String) -> String {
    match sepia_filter(input_path, output_path) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_smart_sharpen(input_path: String, output_path: String, strength: f32) -> String {
    match smart_sharpen(input_path, output_path, strength) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_depth_blur(input_path: String, output_path: String, blur_strength: f32) -> String {
    match depth_blur(input_path, output_path, blur_strength) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_strip_metadata(input_path: String, output_path: String) -> String {
    match core_strip_metadata(input_path, output_path) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_redact_regions(input_path: String, output_path: String, regions_json: String, method: String) -> String {
    let regions: Vec<(u32, u32, u32, u32)> = serde_json::from_str(&regions_json).unwrap_or_default();
    match core_redact_regions(input_path, output_path, regions, method) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_add_watermark(input_path: String, output_path: String, text: String, opacity: u8, position: String) -> String {
    match core_add_watermark(input_path, output_path, text, opacity, position) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_smart_crop(input_path: String, output_path: String, width: u32, height: u32, gravity: String) -> String {
    match smart_crop(input_path, output_path, width, height, gravity) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_expand_canvas(input_path: String, output_path: String, top: u32, bottom: u32, left: u32, right: u32, color: String) -> String {
    match expand_canvas(input_path, output_path, top, bottom, left, right, color) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_split_image(input_path: String, output_dir: String, rows: u32, cols: u32) -> String {
    match split_image(input_path, output_dir, rows, cols) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_stitch_images(paths_json: String, output_path: String, direction: String) -> String {
    let paths: Vec<String> = serde_json::from_str(&paths_json).unwrap_or_default();
    match stitch_images(paths, output_path, direction) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_convert_format(input_path: String, output_path: String) -> String {
    match convert_format(input_path, output_path) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_rotate_image(input_path: String, output_path: String, degrees: u32) -> String {
    match rotate_image(input_path, output_path, degrees) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_grayscale(input_path: String, output_path: String) -> String {
    match grayscale(input_path, output_path) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_blur_image(input_path: String, output_path: String, sigma: f32) -> String {
    match blur_image(input_path, output_path, sigma) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_sharpen_image(input_path: String, output_path: String, amount: f32, radius: u32) -> String {
    match sharpen_image(input_path, output_path, amount, radius) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_flip_image(input_path: String, output_path: String, direction: String) -> String {
    match flip_image(input_path, output_path, direction) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

#[wasm_bindgen]
pub fn wasm_resize_image(input_path: String, output_path: String, max_w: u32, max_h: u32) -> String {
    match resize_image(input_path, output_path, max_w, max_h) {
        Ok(r) => serde_json::to_string(&WasmResult::from(r)).unwrap(),
        Err(e) => serde_json::to_string(&WasmResult { success: false, output_path: None, message: e }).unwrap(),
    }
}

