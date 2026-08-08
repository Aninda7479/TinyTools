use image_core::{
    add_image_watermark as core_add_img_wm, add_watermark as core_add_wm,
    redact_regions as core_redact, strip_metadata as core_strip,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use img_parts::{jpeg::Jpeg, ImageEXIF, ImageICC};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub message: String,
}

#[derive(Serialize, Deserialize)]
pub struct MetadataResult {
    pub success: bool,
    pub metadata: HashMap<String, String>,
    pub message: String,
}

#[tauri::command]
pub fn read_metadata(input_path: String) -> Result<MetadataResult, String> {
    let file = fs::File::open(&input_path).map_err(|e| e.to_string())?;
    let mut reader = std::io::BufReader::new(&file);
    let exif = exif::Reader::new()
        .read_from_container(&mut reader)
        .map_err(|e| e.to_string());
        
    let mut metadata = HashMap::new();
    
    match exif {
        Ok(exif_data) => {
            for f in exif_data.fields() {
                let tag = f.tag.to_string();
                let value = f.display_value().with_unit(&exif_data).to_string();
                metadata.insert(tag, value);
            }
            Ok(MetadataResult {
                success: true,
                metadata,
                message: "Metadata extracted".into(),
            })
        }
        Err(_) => {
            Ok(MetadataResult {
                success: true,
                metadata,
                message: "No EXIF metadata found".into(),
            })
        }
    }
}

#[tauri::command]
pub fn strip_metadata(input_path: String, output_path: String) -> Result<ToolResult, String> {
    core_strip(input_path, output_path).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn redact_regions(
    input_path: String,
    output_path: String,
    regions: Vec<(u32, u32, u32, u32)>,
    method: String,
) -> Result<ToolResult, String> {
    core_redact(input_path, output_path, regions, method).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn add_watermark(
    input_path: String,
    output_path: String,
    text: String,
    opacity: u8,
    position: String,
) -> Result<ToolResult, String> {
    core_add_wm(input_path, output_path, text, opacity, position).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn add_image_watermark(
    input_path: String,
    watermark_path: String,
    output_path: String,
    opacity: u8,
    scale: f32,
    position: Option<String>,
) -> Result<ToolResult, String> {
    core_add_img_wm(input_path, watermark_path, output_path, opacity, scale, position).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}