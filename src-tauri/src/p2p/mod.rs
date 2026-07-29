pub mod commands;
pub mod encryption;
pub mod mdns;
pub mod server;

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use tokio::task::JoinHandle;

static P2P_STATE: OnceLock<Mutex<Option<P2PState>>> = OnceLock::new();

pub struct P2PState {
    pub mdns_service: Option<mdns::MdnsService>,
    pub peers: Vec<mdns::PeerInfo>,
    pub transfers: HashMap<String, TransferState>,
    pub server_handle: Option<JoinHandle<()>>,
    pub server_port: Option<u16>,
    pub server_runtime: Option<tokio::runtime::Runtime>,
    pub receiving: bool,
}

pub struct TransferState {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub peer_ip: String,
    pub encrypted: bool,
    pub status: String,
    pub bytes_sent: u64,
    pub started_at: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TransferInfo {
    pub id: String,
    pub file_name: String,
    pub file_size: u64,
    pub peer_ip: String,
    pub encrypted: bool,
    pub status: String,
    pub bytes_sent: u64,
    pub speed_bps: u64,
    pub eta_secs: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct PeerListResult {
    pub peers: Vec<mdns::PeerInfo>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SendResult {
    pub success: bool,
    pub transfer_id: String,
    pub message: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct PortalResult {
    pub url: String,
    pub qr_code_base64: String,
    pub port: u16,
}

fn get_state() -> &'static Mutex<Option<P2PState>> {
    P2P_STATE.get_or_init(|| Mutex::new(None))
}

pub fn init_state() {
    let _ = P2P_STATE.get_or_init(|| {
        Mutex::new(Some(P2PState {
            mdns_service: None,
            peers: Vec::new(),
            transfers: HashMap::new(),
            server_handle: None,
            server_port: None,
            server_runtime: None,
            receiving: false,
        }))
    });
}

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
