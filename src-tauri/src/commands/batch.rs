use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone)]
pub struct BatchResult {
    pub success: bool,
    pub processed: u32,
    pub failed: u32,
    pub output_dir: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BatchProgress {
    pub current: u32,
    pub total: u32,
    pub file_name: String,
    pub operation: String,
}

fn emit_progress(app: &AppHandle, current: u32, total: u32, file_name: &str, operation: &str) {
    let _ = app.emit("batch-progress", BatchProgress {
        current,
        total,
        file_name: file_name.to_string(),
        operation: operation.to_string(),
    });
}

fn file_stem(path: &str) -> String {
    PathBuf::from(path)
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("output")
        .to_string()
}

fn file_ext(path: &str) -> String {
    PathBuf::from(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_string()
}

fn file_name(path: &str) -> String {
    PathBuf::from(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string()
}

#[tauri::command]
pub fn batch_compress(
    app: AppHandle,
    input_paths: Vec<String>,
    output_dir: String,
    quality: u8,
    target_size_kb: Option<u32>,
) -> Result<BatchResult, String> {
    let total = input_paths.len() as u32;
    let counter = AtomicU32::new(0);

    let results: Vec<Result<String, String>> = input_paths
        .par_iter()
        .map(|path| {
            let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
            let name = file_name(path);
            emit_progress(&app, current, total, &name, "compress");

            let img = image::open(path).map_err(|e| e.to_string())?;
            let stem = file_stem(path);
            let out_path = format!("{}/{}_compressed.jpg", output_dir, stem);

            if let Some(target) = target_size_kb {
                let mut low = 10u8;
                let mut high = 100u8;
                let mut best = quality;
                for _ in 0..8 {
                    let mid = (low + high) / 2;
                    let rgb = img.to_rgb8();
                    let mut buf = std::io::Cursor::new(Vec::new());
                    let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, mid);
                    rgb.write_with_encoder(enc).map_err(|e| e.to_string())?;
                    let size = buf.into_inner().len() as u64;
                    if size > target as u64 * 1024 {
                        high = mid;
                    } else {
                        low = mid;
                        best = mid;
                    }
                }
                let rgb = img.to_rgb8();
                let mut buf = std::io::Cursor::new(Vec::new());
                let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, best);
                rgb.write_with_encoder(enc).map_err(|e| e.to_string())?;
                std::fs::write(&out_path, buf.into_inner()).map_err(|e| e.to_string())?;
            } else {
                let rgb = img.to_rgb8();
                let mut buf = std::io::Cursor::new(Vec::new());
                let enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
                rgb.write_with_encoder(enc).map_err(|e| e.to_string())?;
                std::fs::write(&out_path, buf.into_inner()).map_err(|e| e.to_string())?;
            }

            Ok(out_path)
        })
        .collect();

    let processed = results.iter().filter(|r| r.is_ok()).count() as u32;
    let failed = total - processed;

    Ok(BatchResult {
        success: failed == 0,
        processed,
        failed,
        output_dir,
        message: format!("Compressed {}/{} files", processed, total),
    })
}

#[tauri::command]
pub fn batch_resize(
    app: AppHandle,
    input_paths: Vec<String>,
    output_dir: String,
    width: u32,
    height: u32,
) -> Result<BatchResult, String> {
    let total = input_paths.len() as u32;
    let counter = AtomicU32::new(0);

    let results: Vec<Result<String, String>> = input_paths
        .par_iter()
        .map(|path| {
            let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
            let name = file_name(path);
            emit_progress(&app, current, total, &name, "resize");

            let img = image::open(path).map_err(|e| e.to_string())?;
            let stem = file_stem(path);
            let ext = file_ext(path);

            let resized = img.resize(width, height, image::imageops::FilterType::Lanczos3);
            let out_path = format!("{}/{}_resized.{}", output_dir, stem, ext);
            resized.save(&out_path).map_err(|e| e.to_string())?;
            Ok(out_path)
        })
        .collect();

    let processed = results.iter().filter(|r| r.is_ok()).count() as u32;
    Ok(BatchResult {
        success: processed == total,
        processed,
        failed: total - processed,
        output_dir,
        message: format!("Resized {}/{} files", processed, total),
    })
}

#[tauri::command]
pub fn batch_convert(
    app: AppHandle,
    input_paths: Vec<String>,
    output_dir: String,
    target_format: String,
) -> Result<BatchResult, String> {
    let total = input_paths.len() as u32;
    let counter = AtomicU32::new(0);

    let results: Vec<Result<String, String>> = input_paths
        .par_iter()
        .map(|path| {
            let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
            let name = file_name(path);
            emit_progress(&app, current, total, &name, "convert");

            let img = image::open(path).map_err(|e| e.to_string())?;
            let stem = file_stem(path);

            let out_path = format!("{}/{}.{}", output_dir, stem, target_format);
            img.save(&out_path).map_err(|e| e.to_string())?;
            Ok(out_path)
        })
        .collect();

    let processed = results.iter().filter(|r| r.is_ok()).count() as u32;
    Ok(BatchResult {
        success: processed == total,
        processed,
        failed: total - processed,
        output_dir,
        message: format!("Converted {}/{} files to {}", processed, total, target_format),
    })
}

#[tauri::command]
pub fn batch_watermark(
    app: AppHandle,
    input_paths: Vec<String>,
    output_dir: String,
    text: String,
    opacity: u8,
) -> Result<BatchResult, String> {
    let total = input_paths.len() as u32;
    let counter = AtomicU32::new(0);

    let results: Vec<Result<String, String>> = input_paths
        .par_iter()
        .map(|path| {
            let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
            let name = file_name(path);
            emit_progress(&app, current, total, &name, "watermark");

            let img = image::open(path).map_err(|e| e.to_string())?;
            let mut rgba = img.to_rgba8();
            let (w, h) = rgba.dimensions();
            let stem = file_stem(path);

            let block_w = (text.len() as u32) * 8;
            let block_h = 12u32;
            let bx = w.saturating_sub(block_w + 10);
            let by = h.saturating_sub(block_h + 10);

            for y in by..(by + block_h).min(h) {
                for x in bx..(bx + block_w).min(w) {
                    let p = *rgba.get_pixel(x, y);
                    let blend = opacity as f64 / 255.0;
                    let r = (p[0] as f64 * (1.0 - blend) + 255.0 * blend) as u8;
                    let g = (p[1] as f64 * (1.0 - blend) + 255.0 * blend) as u8;
                    let b = (p[2] as f64 * (1.0 - blend) + 255.0 * blend) as u8;
                    rgba.put_pixel(x, y, image::Rgba([r, g, b, 255]));
                }
            }

            let out_path = format!("{}/{}_watermarked.png", output_dir, stem);
            rgba.save(&out_path).map_err(|e| e.to_string())?;
            Ok(out_path)
        })
        .collect();

    let processed = results.iter().filter(|r| r.is_ok()).count() as u32;
    Ok(BatchResult {
        success: processed == total,
        processed,
        failed: total - processed,
        output_dir,
        message: format!("Watermarked {}/{} files", processed, total),
    })
}
