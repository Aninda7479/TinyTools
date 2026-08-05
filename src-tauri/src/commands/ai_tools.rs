use image_core::{
    depth_blur as core_depth_blur, inpaint_image as core_inpaint, remove_background as core_remove_bg,
    sepia_filter as core_sepia, smart_sharpen as core_sharpen, upscale_image as core_upscale,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn remove_background(input_path: String, output_path: String) -> Result<ToolResult, String> {
    core_remove_bg(input_path, output_path).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn inpaint_image(
    input_path: String,
    output_path: String,
    regions: Vec<(u32, u32, u32, u32)>,
) -> Result<ToolResult, String> {
    core_inpaint(input_path, output_path, regions).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn upscale_image(input_path: String, output_path: String, scale: u32) -> Result<ToolResult, String> {
    core_upscale(input_path, output_path, scale).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn sepia_filter(input_path: String, output_path: String) -> Result<ToolResult, String> {
    core_sepia(input_path, output_path).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn smart_sharpen(input_path: String, output_path: String, strength: f32) -> Result<ToolResult, String> {
    core_sharpen(input_path, output_path, strength).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}

#[tauri::command]
pub fn depth_blur(input_path: String, output_path: String, blur_strength: f32) -> Result<ToolResult, String> {
    core_depth_blur(input_path, output_path, blur_strength).map(|r| ToolResult {
        success: r.success,
        output_path: r.output_path,
        message: r.message,
    })
}