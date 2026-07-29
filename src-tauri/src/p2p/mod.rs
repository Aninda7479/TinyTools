pub mod commands;
pub mod encryption;
pub mod server;

use std::sync::{Mutex, OnceLock};
use tokio::task::JoinHandle;

static P2P_STATE: OnceLock<Mutex<Option<P2PState>>> = OnceLock::new();

pub struct P2PState {
    pub server_handle: Option<JoinHandle<()>>,
    pub server_port: Option<u16>,
    pub server_runtime: Option<tokio::runtime::Runtime>,
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

pub fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
