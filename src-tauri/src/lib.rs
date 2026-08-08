mod commands;
pub mod chat;
pub mod p2p;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // Original
            commands::compress_image,
            commands::generate_qr_code,
            commands::get_file_info,
            commands::process_image,
            // AI Tools
            commands::ai_tools::remove_background,
            commands::ai_tools::inpaint_image,
            commands::ai_tools::upscale_image,
            commands::ai_tools::sepia_filter,
            commands::ai_tools::smart_sharpen,
            commands::ai_tools::depth_blur,
            // Privacy
            commands::privacy::strip_metadata,
            commands::privacy::redact_regions,
            commands::privacy::add_watermark,
            commands::privacy::add_image_watermark,
            // Editing
            commands::editing::smart_crop,
            commands::editing::expand_canvas,
            commands::editing::split_image,
            commands::editing::stitch_images,
            // Compression & Conversion
            commands::compression::smart_compress,
            commands::compression::convert_format,
            commands::compression::convert_heic,
            commands::compression::raster_to_svg,
            // Batch
            commands::batch::batch_compress,
            commands::batch::batch_resize,
            commands::batch::batch_convert,
            commands::batch::batch_watermark,
            // PDF Tools
            commands::pdf_tools::get_pdf_info,
            commands::pdf_tools::merge_pdfs,
            commands::pdf_tools::split_pdf,
            commands::pdf_tools::reorder_pages,
            commands::pdf_tools::rotate_pages,
            commands::pdf_tools::crop_pages,
            commands::pdf_tools::delete_pages,
            commands::pdf_tools::images_to_pdf,
            commands::pdf_tools::extract_text,
            commands::pdf_tools::encrypt_pdf,
            commands::pdf_tools::decrypt_pdf,
            commands::pdf_tools::unwrap_pdf,
            commands::pdf_tools::compress_pdf,
            commands::pdf_tools::flatten_pdf,
            commands::pdf_tools::add_pdf_watermark,
            commands::pdf_tools::add_page_numbers,
            // Password Generator
            commands::password_tools::generate_password,
            commands::password_tools::generate_bulk,
            commands::password_tools::export_passwords,
            // Encoder/Decoder
            commands::encoder::encode_base64,
            commands::encoder::decode_base64,
            commands::encoder::encode_base64url,
            commands::encoder::decode_base64url,
            commands::encoder::encode_base32,
            commands::encoder::decode_base32,
            commands::encoder::encode_base58,
            commands::encoder::decode_base58,
            commands::encoder::encode_hex,
            commands::encoder::decode_hex,
            commands::encoder::encode_url,
            commands::encoder::decode_url,
            commands::encoder::encode_html,
            commands::encoder::decode_html,
            commands::encoder::encode_unicode,
            commands::encoder::decode_unicode,
            commands::encoder::decode_jwt,
            commands::encoder::text_to_morse,
            commands::encoder::morse_to_text,
            commands::encoder::text_to_binary,
            commands::encoder::binary_to_text,
            commands::encoder::text_to_octal,
            commands::encoder::octal_to_text,
            commands::encoder::encode_file,
            commands::encoder::decode_file,
            commands::encoder::decode_text_to_file,
            // Hasher
            commands::hasher::hash_text,
            commands::hasher::hash_file,
            commands::hasher::hash_file_all,
            commands::hasher::hash_text_all,
            commands::hasher::verify_file_hash,
            commands::hasher::verify_text_hash,
            // Encryption
            commands::encryption::encrypt_text_aes,
            commands::encryption::decrypt_text_aes,
            commands::encryption::encrypt_text_chacha,
            commands::encryption::decrypt_text_chacha,
            commands::encryption::encrypt_rot13,
            commands::encryption::encrypt_caesar,
            commands::encryption::encrypt_vigenere,
            commands::encryption::encrypt_xor,
            commands::encryption::decrypt_xor,
            commands::encryption::encrypt_file_aes,
            commands::encryption::decrypt_file_aes,
            commands::encryption::encrypt_file_chacha,
            commands::encryption::decrypt_file_chacha,
            // Local Web Portal
            p2p::commands::start_web_portal,
            p2p::commands::stop_web_portal,
            p2p::commands::get_pending_transfers,
            p2p::commands::accept_transfer,
            p2p::commands::reject_transfer,
            p2p::commands::cleanup,
            p2p::commands::reveal_in_folder,
            // E2EE Local Chat
            chat::commands::start_chat_room,
            chat::commands::stop_chat_room,
            chat::commands::get_chat_room_status,
            // Video Tools
            commands::video_tools::get_video_info,
            commands::video_tools::compress_video,
            commands::video_tools::resize_video,
            commands::video_tools::convert_aspect_ratio,
            commands::video_tools::trim_video,
            commands::video_tools::merge_videos,
            commands::video_tools::crop_video,
            commands::video_tools::rotate_video,
            commands::video_tools::mirror_video,
            commands::video_tools::convert_video_format,
            commands::video_tools::extract_audio,
            commands::video_tools::mute_video,
            commands::video_tools::replace_audio,
            commands::video_tools::video_to_gif,
            commands::video_tools::gif_to_video,
            commands::video_tools::change_speed,
            commands::video_tools::add_video_watermark,
            commands::video_tools::burn_subtitles,
            commands::video_tools::extract_frames,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TinyTools");
}

pub fn run_homelab() {
    let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
    rt.block_on(async {
        let local_ip = local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "127.0.0.1".to_string());

        let (chat_password, _) = match chat::server::ensure_homelab_room() {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Failed to start chat room: {}", e);
                return;
            }
        };

        let (port, handle) = match p2p::server::start_homelab_server(&local_ip).await {
            Ok(result) => result,
            Err(e) => {
                eprintln!("Failed to start homelab server: {}", e);
                return;
            }
        };

        let url = format!("https://{}:{}", local_ip, port);
        println!("\n========================================");
        println!("  TinyTools Homelab Mode");
        println!("  URL: {}", url);
        println!("  LAN: https://{}:{}", local_ip, port);
        println!("  Chat: https://{}:{}/chat", local_ip, port);
        println!("  Chat password: {}", chat_password);
        println!("  Press Ctrl+C to stop");
        println!("========================================\n");

        if let Ok(qr) = generate_homelab_qr(&url) {
            println!("QR Code (scan with phone camera):\n");
            println!("{}", qr);
            println!();
        }

        let _ = handle.await;
    });
}

fn generate_homelab_qr(url: &str) -> Result<String, String> {
    use qrcode::QrCode;
    use qrcode::render::unicode;

    let code = QrCode::new(url.as_bytes()).map_err(|e| e.to_string())?;
    let image = code
        .render::<unicode::Dense1x2>()
        .build();

    Ok(image)
}
