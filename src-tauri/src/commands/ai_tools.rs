use image::{GenericImageView, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn remove_background(input_path: String, output_path: String) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let mut out = RgbaImage::new(w, h);

    // ── Step 1: Sample background color from all edges ──
    let mut bg_r: Vec<u8> = Vec::new();
    let mut bg_g: Vec<u8> = Vec::new();
    let mut bg_b: Vec<u8> = Vec::new();

    let border = 8u32;
    // Top and bottom edges
    for x in 0..w {
        for d in 0..border {
            if d >= h { break; }
            let pt = *rgba.get_pixel(x, d);
            bg_r.push(pt[0]); bg_g.push(pt[1]); bg_b.push(pt[2]);
            let pb = *rgba.get_pixel(x, h - 1 - d);
            bg_r.push(pb[0]); bg_g.push(pb[1]); bg_b.push(pb[2]);
        }
    }
    // Left and right edges
    for y in 0..h {
        for d in 0..border {
            if d >= w { break; }
            let pl = *rgba.get_pixel(d, y);
            bg_r.push(pl[0]); bg_g.push(pl[1]); bg_b.push(pl[2]);
            let pr = *rgba.get_pixel(w - 1 - d, y);
            bg_r.push(pr[0]); bg_g.push(pr[1]); bg_b.push(pr[2]);
        }
    }

    bg_r.sort_unstable();
    bg_g.sort_unstable();
    bg_b.sort_unstable();
    let mid = bg_r.len() / 2;
    let bg_color = [bg_r[mid], bg_g[mid], bg_b[mid]];

    // ── Step 2: Compute per-pixel distance to background ──
    let mut dist_map: Vec<f64> = Vec::with_capacity((w * h) as usize);
    let mut max_dist: f64 = 0.0;

    for y in 0..h {
        for x in 0..w {
            let p = *rgba.get_pixel(x, y);
            let d = perceptual_dist(p, bg_color);
            dist_map.push(d);
            if d > max_dist { max_dist = d; }
        }
    }

    // Avoid division by zero
    if max_dist < 1.0 { max_dist = 1.0; }

    // ── Step 3: Adaptive thresholding with Otsu-like method ──
    // Build histogram of distances
    let bins = 256usize;
    let mut hist = vec![0u32; bins];
    for &d in &dist_map {
        let bin = ((d / max_dist) * (bins as f64 - 1.0)) as usize;
        hist[bin] += 1;
    }
    let total = dist_map.len() as f64;

    // Otsu's method: find threshold that maximizes inter-class variance
    let mut sum_all: f64 = 0.0;
    for i in 0..bins { sum_all += i as f64 * hist[i] as f64; }
    let mut sum_bg: f64 = 0.0;
    let mut w_bg: f64 = 0.0;
    let mut best_thresh = 0usize;
    let mut best_var: f64 = 0.0;
    for i in 0..bins {
        w_bg += hist[i] as f64;
        if w_bg < 1.0 { continue; }
        let w_fg = total - w_bg;
        if w_fg < 1.0 { break; }
        sum_bg += i as f64 * hist[i] as f64;
        let mean_bg = sum_bg / w_bg;
        let mean_fg = (sum_all - sum_bg) / w_fg;
        let variance = w_bg * w_fg * (mean_bg - mean_fg).powi(2);
        if variance > best_var {
            best_var = variance;
            best_thresh = i;
        }
    }

    // The threshold in normalized distance space
    let otsu_threshold = best_thresh as f64 / (bins as f64 - 1.0);

    // ── Step 4: Generate alpha mask with smooth transition ──
    // Foreground = high distance, background = low distance
    // We want background (low dist) to be transparent
    let transition_width = 0.15; // 15% of range for smooth transition

    let mut fg_mask: Vec<bool> = vec![false; (w * h) as usize];
    let mut fg_queue: std::collections::VecDeque<(u32, u32)> = std::collections::VecDeque::new();

    for y in 0..h {
        for x in 0..w {
            let i = (y * w + x) as usize;
            let norm_dist = dist_map[i] / max_dist;
            // Use Otsu threshold with some margin — only definitely-foreground pixels are seeds
            if norm_dist > otsu_threshold + 0.05 {
                fg_mask[i] = true;
                if x > 0 && x < w - 1 && y > 0 && y < h - 1 {
                    fg_queue.push_back((x, y));
                }
            }
        }
    }

    // Expand foreground mask via BFS using gradient similarity
    while let Some((x, y)) = fg_queue.pop_front() {
        let dirs: [(i32, i32); 8] = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)];
        let parent = *rgba.get_pixel(x, y);
        for &(dx, dy) in &dirs {
            let nx = x as i32 + dx;
            let ny = y as i32 + dy;
            if nx < 0 || ny < 0 || nx >= w as i32 || ny >= h as i32 { continue; }
            let nx = nx as u32;
            let ny = ny as u32;
            let ni = (ny * w + nx) as usize;
            if fg_mask[ni] { continue; }
            let p = *rgba.get_pixel(nx, ny);
            let norm_dist = dist_map[ni] / max_dist;
            // Accept if: (a) reasonably far from bg, or (b) very similar to known foreground neighbor
            let dist_to_parent = perceptual_dist(p, [parent[0], parent[1], parent[2]]);
            let is_similar_to_fg = dist_to_parent < 40.0;
            let is_not_bg = norm_dist > otsu_threshold - 0.1;
            if is_not_bg || is_similar_to_fg {
                fg_mask[ni] = true;
                fg_queue.push_back((nx, ny));
            }
        }
    }

    // ── Step 5: Generate output with feathered alpha ──
    for y in 0..h {
        for x in 0..w {
            let i = (y * w + x) as usize;
            let pixel = *rgba.get_pixel(x, y);
            let norm_dist = dist_map[i] / max_dist;

            let alpha = if fg_mask[i] {
                255u8
            } else {
                // Smooth transition zone
                let lo = otsu_threshold - transition_width;
                let hi = otsu_threshold;
                if norm_dist <= lo {
                    0 // Definitely background
                } else if norm_dist >= hi {
                    // In transition zone — smooth ramp
                    let t = (norm_dist - lo) / (hi - lo);
                    (t * 255.0).min(255.0) as u8
                } else {
                    // Very close to threshold — soft edge
                    let t = (norm_dist - lo) / (hi - lo);
                    (t * 200.0).min(200.0) as u8
                }
            };

            out.put_pixel(x, y, Rgba([pixel[0], pixel[1], pixel[2], alpha]));
        }
    }

    // ── Step 6: Edge cleanup — remove isolated foreground specks ──
    for y in 1..h-1 {
        for x in 1..w-1 {
            let alpha = out.get_pixel(x, y)[3];
            if alpha > 128 {
                // Count transparent neighbors
                let mut transparent = 0;
                for dy in -1i32..=1 {
                    for dx in -1i32..=1 {
                        if dx == 0 && dy == 0 { continue; }
                        let nx = (x as i32 + dx) as u32;
                        let ny = (y as i32 + dy) as u32;
                        if out.get_pixel(nx, ny)[3] < 128 { transparent += 1; }
                    }
                }
                if transparent >= 6 {
                    // Isolated speck — make transparent
                    out.put_pixel(x, y, Rgba([0, 0, 0, 0]));
                }
            }
        }
    }

    out.save(&output_path).map_err(|e| e.to_string())?;

    let fg_pixels = fg_mask.iter().filter(|&&b| b).count();
    let total_pixels = (w * h) as usize;
    let pct = (fg_pixels as f64 / total_pixels as f64 * 100.0) as u32;
    let msg = format!("Background removed — {}% foreground (bg: [{},{},{}], otsu: {:.2})",
        pct, bg_color[0], bg_color[1], bg_color[2], otsu_threshold);
    Ok(ToolResult { success: true, output_path: Some(output_path), message: msg })
}

fn perceptual_dist(p: Rgba<u8>, bg: [u8; 3]) -> f64 {
    // Weighted Euclidean (Rec. 709 luminance weighting)
    let dr = p[0] as f64 - bg[0] as f64;
    let dg = p[1] as f64 - bg[1] as f64;
    let db = p[2] as f64 - bg[2] as f64;
    (0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db).sqrt()
}

#[tauri::command]
pub fn inpaint_image(
    input_path: String,
    output_path: String,
    regions: Vec<(u32, u32, u32, u32)>,
) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let mut rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    for (rx, ry, rw, rh) in regions {
        let mut sum_r: u64 = 0;
        let mut sum_g: u64 = 0;
        let mut sum_b: u64 = 0;
        let mut count: u64 = 0;
        let border = 8u32;

        for sy in ry.saturating_sub(border)..(ry + rh + border).min(h) {
            for sx in rx.saturating_sub(border)..(rx + rw + border).min(w) {
                if sx >= rx && sx < rx + rw && sy >= ry && sy < ry + rh { continue; }
                let p = *rgba.get_pixel(sx, sy);
                sum_r += p[0] as u64;
                sum_g += p[1] as u64;
                sum_b += p[2] as u64;
                count += 1;
            }
        }

        if count > 0 {
            let avg = [(sum_r / count) as u8, (sum_g / count) as u8, (sum_b / count) as u8];
            for y in ry..(ry + rh).min(h) {
                for x in rx..(rx + rw).min(w) {
                    let dx_edge = (x as i32 - rx as i32).min((rx + rw) as i32 - x as i32 - 1) as f64;
                    let dy_edge = (y as i32 - ry as i32).min((ry + rh) as i32 - y as i32 - 1) as f64;
                    let edge_dist = dx_edge.min(dy_edge).min(border as f64);
                    let blend = (edge_dist / border as f64).min(1.0);
                    let p = *rgba.get_pixel(x, y);
                    let nr = (p[0] as f64 * (1.0 - blend) + avg[0] as f64 * blend) as u8;
                    let ng = (p[1] as f64 * (1.0 - blend) + avg[1] as f64 * blend) as u8;
                    let nb = (p[2] as f64 * (1.0 - blend) + avg[2] as f64 * blend) as u8;
                    rgba.put_pixel(x, y, Rgba([nr, ng, nb, 255]));
                }
            }
        }
    }

    rgba.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "Inpainting completed".into() })
}

#[tauri::command]
pub fn upscale_image(input_path: String, output_path: String, scale: u32) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    let new_w = w * scale;
    let new_h = h * scale;
    let upscaled = img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3);
    let sharpened = upscaled.unsharpen(1.0, 1);
    sharpened.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: format!("Upscaled {}x ({}x{} -> {}x{})", scale, w, h, new_w, new_h) })
}

#[tauri::command]
pub fn colorize_image(input_path: String, output_path: String) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let gray = img.grayscale();
    let rgba = gray.to_rgba8();
    let (w, h) = rgba.dimensions();
    let mut out = RgbaImage::new(w, h);

    for y in 0..h {
        for x in 0..w {
            let p = *rgba.get_pixel(x, y);
            let v = p[0] as f64 / 255.0;
            let r = (v * 255.0 * 1.1).min(255.0) as u8;
            let g = (v * 255.0 * 0.9).min(255.0) as u8;
            let b = (v * 255.0 * 0.7).min(255.0) as u8;
            out.put_pixel(x, y, Rgba([r, g, b, 255]));
        }
    }

    out.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "Colorization applied".into() })
}

#[tauri::command]
pub fn face_enhance(input_path: String, output_path: String, strength: f32) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let denoised = img.blur(strength * 0.5);
    let enhanced = denoised.unsharpen(strength, 1);
    enhanced.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "Face enhancement applied".into() })
}

#[tauri::command]
pub fn depth_blur(input_path: String, output_path: String, blur_strength: f32) -> Result<ToolResult, String> {
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    let blurred = img.blur(blur_strength);
    let mut out = img.to_rgba8();
    let blurred_rgba = blurred.to_rgba8();
    let cx = w as f64 / 2.0;
    let cy = h as f64 / 2.0;
    let max_dist = (cx * cx + cy * cy).sqrt();

    for y in 0..h {
        for x in 0..w {
            let dx = x as f64 - cx;
            let dy = y as f64 - cy;
            let dist = (dx * dx + dy * dy).sqrt() / max_dist;
            let blend = (dist * 1.5).min(1.0);
            let sharp = *out.get_pixel(x, y);
            let blur_p = *blurred_rgba.get_pixel(x, y);
            let r = (sharp[0] as f64 * (1.0 - blend) + blur_p[0] as f64 * blend) as u8;
            let g = (sharp[1] as f64 * (1.0 - blend) + blur_p[1] as f64 * blend) as u8;
            let b = (sharp[2] as f64 * (1.0 - blend) + blur_p[2] as f64 * blend) as u8;
            out.put_pixel(x, y, Rgba([r, g, b, sharp[3]]));
        }
    }

    out.save(&output_path).map_err(|e| e.to_string())?;
    Ok(ToolResult { success: true, output_path: Some(output_path), message: "Depth blur applied".into() })
}
