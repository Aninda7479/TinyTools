use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn compress_image(
    image_data: &[u8],
    ext: &str,
    quality: u8,
) -> Result<js_sys::Uint8Array, JsValue> {
    let img = image::load_from_memory(image_data).map_err(|e| JsValue::from_str(&e.to_string()))?;

    let mut buf = std::io::Cursor::new(Vec::new());

    match ext {
        "jpg" | "jpeg" => {
            let rgb = img.to_rgb8();
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
            rgb.write_with_encoder(encoder).map_err(|e| JsValue::from_str(&e.to_string()))?;
        }
        _ => {
            let format = image::ImageFormat::from_extension(ext).unwrap_or(image::ImageFormat::Png);
            img.write_to(&mut buf, format).map_err(|e| JsValue::from_str(&e.to_string()))?;
        }
    }

    let out_bytes = buf.into_inner();
    let js_array = js_sys::Uint8Array::new_with_length(out_bytes.len() as u32);
    js_array.copy_from(&out_bytes);
    Ok(js_array)
}
