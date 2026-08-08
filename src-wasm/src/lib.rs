pub mod process;
pub mod ai_tools;
pub mod editing;
pub mod conversion;

use img_parts::{jpeg::Jpeg, ImageEXIF, ImageICC};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

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
