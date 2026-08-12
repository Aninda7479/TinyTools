use std::process::Command;
use std::io::Write;
use serde::{Deserialize, Serialize};
use tempfile::Builder;

#[derive(Debug, Serialize, Deserialize)]
pub struct TtsResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn generate_tts_audio(
    text: String,
    output_path: String,
    rate: f32,
    voice: Option<String>,
) -> Result<TtsResult, String> {
    // 1. Create a temporary text file with the text contents to prevent shell injection.
    let mut temp_file = Builder::new()
        .prefix("tinytools_tts_")
        .suffix(".txt")
        .tempfile()
        .map_err(|e| format!("Failed to create temporary file: {}", e))?;
        
    temp_file
        .write_all(text.as_bytes())
        .map_err(|e| format!("Failed to write text to temporary file: {}", e))?;
        
    let temp_path = temp_file.path().to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        // Escape single quotes for PowerShell
        let escaped_output_path = output_path.replace("'", "''");
        let escaped_temp_path = temp_path.replace("'", "''");
        
        let win_rate = ((rate - 1.0) * 5.0).clamp(-10.0, 10.0) as i32;
        
        let mut ps_script = format!(
            "Add-Type -AssemblyName System.Speech; \
             $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; \
             $synth.Rate = {}; ",
            win_rate
        );
        
        if let Some(ref voice_name) = voice {
            if !voice_name.is_empty() {
                let escaped_voice = voice_name.replace("'", "''");
                ps_script.push_str(&format!("$synth.SelectVoice('{}'); ", escaped_voice));
            }
        }
        
        ps_script.push_str(&format!(
            "$text = Get-Content -Path '{}' -Raw -Encoding utf8; \
             $synth.SetOutputToWaveFile('{}'); \
             $synth.Speak($text); \
             $synth.Dispose();",
            escaped_temp_path, escaped_output_path
        ));
        
        let output = Command::new("powershell")
            .args(&["-NoProfile", "-NonInteractive", "-Command", &ps_script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
            
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Speech synthesis failed: {}", stderr));
        }
    }

    #[cfg(target_os = "macos")]
    {
        let wpm = (rate * 175.0) as i32;
        let mut args = vec![
            "-o".to_string(),
            output_path.clone(),
            "-f".to_string(),
            temp_path,
        ];
        
        if wpm > 0 {
            args.push("-r".to_string());
            args.push(wpm.to_string());
        }
        
        if let Some(ref voice_name) = voice {
            if !voice_name.is_empty() {
                args.push("-v".to_string());
                args.push(voice_name.clone());
            }
        }
        
        let output = Command::new("say")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute say command: {}", e))?;
            
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Speech synthesis failed: {}", stderr));
        }
    }

    #[cfg(target_os = "linux")]
    {
        let wpm = (rate * 175.0) as i32;
        let mut args = vec![
            "-w".to_string(),
            output_path.clone(),
            "-f".to_string(),
            temp_path,
        ];
        
        if wpm > 0 {
            args.push("-s".to_string());
            args.push(wpm.to_string());
        }
        
        if let Some(ref voice_name) = voice {
            if !voice_name.is_empty() {
                args.push("-v".to_string());
                args.push(voice_name.clone());
            }
        }
        
        let output = Command::new("espeak")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to execute espeak command: {}", e))?;
            
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Speech synthesis failed: {}", stderr));
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("Speech synthesis file export is not supported on this operating system.".to_string());
    }

    Ok(TtsResult {
        success: true,
        output_path: Some(output_path),
        message: "Audio generated successfully".to_string(),
    })
}
