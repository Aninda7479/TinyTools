mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
            commands::ai_tools::colorize_image,
            commands::ai_tools::face_enhance,
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
            commands::pdf_tools::compress_pdf,
            commands::pdf_tools::flatten_pdf,
            commands::pdf_tools::add_pdf_watermark,
            commands::pdf_tools::add_page_numbers,
            // Password Generator
            commands::password_tools::generate_password,
            commands::password_tools::generate_bulk,
            commands::password_tools::export_passwords,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TinyTools");
}
