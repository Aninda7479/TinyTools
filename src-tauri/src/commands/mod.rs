pub mod ai_tools;
pub mod batch;
pub mod compression;
pub mod editing;
pub mod encoder;
pub mod encryption;
pub mod hasher;
pub mod password_tools;
pub mod pdf_tools;
pub mod privacy;

use qrcode::QrCode;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub extension: String,
}

#[derive(Serialize, Deserialize)]
pub struct ImageProcessResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn compress_image(
    input_path: String,
    output_path: String,
    quality: u8,
) -> Result<ImageProcessResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;

    let ext = PathBuf::from(&output_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_string();

    match ext.as_str() {
        "jpg" | "jpeg" => {
            let rgb = img.to_rgb8();
            let mut buf = std::io::Cursor::new(Vec::new());
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
            rgb.write_with_encoder(encoder).map_err(|e| e.to_string())?;
            std::fs::write(&output_path, buf.into_inner()).map_err(|e| e.to_string())?;
        }
        _ => {
            img.save(&output_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(ImageProcessResult {
        success: true,
        output_path: Some(output_path),
        message: "Image compressed successfully".to_string(),
    })
}

#[tauri::command]
pub fn generate_qr_code(data: String, output_path: String) -> Result<ImageProcessResult, String> {
    let code = QrCode::new(data.as_bytes()).map_err(|e| e.to_string())?;

    let image = code
        .render::<image::Luma<u8>>()
        .max_dimensions(256, 256)
        .build();

    image.save(&output_path).map_err(|e| e.to_string())?;

    Ok(ImageProcessResult {
        success: true,
        output_path: Some(output_path),
        message: "QR code generated successfully".to_string(),
    })
}

#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileInfo, String> {
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;

    let name = PathBuf::from(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let extension = PathBuf::from(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();

    Ok(FileInfo {
        name,
        path,
        size: metadata.len(),
        extension,
    })
}

#[tauri::command]
pub fn process_image(
    input_path: String,
    output_path: String,
    operation: String,
    params: Option<String>,
) -> Result<ImageProcessResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let parsed: serde_json::Value = params
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or(serde_json::Value::Null);

    match operation.as_str() {
        "resize" => {
            let max_w = parsed["width"].as_u64().unwrap_or(800) as u32;
            let max_h = parsed["height"].as_u64().unwrap_or(800) as u32;
            let resized = img.resize(max_w, max_h, image::imageops::FilterType::Lanczos3);
            resized.save(&output_path).map_err(|e| e.to_string())?;
        }
        "grayscale" => {
            let gray = img.grayscale();
            gray.save(&output_path).map_err(|e| e.to_string())?;
        }
        "rotate" => {
            let degrees = parsed["degrees"].as_u64().unwrap_or(90);
            let rotated = match degrees % 360 {
                90 => img.rotate90(),
                180 => img.rotate180(),
                270 => img.rotate270(),
                _ => img.rotate90(),
            };
            rotated.save(&output_path).map_err(|e| e.to_string())?;
        }
        "flip" => {
            let direction = parsed["direction"].as_str().unwrap_or("horizontal");
            let flipped = if direction == "vertical" { img.flipv() } else { img.fliph() };
            flipped.save(&output_path).map_err(|e| e.to_string())?;
        }
        "blur" => {
            let sigma = parsed["sigma"].as_f64().unwrap_or(3.0) as f32;
            let blurred = img.blur(sigma);
            blurred.save(&output_path).map_err(|e| e.to_string())?;
        }
        "sharpen" => {
            let amount = parsed["amount"].as_f64().unwrap_or(1.0) as f32;
            let radius = parsed["radius"].as_i64().unwrap_or(1) as u32;
            let sharpened = img.unsharpen(amount, radius as i32);
            sharpened.save(&output_path).map_err(|e| e.to_string())?;
        }
        _ => {
            return Ok(ImageProcessResult {
                success: false,
                output_path: None,
                message: format!("Unknown operation: {}", operation),
            });
        }
    }

    Ok(ImageProcessResult {
        success: true,
        output_path: Some(output_path),
        message: format!("Operation '{}' completed successfully", operation),
    })
}
