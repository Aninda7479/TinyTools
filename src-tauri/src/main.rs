#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let homelab = std::env::args().any(|a| a == "--serve")
        || std::env::var("TINYTOOLS_HOMELAB").map(|v| v == "1").unwrap_or(false);
    if homelab {
        tinytools_lib::run_homelab();
    } else {
        tinytools_lib::run();
    }
}
