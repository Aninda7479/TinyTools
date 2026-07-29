use super::*;
use crate::p2p::{encryption, mdns, server, P2PState, TransferState, TransferInfo, PeerListResult, SendResult, PortalResult, get_state, now_secs};

#[tauri::command]
pub fn start_discovery() -> Result<PeerListResult, String> {
    let mut guard = get_state().lock().map_err(|e| e.to_string())?;
    let state = guard.get_or_insert_with(|| P2PState {
        mdns_service: None,
        peers: Vec::new(),
        transfers: std::collections::HashMap::new(),
        server_handle: None,
        server_port: None,
        server_runtime: None,
        receiving: false,
    });

    if state.mdns_service.is_none() {
        let svc = mdns::MdnsService::new()?;
        let _ = svc.register(0);
        state.mdns_service = Some(svc);
    }

    let peers = if let Some(ref mut svc) = state.mdns_service {
        svc.poll_peers()
    } else {
        Vec::new()
    };
    state.peers = peers;

    Ok(PeerListResult {
        peers: state.peers.clone(),
    })
}

#[tauri::command]
pub fn stop_discovery() -> Result<(), String> {
    let mut guard = get_state().lock().map_err(|e| e.to_string())?;
    if let Some(ref mut state) = *guard {
        if let Some(ref svc) = state.mdns_service {
            let _ = svc.unregister();
        }
        state.mdns_service = None;
        state.peers.clear();
    }
    Ok(())
}

#[tauri::command]
pub fn get_peers() -> Result<PeerListResult, String> {
    let mut guard = get_state().lock().map_err(|e| e.to_string())?;
    let state = guard.as_mut().ok_or("P2P not initialized")?;

    let peers = if let Some(ref mut svc) = state.mdns_service {
        svc.poll_peers()
    } else {
        Vec::new()
    };
    state.peers = peers;

    Ok(PeerListResult {
        peers: state.peers.clone(),
    })
}

#[tauri::command]
pub async fn send_file(
    file_path: String,
    peer_ip: String,
    password: Option<String>,
) -> Result<SendResult, String> {
    let file_meta = std::fs::metadata(&file_path).map_err(|e| e.to_string())?;
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    let file_size = file_meta.len();

    let encrypted = password.is_some();
    let transfer_id = uuid_simple();
    let salt = if encrypted {
        Some(encryption::generate_salt())
    } else {
        None
    };

    let (key, hmac_token) = if let Some(ref pwd) = password {
        let s = salt.as_ref().unwrap();
        let k = encryption::derive_key(pwd.as_bytes(), s)?;
        let h = encryption::compute_hmac(&k, s)?;
        (Some(k), Some(h))
    } else {
        (None, None)
    };

    {
        let mut guard = get_state().lock().map_err(|e| e.to_string())?;
        if let Some(ref mut state) = *guard {
            state.transfers.insert(
                transfer_id.clone(),
                TransferState {
                    id: transfer_id.clone(),
                    file_path: file_path.clone(),
                    file_name: file_name.clone(),
                    file_size,
                    peer_ip: peer_ip.clone(),
                    encrypted,
                    status: "connecting".to_string(),
                    bytes_sent: 0,
                    started_at: now_secs(),
                },
            );
        }
    }

    let manifest = server::TransferManifest {
        file_name: file_name.clone(),
        file_size,
        encrypted,
        salt: salt.map(|s| base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &s)),
        hmac: hmac_token.map(|h| base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &h)),
    };

    let manifest_json = serde_json::to_string(&manifest).map_err(|e| e.to_string())?;
    let manifest_bytes = manifest_json.into_bytes();

    let result = send_file_to_peer(
        &peer_ip,
        &transfer_id,
        &file_path,
        file_size,
        key.as_ref(),
        &manifest_bytes,
    )
    .await;

    {
        let mut guard = get_state().lock().map_err(|e| e.to_string())?;
        if let Some(ref mut state) = *guard {
            if let Some(t) = state.transfers.get_mut(&transfer_id) {
                match &result {
                    Ok(_) => {
                        t.status = "completed".to_string();
                        t.bytes_sent = file_size;
                    }
                    Err(_e) => {
                        t.status = "failed".to_string();
                        t.bytes_sent = 0;
                    }
                }
            }
        }
    }

    match result {
        Ok(_) => Ok(SendResult {
            success: true,
            transfer_id,
            message: format!("File sent to {}", peer_ip),
        }),
        Err(e) => Ok(SendResult {
            success: false,
            transfer_id,
            message: format!("Failed: {}", e),
        }),
    }
}

async fn send_file_to_peer(
    peer_ip: &str,
    _transfer_id: &str,
    file_path: &str,
    file_size: u64,
    key: Option<&[u8; 32]>,
    manifest_bytes: &[u8],
) -> Result<(), String> {
    use tokio::io::AsyncReadExt;

    let client = reqwest::Client::new();

    let manifest_resp = client
        .post(format!("http://{}:8787/api/receive", peer_ip))
        .header("content-type", "application/json")
        .body(manifest_bytes.to_vec())
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    if !manifest_resp.status().is_success() {
        let err_text = manifest_resp.text().await.unwrap_or_default();
        return Err(format!("Receiver rejected: {}", err_text));
    }

    let mut file = tokio::fs::File::open(file_path)
        .await
        .map_err(|e| format!("File open error: {}", e))?;

    let mut file_data = Vec::with_capacity(file_size as usize);
    file.read_to_end(&mut file_data)
        .await
        .map_err(|e| format!("File read error: {}", e))?;

    let body = if let Some(k) = key {
        encrypt_file_data(k, &file_data)?
    } else {
        file_data
    };

    let resp = client
        .post(format!("http://{}:8787/api/receive", peer_ip))
        .header("content-type", "application/octet-stream")
        .header("content-length", body.len())
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Send failed: {}", e))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        let err_text = resp.text().await.unwrap_or_default();
        Err(format!("Receiver error: {}", err_text))
    }
}

fn encrypt_file_data(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, String> {
    let mut encrypted = Vec::with_capacity(data.len() + 1024);
    for (i, chunk) in data.chunks(encryption::CHUNK_SIZE).enumerate() {
        let enc_chunk = encryption::encrypt_chunk(key, i as u64, chunk)?;
        encrypted.extend_from_slice(&(enc_chunk.len() as u32).to_le_bytes());
        encrypted.extend_from_slice(&enc_chunk);
    }
    Ok(encrypted)
}

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

    let local_ip = mdns::get_local_ip().to_string();

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
                    password: password.clone(),
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
        receiving_transfers: Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::new())),
    };

    let (port, handle) = rt.block_on(server::start_server(state))?;

    {
        let mut guard = get_state().lock().map_err(|e| e.to_string())?;
        if let Some(ref mut p2p) = *guard {
            if let Some(old) = p2p.server_handle.take() {
                old.abort();
            }
            p2p.server_handle = Some(handle);
            p2p.server_port = Some(port);
            p2p.server_runtime = Some(rt);
        }
    }

    let url = format!("http://{}:{}", local_ip, port);

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
pub fn get_transfer_progress(transfer_id: String) -> Result<TransferInfo, String> {
    let guard = get_state().lock().map_err(|e| e.to_string())?;
    let state = guard.as_ref().ok_or("P2P not initialized")?;

    let t = state
        .transfers
        .get(&transfer_id)
        .ok_or("Transfer not found")?;

    let elapsed = now_secs().saturating_sub(t.started_at).max(1);
    let speed_bps = if t.bytes_sent > 0 {
        t.bytes_sent / elapsed
    } else {
        0
    };
    let remaining = if speed_bps > 0 && t.file_size > t.bytes_sent {
        (t.file_size - t.bytes_sent) / speed_bps
    } else {
        0
    };

    Ok(TransferInfo {
        id: t.id.clone(),
        file_name: t.file_name.clone(),
        file_size: t.file_size,
        peer_ip: t.peer_ip.clone(),
        encrypted: t.encrypted,
        status: t.status.clone(),
        bytes_sent: t.bytes_sent,
        speed_bps,
        eta_secs: remaining,
    })
}

#[tauri::command]
pub fn cancel_transfer(transfer_id: String) -> Result<(), String> {
    let mut guard = get_state().lock().map_err(|e| e.to_string())?;
    if let Some(ref mut state) = *guard {
        if let Some(t) = state.transfers.get_mut(&transfer_id) {
            t.status = "cancelled".to_string();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn is_receiving() -> Result<bool, String> {
    let guard = get_state().lock().map_err(|e| e.to_string())?;
    Ok(guard.as_ref().map(|s| s.receiving).unwrap_or(false))
}

#[tauri::command]
pub fn start_receiving() -> Result<(), String> {
    let mut guard = get_state().lock().map_err(|e| e.to_string())?;
    let state = guard.get_or_insert_with(|| P2PState {
        mdns_service: None,
        peers: Vec::new(),
        transfers: std::collections::HashMap::new(),
        server_handle: None,
        server_port: None,
        server_runtime: None,
        receiving: false,
    });
    state.receiving = true;
    Ok(())
}

#[tauri::command]
pub fn stop_receiving() -> Result<(), String> {
    let mut guard = get_state().lock().map_err(|e| e.to_string())?;
    if let Some(ref mut state) = *guard {
        state.receiving = false;
    }
    Ok(())
}

#[tauri::command]
pub fn cleanup() -> Result<(), String> {
    let mut guard = get_state().lock().map_err(|e| e.to_string())?;
    if let Some(ref mut state) = *guard {
        if let Some(ref svc) = state.mdns_service {
            let _ = svc.unregister();
        }
        state.mdns_service = None;
        state.peers.clear();
        state.transfers.clear();
        if let Some(handle) = state.server_handle.take() {
            handle.abort();
        }
        state.server_port = None;
        state.server_runtime = None;
        state.receiving = false;
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

fn uuid_simple() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        bytes[6], bytes[7],
        bytes[8], bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    )
}
