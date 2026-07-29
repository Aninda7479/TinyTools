pub mod commands;
pub mod encryption;
pub mod server;

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tokio::task::JoinHandle;

static P2P_STATE: OnceLock<Mutex<Option<P2PState>>> = OnceLock::new();
static INCOMING_TRANSFERS: OnceLock<Mutex<HashMap<String, IncomingTransfer>>> = OnceLock::new();

pub struct P2PState {
    pub server_handle: Option<JoinHandle<()>>,
    pub server_port: Option<u16>,
    pub server_runtime: Option<tokio::runtime::Runtime>,
}

pub struct IncomingTransfer {
    pub id: String,
    pub file_name: String,
    pub file_size: u64,
    pub sender_ip: String,
    /// Temp path used during streaming from browser (old approach)
    pub temp_path: Option<String>,
    /// Final save path chosen by user — set when download is accepted
    pub save_path: Option<String>,
    pub received_bytes: u64,
    pub encrypted: bool,
    pub encryption_salt: Option<Vec<u8>>,
    pub encryption_nonce: Option<Vec<u8>>,
    pub status: String,
    pub created_at: u64,
}

#[derive(serde::Serialize, Clone)]
pub struct IncomingTransferInfo {
    pub id: String,
    pub file_name: String,
    pub file_size: u64,
    pub received_bytes: u64,
    pub sender_ip: String,
    pub encrypted: bool,
    pub status: String,
    pub save_path: Option<String>,
    pub created_at: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct PortalResult {
    pub url: String,
    pub receive_url: String,
    pub qr_code_base64: String,
    pub port: u16,
}

fn get_state() -> &'static Mutex<Option<P2PState>> {
    P2P_STATE.get_or_init(|| Mutex::new(None))
}

pub fn get_incoming_transfers() -> &'static Mutex<HashMap<String, IncomingTransfer>> {
    INCOMING_TRANSFERS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
