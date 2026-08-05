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
pub mod video_tools;

use image_core::{compress_image as core_compress, process_image as core_process};
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
    let result = core_compress(input_path, output_path, quality)?;
    Ok(ImageProcessResult {
        success: result.success,
        output_path: result.output_path,
        message: result.message,
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
    let result = core_process(input_path, output_path, operation, params)?;
    Ok(ImageProcessResult {
        success: result.success,
        output_path: result.output_path,
        message: result.message,
    })
}