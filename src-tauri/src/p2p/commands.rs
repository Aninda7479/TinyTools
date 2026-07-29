use std::sync::Arc;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use crate::p2p::{encryption, server, P2PState, PortalResult, get_state, now_secs};

#[tauri::command]
pub fn start_web_portal(
    file_path: String,
    password: Option<String>,
) -> Result<PortalResult, String> {
    let file_meta = std::fs::metadata(&file_path).map_err(|e| e.to_string())?;
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    let file_size = file_meta.len();

    let (encrypted_data, encryption_salt, encryption_nonce, encryption_iterations) =
        if let Some(ref portal_password) = password {
            let file_data = std::fs::read(&file_path).map_err(|e| e.to_string())?;
            let encrypted = encryption::encrypt_for_web_portal(portal_password, &file_data)?;
            (
                Some(encrypted.ciphertext),
                Some(STANDARD.encode(encrypted.salt)),
                Some(STANDARD.encode(encrypted.nonce)),
                Some(encryption::PORTAL_PBKDF2_ITERATIONS),
            )
        } else {
            (None, None, None, None)
        };

    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;

    let state = server::ServerState {
        transfers: Arc::new(tokio::sync::Mutex::new({
            let mut m = std::collections::HashMap::new();
            m.insert(
                "current".to_string(),
                server::PortalTransfer {
                    file_path: file_path.clone(),
                    file_name: file_name.clone(),
                    file_size,
                    encrypted_data,
                    encryption_salt,
                    encryption_nonce,
                    encryption_iterations,
                    started_at: now_secs(),
                },
            );
            m
        })),
        downloads_dir: Arc::new(tokio::sync::Mutex::new(
            dirs_next::download_dir()
                .or_else(|| dirs_next::home_dir())
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .to_string_lossy()
                .to_string(),
        )),
        download_limits: Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::new())),
    };

    let (port, handle) = rt.block_on(server::start_server(state, &local_ip))?;

    {
        let mut guard = get_state().lock().map_err(|e| e.to_string())?;
        let p2p = guard.get_or_insert_with(|| P2PState {
            server_handle: None,
            server_port: None,
            server_runtime: None,
        });
        if let Some(old) = p2p.server_handle.take() {
            old.abort();
        }
        p2p.server_handle = Some(handle);
        p2p.server_port = Some(port);
        p2p.server_runtime = Some(rt);
    }

    let url = format!("https://{}:{}", local_ip, port);

    let qr_code_base64 = generate_qr_code_png(&url)?;

    Ok(PortalResult {
        url,
        qr_code_base64,
        port,
    })
}

#[tauri::command]
pub fn stop_web_portal() -> Result<(), String> {
    let mut guard = get_state().lock().map_err(|e| e.to_string())?;
    if let Some(ref mut state) = *guard {
        if let Some(handle) = state.server_handle.take() {
            handle.abort();
        }
        state.server_port = None;
        state.server_runtime = None;
    }
    Ok(())
}

#[tauri::command]
pub fn cleanup() -> Result<(), String> {
    let mut guard = get_state().lock().map_err(|e| e.to_string())?;
    if let Some(ref mut state) = *guard {
        if let Some(handle) = state.server_handle.take() {
            handle.abort();
        }
        state.server_port = None;
        state.server_runtime = None;
    }
    Ok(())
}

fn generate_qr_code_png(url: &str) -> Result<String, String> {
    use image::Luma;
    use qrcode::QrCode;

    let code = QrCode::new(url.as_bytes()).map_err(|e| e.to_string())?;
    let image = code
        .render::<Luma<u8>>()
        .max_dimensions(256, 256)
        .build();

    let mut buf = std::io::Cursor::new(Vec::new());
    image
        .write_with_encoder(image::codecs::png::PngEncoder::new(&mut buf))
        .map_err(|e| e.to_string())?;

    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &buf.into_inner(),
    ))
}
