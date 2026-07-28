use std::process::Command;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfo {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub audio_codec: String,
    pub bitrate: u64,
    pub fps: f64,
    pub file_size: u64,
    pub format: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output_path: String,
    pub message: String,
}

fn ffmpeg() -> String {
    "ffmpeg".to_string()
}

fn ffprobe() -> String {
    "ffprobe".to_string()
}

fn run_cmd(cmd: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(cmd)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run {}: {}", cmd, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(format!("{} failed: {}", cmd, stderr));
    }

    Ok(stdout + &stderr)
}

fn out_path(input: &str, suffix: &str, ext: &str) -> String {
    let p = Path::new(input);
    let stem = p.file_stem().unwrap_or_default().to_string_lossy();
    let dir = p.parent().unwrap_or(Path::new("."));
    format!("{}/{}_{}.{}", dir.display(), stem, suffix, ext)
}

// ─── Info ──────────────────────────────────────────────────────

#[tauri::command]
pub fn get_video_info(input: String) -> Result<ToolResult, String> {
    let json = run_cmd(&ffprobe(), &[
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        &input,
    ])?;

    let val: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| format!("Parse error: {}", e))?;

    let fmt = &val["format"];
    let video_stream = val["streams"].as_array()
        .and_then(|s| s.iter().find(|s| s["codec_type"].as_str() == Some("video")));
    let audio_stream = val["streams"].as_array()
        .and_then(|s| s.iter().find(|s| s["codec_type"].as_str() == Some("audio")));

    let duration = fmt["duration"].as_str().unwrap_or("0").parse::<f64>().unwrap_or(0.0);
    let width = video_stream.as_ref().and_then(|v| v["width"].as_u64()).unwrap_or(0) as u32;
    let height = video_stream.as_ref().and_then(|v| v["height"].as_u64()).unwrap_or(0) as u32;
    let codec = video_stream.as_ref().and_then(|v| v["codec_name"].as_str()).unwrap_or("unknown").to_string();
    let audio_codec = audio_stream.as_ref().and_then(|a| a["codec_name"].as_str()).unwrap_or("none").to_string();
    let bitrate = fmt["bit_rate"].as_str().unwrap_or("0").parse::<u64>().unwrap_or(0);
    let fps_str = video_stream.as_ref()
        .and_then(|v| v["r_frame_rate"].as_str())
        .unwrap_or("0/1");
    let fps = parse_fps(fps_str);
    let file_size = fmt["size"].as_str().unwrap_or("0").parse::<u64>().unwrap_or(0);
    let format = fmt["format_name"].as_str().unwrap_or("unknown").to_string();

    let info = VideoInfo { duration, width, height, codec, audio_codec, bitrate, fps, file_size, format };
    let msg = serde_json::to_string_pretty(&info).unwrap_or_default();

    Ok(ToolResult { success: true, output_path: input, message: msg })
}

fn parse_fps(s: &str) -> f64 {
    let parts: Vec<&str> = s.split('/').collect();
    if parts.len() == 2 {
        let num: f64 = parts[0].parse().unwrap_or(0.0);
        let den: f64 = parts[1].parse().unwrap_or(1.0);
        if den > 0.0 { return num / den; }
    }
    s.parse().unwrap_or(0.0)
}

// ─── Compression & Resizing ────────────────────────────────────

#[tauri::command]
pub fn compress_video(input: String, quality: u32, target_size_kb: Option<u32>) -> Result<ToolResult, String> {
    let output = out_path(&input, "compressed", "mp4");

    let bitrate_str;
    let crf_str;

    let mut args: Vec<&str> = vec!["-y", "-i", &input];

    if let Some(target_kb) = target_size_kb {
        let info = get_video_info(input.clone())?;
        let val: serde_json::Value = serde_json::from_str(&info.message).unwrap_or_default();
        let duration = val["duration"].as_f64().unwrap_or(60.0);
        let target_bits = (target_kb as f64) * 1024.0 * 8.0;
        let video_bitrate = (target_bits / duration - 128000.0).max(10000.0);
        let video_kbps = (video_bitrate / 1000.0).round() as u64;
        bitrate_str = format!("{}k", video_kbps);
        args.extend_from_slice(&["-b:v", &bitrate_str]);
    } else {
        let crf = 51 - (quality as i32 * 35 / 100);
        crf_str = crf.to_string();
        args.extend_from_slice(&["-crf", &crf_str]);
    }

    args.extend_from_slice(&[
        "-preset", "medium",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        &output,
    ]);

    run_cmd(&ffmpeg(), &args)?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Compressed to {}", output) })
}

#[tauri::command]
pub fn resize_video(input: String, width: u32, height: u32) -> Result<ToolResult, String> {
    let output = out_path(&input, "resized", "mp4");
    let w = if width % 2 == 0 { width } else { width + 1 };
    let h = if height % 2 == 0 { height } else { height + 1 };
    run_cmd(&ffmpeg(), &[
        "-y", "-i", &input,
        "-vf", &format!("scale={}:{}", w, h),
        "-c:v", "libx264", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Resized to {}x{}", w, h) })
}

#[tauri::command]
pub fn convert_aspect_ratio(input: String, target: String) -> Result<ToolResult, String> {
    let output = out_path(&input, "aspect", "mp4");
    let vf = match target.as_str() {
        "9:16" => "crop=ih*9/16:ih,scale=1080:1920,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
        "1:1" => "crop=min(iw\\,ih):min(iw\\,ih),scale=1080:1080",
        "16:9" => "crop=min(iw\\,ih*16/9):min(iw\\,ih*16/9),scale=1920:1080",
        "4:5" => "crop=ih*4/5:ih,scale=1080:1350",
        _ => return Err(format!("Unknown aspect ratio: {}", target)),
    };
    run_cmd(&ffmpeg(), &[
        "-y", "-i", &input,
        "-vf", vf,
        "-c:v", "libx264", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Converted to {} aspect", target) })
}

// ─── Editing & Cutting ─────────────────────────────────────────

#[tauri::command]
pub fn trim_video(input: String, start: f64, end: f64) -> Result<ToolResult, String> {
    let output = out_path(&input, "trimmed", "mp4");
    let duration = end - start;
    run_cmd(&ffmpeg(), &[
        "-y", "-ss", &start.to_string(),
        "-i", &input,
        "-t", &duration.to_string(),
        "-c", "copy",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Trimmed {:.1}s - {:.1}s", start, end) })
}

#[tauri::command]
pub fn merge_videos(inputs: Vec<String>, output_dir: String) -> Result<ToolResult, String> {
    let output = format!("{}/merged.mp4", output_dir);
    let concat_file = format!("{}/concat.txt", output_dir);
    let content: String = inputs.iter()
        .map(|p| format!("file '{}'", p.replace('\'', "'\\''")))
        .collect::<Vec<_>>()
        .join("\n");
    std::fs::write(&concat_file, &content).map_err(|e| e.to_string())?;
    run_cmd(&ffmpeg(), &[
        "-y", "-f", "concat", "-safe", "0",
        "-i", &concat_file,
        "-c", "copy",
        "-movflags", "+faststart",
        &output,
    ])?;
    let _ = std::fs::remove_file(&concat_file);
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Merged {} videos", inputs.len()) })
}

#[tauri::command]
pub fn crop_video(input: String, x: u32, y: u32, width: u32, height: u32) -> Result<ToolResult, String> {
    let output = out_path(&input, "cropped", "mp4");
    let w = if width % 2 == 0 { width } else { width + 1 };
    let h = if height % 2 == 0 { height } else { height + 1 };
    run_cmd(&ffmpeg(), &[
        "-y", "-i", &input,
        "-vf", &format!("crop={}:{}:{}:{}", w, h, x, y),
        "-c:v", "libx264", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Cropped to {}x{} at ({},{})", w, h, x, y) })
}

#[tauri::command]
pub fn rotate_video(input: String, angle: u32) -> Result<ToolResult, String> {
    let output = out_path(&input, "rotated", "mp4");
    let vf = match angle {
        90 => "transpose=1",
        180 => "transpose=1,transpose=1",
        270 => "transpose=2",
        _ => return Err(format!("Invalid angle: {}. Use 90, 180, or 270", angle)),
    };
    run_cmd(&ffmpeg(), &[
        "-y", "-i", &input,
        "-vf", vf,
        "-c:v", "libx264", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Rotated {}°", angle) })
}

#[tauri::command]
pub fn mirror_video(input: String, direction: String) -> Result<ToolResult, String> {
    let output = out_path(&input, "mirrored", "mp4");
    let vf = match direction.as_str() {
        "horizontal" => "hflip",
        "vertical" => "vflip",
        _ => return Err(format!("Invalid direction: {}. Use 'horizontal' or 'vertical'", direction)),
    };
    run_cmd(&ffmpeg(), &[
        "-y", "-i", &input,
        "-vf", vf,
        "-c:v", "libx264", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Mirrored {}", direction) })
}

// ─── Format Conversion & Audio ─────────────────────────────────

#[tauri::command]
pub fn convert_video_format(input: String, format: String) -> Result<ToolResult, String> {
    let ext = match format.as_str() {
        "mp4" => "mp4", "mkv" => "mkv", "mov" => "mov",
        "webm" => "webm", "avi" => "avi", "flv" => "flv",
        _ => return Err(format!("Unsupported format: {}", format)),
    };
    let output = out_path(&input, "converted", ext);
    let codec = match format.as_str() {
        "webm" => vec!["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0"],
        "avi" => vec!["-c:v", "mpeg4"],
        "flv" => vec!["-c:v", "libx264", "-crf", "23"],
        _ => vec!["-c:v", "libx264", "-crf", "23"],
    };
    let mut args = vec!["-y", "-i", &input];
    args.extend_from_slice(&codec);
    args.extend_from_slice(&["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", &output]);
    run_cmd(&ffmpeg(), &args)?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Converted to {}", format.to_uppercase()) })
}

#[tauri::command]
pub fn extract_audio(input: String, format: String) -> Result<ToolResult, String> {
    let ext = match format.as_str() {
        "mp3" => "mp3", "wav" => "wav", "aac" => "aac", "flac" => "flac", "ogg" => "ogg",
        _ => return Err(format!("Unsupported audio format: {}", format)),
    };
    let output = out_path(&input, "audio", ext);
    let codec = match format.as_str() {
        "mp3" => vec!["-c:a", "libmp3lame", "-b:a", "192k"],
        "wav" => vec!["-c:a", "pcm_s16le"],
        "aac" => vec!["-c:a", "aac", "-b:a", "192k"],
        "flac" => vec!["-c:a", "flac"],
        "ogg" => vec!["-c:a", "libvorbis", "-q:a", "4"],
        _ => vec![],
    };
    let mut args = vec!["-y", "-i", &input, "-vn"];
    args.extend_from_slice(&codec);
    args.push(&output);
    run_cmd(&ffmpeg(), &args)?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Extracted audio as {}", ext.to_uppercase()) })
}

#[tauri::command]
pub fn mute_video(input: String) -> Result<ToolResult, String> {
    let output = out_path(&input, "muted", "mp4");
    run_cmd(&ffmpeg(), &[
        "-y", "-i", &input,
        "-an",
        "-c:v", "copy",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: "Audio removed".to_string() })
}

#[tauri::command]
pub fn replace_audio(video: String, audio: String) -> Result<ToolResult, String> {
    let output = out_path(&video, "new_audio", "mp4");
    run_cmd(&ffmpeg(), &[
        "-y", "-i", &video, "-i", &audio,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-map", "0:v:0", "-map", "1:a:0",
        "-shortest",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: "Audio replaced".to_string() })
}

// ─── GIF & Motion Graphics ─────────────────────────────────────

#[tauri::command]
pub fn video_to_gif(input: String, fps: u32, width: u32) -> Result<ToolResult, String> {
    let output = out_path(&input, "animated", "gif");
    let palette = out_path(&input, "palette", "png");
    let w = if width > 0 { width } else { 480 };
    let fps_str = format!("fps={}", fps.max(1).min(30));

    run_cmd(&ffmpeg(), &[
        "-y", "-i", &input,
        "-vf", &format!("{},scale={}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse", fps_str, w),
        "-loop", "0",
        &output,
    ])?;

    let _ = std::fs::remove_file(&palette);
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Created GIF at {}fps, {}px wide", fps, w) })
}

#[tauri::command]
pub fn gif_to_video(input: String) -> Result<ToolResult, String> {
    let output = out_path(&input, "converted", "mp4");
    run_cmd(&ffmpeg(), &[
        "-y", "-f", "gif", "-i", &input,
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: "GIF converted to MP4".to_string() })
}

// ─── Advanced Utilities ────────────────────────────────────────

#[tauri::command]
pub fn change_speed(input: String, speed: f64) -> Result<ToolResult, String> {
    if speed <= 0.0 || speed > 8.0 {
        return Err("Speed must be between 0.25 and 8.0".to_string());
    }
    let output = out_path(&input, &format!("{}x", speed), "mp4");
    let video_filter = format!("setpts={:.4}*PTS", 1.0 / speed);
    let audio_filter = if speed > 2.0 {
        "atempo=2.0".to_string()
    } else if speed < 0.5 {
        "atempo=0.5".to_string()
    } else {
        format!("atempo={:.4}", speed)
    };
    run_cmd(&ffmpeg(), &[
        "-y", "-i", &input,
        "-filter_complex", &format!("[0:v]{}[v];[0:a]{}[a]", video_filter, audio_filter),
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Speed changed to {}x", speed) })
}

#[tauri::command]
pub fn add_video_watermark(input: String, text: String, position: String, font_size: u32) -> Result<ToolResult, String> {
    let output = out_path(&input, "watermarked", "mp4");
    let pos = match position.as_str() {
        "top-left" => "x=20:y=20",
        "top-right" => "x=w-tw-20:y=20",
        "bottom-left" => "x=20:y=h-th-20",
        "bottom-right" => "x=w-tw-20:y=h-th-20",
        "center" => "x=(w-tw)/2:y=(h-th)/2",
        _ => "x=w-tw-20:y=h-th-20",
    };
    let escaped_text = text.replace('\'', "\\'").replace(':', "\\:");
    let vf = format!("drawtext=text='{}':fontsize={}:fontcolor=white@0.8:shadowx=2:shadowy=2:{}", escaped_text, font_size, pos);
    run_cmd(&ffmpeg(), &[
        "-y", "-i", &input,
        "-vf", &vf,
        "-c:v", "libx264", "-crf", "23",
        "-c:a", "copy",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Watermark '{}' added", text) })
}

#[tauri::command]
pub fn burn_subtitles(input: String, subtitle_path: String) -> Result<ToolResult, String> {
    let output = out_path(&input, "subtitled", "mp4");
    let sub = subtitle_path.replace('\\', "/").replace(':', "\\:");
    run_cmd(&ffmpeg(), &[
        "-y", "-i", &input,
        "-vf", &format!("subtitles='{}'", sub),
        "-c:v", "libx264", "-crf", "23",
        "-c:a", "copy",
        "-movflags", "+faststart",
        &output,
    ])?;
    Ok(ToolResult { success: true, output_path: output.clone(), message: "Subtitles burned in".to_string() })
}

#[tauri::command]
pub fn extract_frames(input: String, output_dir: String, timestamp: Option<f64>) -> Result<ToolResult, String> {
    if let Some(ts) = timestamp {
        let output = format!("{}/frame_{}.png", output_dir, ts);
        run_cmd(&ffmpeg(), &[
            "-y", "-ss", &ts.to_string(),
            "-i", &input,
            "-frames:v", "1",
            &output,
        ])?;
        Ok(ToolResult { success: true, output_path: output.clone(), message: format!("Extracted frame at {:.1}s", ts) })
    } else {
        run_cmd(&ffmpeg(), &[
            "-y", "-i", &input,
            "-vf", "fps=1",
            &format!("{}/frame_%04d.png", output_dir),
        ])?;
        Ok(ToolResult { success: true, output_path: output_dir.clone(), message: "Extracted all frames at 1fps".to_string() })
    }
}
