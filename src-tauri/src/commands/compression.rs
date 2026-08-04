use image_core::{
    convert_format as core_convert, convert_heic as core_heic, raster_to_svg as core_raster_svg,
    compress_image as core_compress,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
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
    if let Some(target) = target_size_kb {
        let mut low = 10u8;
        let mut high = 100u8;
        let mut best_quality = quality;
        let ext = get_extension(&output_path);

        for _ in 0..8 {
            let mid = (low + high) / 2;
            let size = estimate_size(&input_path, mid, &ext)?;
            if size > target as u64 * 1024 {
                high = mid;
            } else {
                low = mid;
                best_quality = mid;
            }
        }
        let result = core_compress(input_path, output_path, best_quality)?;
        Ok(ToolResult {
            success: result.success,
            output_path: result.output_path,
            message: format!("Compressed to ~{}KB (q={})", target, best_quality),
        })
    } else {
        let result = core_compress(input_path, output_path, quality)?;
        Ok(ToolResult {
            success: result.success,
            output_path: result.output_path,
            message: result.message,
        })
    }
}

#[tauri::command]
pub fn convert_format(input_path: String, output_path: String) -> Result<ToolResult, String> {
    core_convert(input_path, output_path).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn convert_heic(input_path: String, output_path: String) -> Result<ToolResult, String> {
    core_heic(input_path, output_path).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn raster_to_svg(input_path: String, output_path: String) -> Result<ToolResult, String> {
    core_raster_svg(input_path, output_path).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

fn estimate_size(input_path: &str, quality: u8, ext: &str) -> Result<u64, String> {
    let img = image::open(input_path).map_err(|e| e.to_string())?;
    match ext {
        "jpg" | "jpeg" => {
            let rgb = img.to_rgb8();
            let mut buf = std::io::Cursor::new(Vec::new());
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
            rgb.write_with_encoder(encoder).map_err(|e| e.to_string())?;
            Ok(buf.into_inner().len() as u64)
        }
        _ => {
            let mut buf = std::io::Cursor::new(Vec::new());
            img.write_to(&mut buf, image::ImageFormat::Png).map_err(|e| e.to_string())?;
            Ok(buf.into_inner().len() as u64)
        }
    }
}

fn get_extension(path: &str) -> String {
    PathBuf::from(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase()
}