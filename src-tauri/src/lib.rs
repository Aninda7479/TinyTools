mod commands;
pub mod p2p;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
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
            // Hasher
            commands::hasher::hash_text,
            commands::hasher::hash_file,
            commands::hasher::hash_file_all,
            commands::hasher::verify_file_hash,
            // Encryption
            commands::encryption::encrypt_text_aes,
            commands::encryption::decrypt_text_aes,
            commands::encryption::encrypt_text_chacha,
            commands::encryption::decrypt_text_chacha,
            commands::encryption::encrypt_rot13,
            commands::encryption::encrypt_caesar,
            commands::encryption::encrypt_vigenere,
            commands::encryption::encrypt_xor,
            commands::encryption::encrypt_file_aes,
            commands::encryption::decrypt_file_aes,
            commands::encryption::encrypt_file_chacha,
            commands::encryption::decrypt_file_chacha,
            // P2P File Sharing
            p2p::commands::start_discovery,
            p2p::commands::stop_discovery,
            p2p::commands::get_peers,
            p2p::commands::send_file,
            p2p::commands::start_web_portal,
            p2p::commands::stop_web_portal,
            p2p::commands::get_transfer_progress,
            p2p::commands::cancel_transfer,
            p2p::commands::is_receiving,
            p2p::commands::start_receiving,
            p2p::commands::stop_receiving,
            p2p::commands::cleanup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TinyTools");
}
