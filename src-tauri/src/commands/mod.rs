pub mod ai_tools;
pub mod batch;
pub mod compression;
pub mod editing;
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
    _params: Option<String>,
) -> Result<ImageProcessResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;

    match operation.as_str() {
        "resize" => {
            let resized = img.resize(800, 800, image::imageops::FilterType::Lanczos3);
            resized.save(&output_path).map_err(|e| e.to_string())?;
        }
        "grayscale" => {
            let gray = img.grayscale();
            gray.save(&output_path).map_err(|e| e.to_string())?;
        }
        "rotate" => {
            let rotated = img.rotate90();
            rotated.save(&output_path).map_err(|e| e.to_string())?;
        }
        "flip" => {
            let flipped = img.fliph();
            flipped.save(&output_path).map_err(|e| e.to_string())?;
        }
        "blur" => {
            let blurred = img.blur(3.0);
            blurred.save(&output_path).map_err(|e| e.to_string())?;
        }
        "sharpen" => {
            let sharpened = img.unsharpen(1.0, 1);
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
