use image_core::{
    expand_canvas as core_expand, smart_crop as core_crop, split_image as core_split,
    stitch_images as core_stitch,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn smart_crop(
    input_path: String,
    output_path: String,
    width: u32,
    height: u32,
    gravity: String,
) -> Result<ToolResult, String> {
    core_crop(input_path, output_path, width, height, gravity).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn expand_canvas(
    input_path: String,
    output_path: String,
    top: u32,
    bottom: u32,
    left: u32,
    right: u32,
    color: String,
) -> Result<ToolResult, String> {
    core_expand(input_path, output_path, top, bottom, left, right, color).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn split_image(
    input_path: String,
    output_dir: String,
    rows: u32,
    cols: u32,
) -> Result<ToolResult, String> {
    core_split(input_path, output_dir, rows, cols).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn stitch_images(
    paths: Vec<String>,
    output_path: String,
    direction: String,
) -> Result<ToolResult, String> {
    core_stitch(paths, output_path, direction).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}