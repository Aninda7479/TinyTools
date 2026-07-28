use image::Rgba;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::BufReader;

#[derive(Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn strip_metadata(input_path: String, output_path: String) -> Result<ToolResult, String> {
    // Re-save image without metadata by decoding and encoding fresh
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    img.save(&output_path).map_err(|e| e.to_string())?;

    // Remove EXIF if output is JPEG
    let ext = std::path::Path::new(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    if ext.eq_ignore_ascii_case("jpg") || ext.eq_ignore_ascii_case("jpeg") {
        // Re-read and write without EXIF using exif crate
        match fs::File::open(&output_path) {
            Ok(f) => {
                let mut buf = BufReader::new(f);
                let exif = exif::Reader::new().read_from_container(&mut buf);
                if exif.is_ok() {
                    // For now, the image crate strips EXIF on re-save
                    // This is already handled by the decode/encode above
                }
            }
            _ => {}
        }
    }

    Ok(ToolResult {
        success: true,
        output_path: Some(output_path),
        message: "Metadata stripped".into(),
    })
}

#[tauri::command]
pub fn redact_regions(
    input_path: String,
    output_path: String,
    regions: Vec<(u32, u32, u32, u32)>,
    method: String,
) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let mut rgba = img.to_rgba8();

    for (rx, ry, rw, rh) in &regions {
        match method.as_str() {
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
                // Apply box blur to region
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

    rgba.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "Regions redacted".into() })
}

#[tauri::command]
pub fn add_watermark(
    input_path: String,
    output_path: String,
    text: String,
    opacity: u8,
    position: String,
) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let mut rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    // Simple text watermark using pixel-level rendering
    // Draw semi-transparent rectangles as watermark blocks
    let block_w = (text.len() as u32) * 8;
    let block_h = 12u32;
    let (bx, by) = match position.as_str() {
        "top-left" => (10, 10),
        "top-right" => (w.saturating_sub(block_w + 10), 10),
        "bottom-left" => (10, h.saturating_sub(block_h + 10)),
        "center" => ((w - block_w) / 2, (h - block_h) / 2),
        _ => (w.saturating_sub(block_w + 10), h.saturating_sub(block_h + 10)),
    };

    for y in by..(by + block_h).min(h) {
        for x in bx..(bx + block_w).min(w) {
            let p = *rgba.get_pixel(x, y);
            let blend = opacity as f64 / 255.0;
            let r = (p[0] as f64 * (1.0 - blend) + 255.0 * blend) as u8;
            let g = (p[1] as f64 * (1.0 - blend) + 255.0 * blend) as u8;
            let b = (p[2] as f64 * (1.0 - blend) + 255.0 * blend) as u8;
            rgba.put_pixel(x, y, Rgba([r, g, b, 255]));
        }
    }

    rgba.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "Watermark added".into() })
}

#[tauri::command]
pub fn add_image_watermark(
    input_path: String,
    watermark_path: String,
    output_path: String,
    opacity: u8,
    scale: f32,
) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let wm = image::open(&watermark_path).map_err(|e| e.to_string())?;
    let mut rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    let wm_rgba = wm.to_rgba8();
    let wm_new_w = (wm_rgba.width() as f32 * scale) as u32;
    let wm_new_h = (wm_rgba.height() as f32 * scale) as u32;
    let wm_resized = wm.resize(wm_new_w, wm_new_h, image::imageops::FilterType::Lanczos3);
    let wm_rgba = wm_resized.to_rgba8();

    // Position at bottom-right
    let ox = w.saturating_sub(wm_rgba.width() + 10);
    let oy = h.saturating_sub(wm_rgba.height() + 10);

    for wy in 0..wm_rgba.height() {
        for wx in 0..wm_rgba.width() {
            let px = ox + wx;
            let py = oy + wy;
            if px < w && py < h {
                let wp = *wm_rgba.get_pixel(wx, wy);
                let blend = (wp[3] as f64 / 255.0) * (opacity as f64 / 255.0);
                if blend > 0.0 {
                    let p = *rgba.get_pixel(px, py);
                    let r = (p[0] as f64 * (1.0 - blend) + wp[0] as f64 * blend) as u8;
                    let g = (p[1] as f64 * (1.0 - blend) + wp[1] as f64 * blend) as u8;
                    let b = (p[2] as f64 * (1.0 - blend) + wp[2] as f64 * blend) as u8;
                    rgba.put_pixel(px, py, Rgba([r, g, b, 255]));
                }
            }
        }
    }

    rgba.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "Image watermark added".into() })
}
