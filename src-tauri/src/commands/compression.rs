use image::{codecs::jpeg::JpegEncoder, DynamicImage};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn smart_compress(
    input_path: String,
    output_path: String,
    target_size_kb: Option<u32>,
    quality: u8,
) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let ext = get_extension(&output_path);

    if let Some(target) = target_size_kb {
        // Binary search for quality that hits target size
        let mut low = 10u8;
        let mut high = 100u8;
        let mut best_quality = quality;

        for _ in 0..8 {
            let mid = (low + high) / 2;
            let size = estimate_size(&img, mid, &ext)?;
            if size > target as u64 * 1024 {
                high = mid;
            } else {
                low = mid;
                best_quality = mid;
            }
        }
        compress_with_quality(&img, best_quality, &ext, &output_path)?;
        Ok(ToolResult {
            success: true,
            output_path: Some(output_path),
            message: format!("Compressed to ~{}KB (q={})", target, best_quality),
        })
    } else {
        compress_with_quality(&img, quality, &ext, &output_path)?;
        Ok(ToolResult {
            success: true,
            output_path: Some(output_path),
            message: format!("Compressed with quality {}", quality),
        })
    }
}

fn compress_with_quality(img: &DynamicImage, quality: u8, ext: &str, path: &str) -> Result<(), String> {
    match ext {
        "jpg" | "jpeg" => {
            let rgb = img.to_rgb8();
            let mut buf = Cursor::new(Vec::new());
            let encoder = JpegEncoder::new_with_quality(&mut buf, quality);
            rgb.write_with_encoder(encoder).map_err(|e| e.to_string())?;
            fs::write(path, buf.into_inner()).map_err(|e| e.to_string())?;
        }
        _ => {
            img.save(path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn estimate_size(img: &DynamicImage, quality: u8, ext: &str) -> Result<u64, String> {
    match ext {
        "jpg" | "jpeg" => {
            let rgb = img.to_rgb8();
            let mut buf = Cursor::new(Vec::new());
            let encoder = JpegEncoder::new_with_quality(&mut buf, quality);
            rgb.write_with_encoder(encoder).map_err(|e| e.to_string())?;
            Ok(buf.into_inner().len() as u64)
        }
        _ => {
            let mut buf = Cursor::new(Vec::new());
            img.write_to(&mut buf, image::ImageFormat::Png).map_err(|e| e.to_string())?;
            Ok(buf.into_inner().len() as u64)
        }
    }
}

#[tauri::command]
pub fn convert_format(
    input_path: String,
    output_path: String,
) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let ext = get_extension(&output_path).to_uppercase();
    img.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult {
        success: true,
        output_path: Some(output_path),
        message: format!("Converted to {}", ext),
    })
}

#[tauri::command]
pub fn convert_heic(input_path: String, output_path: String) -> Result<ToolResult, String> {
    // HEIC support depends on system libraries; attempt via image crate
    match image::open(&input_path) {
        Ok(img) => {
            img.save(&output_path).map_err(|e| format!("HEIC decoding not supported on this system: {}", e))?;
            Ok(ToolResult { success: true, output_path: Some(output_path), message: "HEIC converted".into() })
        }
        Err(e) => Err(format!("HEIC decoding failed: {}. Install libheif on your system.", e)),
    }
}

#[tauri::command]
pub fn raster_to_svg(input_path: String, output_path: String) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let gray = img.grayscale().to_luma8();
    let (w, h) = gray.dimensions();

    // Simple potrace-like: threshold + generate SVG paths
    let threshold = 128u8;
    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 {} {}">"#,
        w, h, w, h
    );
    svg.push_str(r#"<rect width="100%" height="100%" fill="white"/>"#);

    // Find contours by scanning rows
    for y in 0..h {
        let mut in_path = false;
        let mut path_d = String::new();
        for x in 0..=w {
            let dark = if x < w {
                gray.get_pixel(x, y).0[0] < threshold
            } else {
                false
            };
            if dark && !in_path {
                path_d = format!("M{},{}", x, y);
                in_path = true;
            } else if !dark && in_path {
                path_d.push_str(&format!("L{},{}Z", x, y));
                svg.push_str(&format!(
                    r#"<path d="{}" fill="black"/>"#,
                    path_d
                ));
                in_path = false;
            }
        }
    }

    svg.push_str("</svg>");
    fs::write(&output_path, svg).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "Vectorized to SVG".into() })
}

fn get_extension(path: &str) -> String {
    PathBuf::from(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase()
}
