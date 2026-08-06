use wasm_bindgen::prelude::*;
use image::{GenericImageView, RgbaImage};

#[wasm_bindgen]
pub fn process_image(
    image_data: &[u8],
    operation: &str,
    params_json: Option<String>,
) -> Result<js_sys::Uint8Array, JsValue> {
    let img = image::load_from_memory(image_data).map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    let parsed: serde_json::Value = params_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or(serde_json::Value::Null);

    let result_img = match operation {
        "resize" => {
            let max_w = parsed["width"].as_u64().unwrap_or(800) as u32;
            let max_h = parsed["height"].as_u64().unwrap_or(800) as u32;
            img.resize(max_w, max_h, image::imageops::FilterType::Lanczos3)
        }
        "grayscale" => {
            image::DynamicImage::ImageLuma8(img.into_luma8())
        }
        "rotate" => {
            let degrees = parsed["degrees"].as_u64().unwrap_or(90);
            match degrees % 360 {
                90 => img.rotate90(),
                180 => img.rotate180(),
                270 => img.rotate270(),
                _ => img.rotate90(),
            }
        }
        "flip" => {
            let direction = parsed["direction"].as_str().unwrap_or("horizontal");
            if direction == "vertical" { img.flipv() } else { img.fliph() }
        }
        "blur" => {
            let sigma = parsed["sigma"].as_f64().unwrap_or(3.0) as f32;
            img.blur(sigma)
        }
        "sharpen" => {
            let amount = parsed["amount"].as_f64().unwrap_or(1.0) as f32;
            let radius = parsed["radius"].as_i64().unwrap_or(1) as u32;
            img.unsharpen(amount, radius as i32)
        }
        _ => return Err(JsValue::from_str(&format!("Unknown operation: {}", operation))),
    };

    let mut out = std::io::Cursor::new(Vec::new());
    let format = image::guess_format(image_data).unwrap_or(image::ImageFormat::Png);
    result_img.write_to(&mut out, format).map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    let out_bytes = out.into_inner();
    let js_array = js_sys::Uint8Array::new_with_length(out_bytes.len() as u32);
    js_array.copy_from(&out_bytes);
    Ok(js_array)
}
