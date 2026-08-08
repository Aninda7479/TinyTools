use std::sync::atomic::{AtomicBool, Ordering};

static CHAT_AWAKE: AtomicBool = AtomicBool::new(false);
static PORTAL_AWAKE: AtomicBool = AtomicBool::new(false);
static HOMELAB_AWAKE: AtomicBool = AtomicBool::new(false);

pub fn set_chat_awake(awake: bool) {
    CHAT_AWAKE.store(awake, Ordering::SeqCst);
    update_keep_awake();
}

pub fn set_portal_awake(awake: bool) {
    PORTAL_AWAKE.store(awake, Ordering::SeqCst);
    update_keep_awake();
}

pub fn set_homelab_awake(awake: bool) {
    HOMELAB_AWAKE.store(awake, Ordering::SeqCst);
    update_keep_awake();
}

fn update_keep_awake() {
    let keep_awake = CHAT_AWAKE.load(Ordering::SeqCst)
        || PORTAL_AWAKE.load(Ordering::SeqCst)
        || HOMELAB_AWAKE.load(Ordering::SeqCst);
    set_keep_awake(keep_awake);
}

#[cfg(target_os = "windows")]
fn set_keep_awake(keep_awake: bool) {
    unsafe {
        // ES_CONTINUOUS = 0x80000000
        // ES_SYSTEM_REQUIRED = 0x00000001
        // ES_DISPLAY_REQUIRED = 0x00000002
        let flags = if keep_awake {
            0x80000000 | 0x00000001 | 0x00000002
        } else {
            0x80000000
        };
        SetThreadExecutionState(flags);
    }
}

#[cfg(target_os = "windows")]
extern "system" {
    fn SetThreadExecutionState(esFlags: u32) -> u32;
}

#[cfg(not(target_os = "windows"))]
fn set_keep_awake(_keep_awake: bool) {}
