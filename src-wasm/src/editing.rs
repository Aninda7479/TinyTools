use wasm_bindgen::prelude::*;
use image::{GenericImageView, Rgba, RgbaImage, DynamicImage};

#[wasm_bindgen]
pub fn smart_crop(
    image_data: &[u8],
    width: u32,
    height: u32,
    gravity: &str,
) -> Result<js_sys::Uint8Array, JsValue> {
    let mut img = image::load_from_memory(image_data).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let (w, h) = img.dimensions();

    let (sx, sy) = match gravity {
        "center" => ((w.saturating_sub(width)) / 2, (h.saturating_sub(height)) / 2),
        "top" => (0, 0),
        "bottom" => (0, h.saturating_sub(height)),
        "left" => (0, 0),
        "right" => (w.saturating_sub(width), 0),
        _ => ((w.saturating_sub(width)) / 2, (h.saturating_sub(height)) / 2),
    };

    let cropped = img.crop(sx, sy, width.min(w - sx), height.min(h - sy));
    
    let mut out = std::io::Cursor::new(Vec::new());
    let format = image::guess_format(image_data).unwrap_or(image::ImageFormat::Png);
    cropped.write_to(&mut out, format).map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    let out_bytes = out.into_inner();
    let js_array = js_sys::Uint8Array::new_with_length(out_bytes.len() as u32);
    js_array.copy_from(&out_bytes);
    Ok(js_array)
}

#[wasm_bindgen]
pub fn expand_canvas(
    image_data: &[u8],
    top: u32,
    bottom: u32,
    left: u32,
    right: u32,
    color: &str,
) -> Result<js_sys::Uint8Array, JsValue> {
    let img = image::load_from_memory(image_data).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    let new_w = w + left + right;
    let new_h = h + top + bottom;
    let mut out_img = RgbaImage::new(new_w, new_h);

    let c = parse_color(color);
    for y in 0..new_h {
        for x in 0..new_w {
            out_img.put_pixel(x, y, c);
        }
    }

    for y in 0..h {
        for x in 0..w {
            let p = *rgba.get_pixel(x, y);
            out_img.put_pixel(x + left, y + top, p);
        }
    }

    let mut out = std::io::Cursor::new(Vec::new());
    let format = image::guess_format(image_data).unwrap_or(image::ImageFormat::Png);
    out_img.write_to(&mut out, format).map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    let out_bytes = out.into_inner();
    let js_array = js_sys::Uint8Array::new_with_length(out_bytes.len() as u32);
    js_array.copy_from(&out_bytes);
    Ok(js_array)
}

#[wasm_bindgen]
pub fn split_image(
    image_data: &[u8],
    rows: u32,
    cols: u32,
) -> Result<js_sys::Array, JsValue> {
    let mut img = image::load_from_memory(image_data).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let (w, h) = img.dimensions();
    let cell_w = w / cols;
    let cell_h = h / rows;

    let format = image::guess_format(image_data).unwrap_or(image::ImageFormat::Png);
    let arr = js_sys::Array::new();

    for r in 0..rows {
        for c in 0..cols {
            let cropped = img.crop(c * cell_w, r * cell_h, cell_w, cell_h);
            let mut out = std::io::Cursor::new(Vec::new());
            cropped.write_to(&mut out, format).map_err(|e| JsValue::from_str(&e.to_string()))?;
            let out_bytes = out.into_inner();
            let js_array = js_sys::Uint8Array::new_with_length(out_bytes.len() as u32);
            js_array.copy_from(&out_bytes);
            arr.push(&js_array);
        }
    }
    Ok(arr)
}

#[wasm_bindgen]
pub fn stitch_images(
    images_data_array: js_sys::Array,
    direction: &str,
) -> Result<js_sys::Uint8Array, JsValue> {
    let mut imgs = Vec::new();
    let mut format = image::ImageFormat::Png;
    
    for i in 0..images_data_array.length() {
        let val = images_data_array.get(i);
        let uint8_arr = js_sys::Uint8Array::new(&val);
        let mut vec = vec![0; uint8_arr.length() as usize];
        uint8_arr.copy_to(&mut vec);
        
        if i == 0 {
            format = image::guess_format(&vec).unwrap_or(image::ImageFormat::Png);
        }
        let img = image::load_from_memory(&vec).map_err(|e| JsValue::from_str(&e.to_string()))?;
        imgs.push(img);
    }

    if imgs.is_empty() {
        return Err(JsValue::from_str("No images provided"));
    }

    let total_w: u32 = match direction {
        "horizontal" => imgs.iter().map(|i| i.width()).sum(),
        _ => imgs.iter().map(|i| i.width()).max().unwrap_or(0),
    };
    let total_h: u32 = match direction {
        "vertical" => imgs.iter().map(|i| i.height()).sum(),
        _ => imgs.iter().map(|i| i.height()).max().unwrap_or(0),
    };

    let mut out_img = RgbaImage::new(total_w, total_h);
    let mut offset = 0u32;

    for img in &imgs {
        let rgba = img.to_rgba8();
        match direction {
            "horizontal" => {
                for y in 0..rgba.height().min(total_h) {
                    for x in 0..rgba.width() {
                        let p = *rgba.get_pixel(x, y);
                        out_img.put_pixel(x + offset, y, p);
                    }
                }
                offset += img.width();
            }
            _ => {
                for y in 0..rgba.height() {
                    for x in 0..rgba.width().min(total_w) {
                        let p = *rgba.get_pixel(x, y);
                        out_img.put_pixel(x, y + offset, p);
                    }
                }
                offset += img.height();
            }
        }
    }

    let mut out = std::io::Cursor::new(Vec::new());
    out_img.write_to(&mut out, format).map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    let out_bytes = out.into_inner();
    let js_array = js_sys::Uint8Array::new_with_length(out_bytes.len() as u32);
    js_array.copy_from(&out_bytes);
    Ok(js_array)
}

fn parse_color(hex: &str) -> Rgba<u8> {
    let hex = hex.trim_start_matches('#');
    match hex.len() {
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(255);
            let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(255);
            let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(255);
            Rgba([r, g, b, 255])
        }
        _ => Rgba([255, 255, 255, 255]),
    }
}
