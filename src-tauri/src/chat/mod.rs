pub mod chat_page;
pub mod commands;
pub mod server;

use axum::extract::ws::Message;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use tokio::task::JoinHandle;

static CHAT_STATE: OnceLock<Mutex<Option<ChatState>>> = OnceLock::new();
static ROOM: OnceLock<Mutex<Option<Room>>> = OnceLock::new();

pub struct ChatState {
    pub server_handle: Option<JoinHandle<()>>,
    pub server_port: Option<u16>,
    pub server_url: Option<String>,
    pub server_runtime: Option<tokio::runtime::Runtime>,
}

pub struct Room {
    pub password: String,
    pub salt: Vec<u8>,
    /// client_id -> display name
    pub members: HashMap<String, String>,
    /// send_token -> client_id
    pub auth: HashMap<String, String>,
    /// client_id -> socket writer (only while a WS is open)
    pub connections: HashMap<String, tokio::sync::mpsc::UnboundedSender<Message>>,
    /// In-memory encrypted file blobs (never written to disk)
    pub files: HashMap<String, FileBlob>,
    pub broadcast: tokio::sync::broadcast::Sender<RoomEvent>,
}

#[derive(Clone)]
pub struct FileBlob {
    pub bytes: Arc<Vec<u8>>,
    pub name: String,
    pub size: u64,
    pub mime: String,
    pub created_at: u64,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct MemberInfo {
    pub id: String,
    pub name: String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub kind: String, // "text" | "image" | "file"
    pub from: MemberInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ciphertext: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime: Option<String>,
    pub ts: u64,
}

#[derive(Clone, serde::Serialize)]
pub struct RoomEvent {
    #[serde(rename = "type")]
    pub kind: String, // "welcome" | "member" | "msg" | "system" | "error"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub member: Option<MemberInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub members: Option<Vec<MemberInfo>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    pub ts: u64,
}

impl RoomEvent {
    pub fn welcome(client_id: String, name: String, members: Vec<MemberInfo>) -> Self {
        Self {
            kind: "welcome".to_string(),
            action: None,
            member: None,
            members: Some(members),
            message: None,
            client_id: Some(client_id),
            name: Some(name),
            text: None,
            ts: now_secs(),
        }
    }

    pub fn member(action: &str, member: MemberInfo) -> Self {
        Self {
            kind: "member".to_string(),
            action: Some(action.to_string()),
            member: Some(member),
            members: None,
            message: None,
            client_id: None,
            name: None,
            text: None,
            ts: now_secs(),
        }
    }

    pub fn message(msg: ChatMessage) -> Self {
        Self {
            kind: "msg".to_string(),
            action: None,
            member: None,
            members: None,
            message: Some(msg),
            client_id: None,
            name: None,
            text: None,
            ts: now_secs(),
        }
    }

    pub fn system(text: String) -> Self {
        Self {
            kind: "system".to_string(),
            action: None,
            member: None,
            members: None,
            message: None,
            client_id: None,
            name: None,
            text: Some(text),
            ts: now_secs(),
        }
    }
}

pub const MAX_FILE_BYTES: u64 = 50 * 1024 * 1024; // 50 MB
pub const MAX_FILES: usize = 64;
pub const FILE_TTL_SECS: u64 = 30 * 60; // 30 minutes
pub const MESSAGES_PER_SECOND: u32 = 20;

fn get_state() -> &'static Mutex<Option<ChatState>> {
    CHAT_STATE.get_or_init(|| Mutex::new(None))
}

pub fn get_room() -> &'static Mutex<Option<Room>> {
    ROOM.get_or_init(|| Mutex::new(None))
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn random_bytes(n: usize) -> Vec<u8> {
    use rand::RngCore;
    let mut buf = vec![0u8; n];
    rand::rngs::OsRng.fill_bytes(&mut buf);
    buf
}

pub fn random_token() -> String {
    hex(&random_bytes(32))
}

pub fn uuid_simple() -> String {
    let b = random_bytes(16);
    let mut b = b;
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    let h: String = b.iter().map(|x| format!("{:02x}", x)).collect();
    format!(
        "{}-{}-{}-{}-{}",
        &h[0..8],
        &h[8..12],
        &h[12..16],
        &h[16..20],
        &h[20..32]
    )
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Create (or re-use) the room. Returns the room salt.
pub fn create_room(password: String) -> Result<Vec<u8>, String> {
    let mut guard = get_room().lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        let salt = random_bytes(16);
        let (tx, _rx) = tokio::sync::broadcast::channel(512);
        *guard = Some(Room {
            password,
            salt: salt.clone(),
            members: HashMap::new(),
            auth: HashMap::new(),
            connections: HashMap::new(),
            files: HashMap::new(),
            broadcast: tx,
        });
        Ok(salt)
    } else {
        Ok(guard.as_ref().unwrap().salt.clone())
    }
}

pub fn destroy_room() -> Result<(), String> {
    let mut guard = get_room().lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}
