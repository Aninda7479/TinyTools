use crate::chat::{create_room, destroy_room, get_room, get_state, ChatState};

#[derive(serde::Serialize, Clone)]
pub struct ChatRoomResult {
    pub url: String,
    pub qr_code_base64: String,
    pub port: u16,
}

#[derive(serde::Serialize)]
pub struct ChatRoomStatus {
    pub running: bool,
    pub url: Option<String>,
    pub member_count: usize,
}

#[tauri::command]
pub fn start_chat_room(password: String) -> Result<ChatRoomResult, String> {
    if password.is_empty() {
        return Err("Room password cannot be empty".to_string());
    }
    if password.chars().count() > 128 {
        return Err("Room password too long".to_string());
    }

    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    // Already running? Return the existing URL.
    {
        let guard = get_state().lock().map_err(|e| e.to_string())?;
        if let Some(state) = guard.as_ref() {
            if let Some(url) = state.server_url.clone() {
                let qr_code_base64 = generate_qr_code_png(&url)?;
                let port = state.server_port.unwrap_or(0);
                crate::sleep_preventer::set_chat_awake(true);
                return Ok(ChatRoomResult {
                    url,
                    qr_code_base64,
                    port,
                });
            }
        }
    }

    create_room(password)?;

    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    let (port, handle) = rt.block_on(crate::chat::server::start_server(&local_ip))?;

    {
        let mut guard = get_state().lock().map_err(|e| e.to_string())?;
        let chat = guard.get_or_insert_with(|| ChatState {
            server_handle: None,
            server_port: None,
            server_url: None,
            server_runtime: None,
        });
        if let Some(old) = chat.server_handle.take() {
            old.abort();
        }
        chat.server_handle = Some(handle);
        chat.server_port = Some(port);
        chat.server_runtime = Some(rt);
    }

    let url = format!("https://{}:{}/chat", local_ip, port);
    {
        let mut guard = get_state().lock().map_err(|e| e.to_string())?;
        if let Some(state) = guard.as_mut() {
            state.server_url = Some(url.clone());
        }
    }

    let qr_code_base64 = generate_qr_code_png(&url)?;

    crate::sleep_preventer::set_chat_awake(true);

    Ok(ChatRoomResult {
        url,
        qr_code_base64,
        port,
    })
}

#[tauri::command]
pub fn stop_chat_room() -> Result<(), String> {
    {
        let mut guard = get_state().lock().map_err(|e| e.to_string())?;
        if let Some(ref mut state) = *guard {
            if let Some(handle) = state.server_handle.take() {
                handle.abort();
            }
            state.server_port = None;
            state.server_url = None;
            state.server_runtime = None;
        }
    }
    destroy_room()?;
    crate::sleep_preventer::set_chat_awake(false);
    Ok(())
}

#[tauri::command]
pub fn get_chat_room_status() -> Result<ChatRoomStatus, String> {
    let member_count = get_room()
        .lock()
        .map(|g| g.as_ref().map(|r| r.members.len()).unwrap_or(0))
        .unwrap_or(0);
    let guard = get_state().lock().map_err(|e| e.to_string())?;
    let state = guard.as_ref();
    Ok(ChatRoomStatus {
        running: state.and_then(|s| s.server_port).is_some(),
        url: state.and_then(|s| s.server_url.clone()),
        member_count,
    })
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
