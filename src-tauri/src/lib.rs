mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::compress_image,
            commands::generate_qr_code,
            commands::get_file_info,
            commands::process_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TinyTools");
}
