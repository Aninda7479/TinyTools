pub mod types;
pub mod ai_tools;
pub mod editing;
pub mod conversion;
pub mod privacy;
pub mod process;

pub use types::{FileInfo, ImageProcessResult, ToolResult};

pub use ai_tools::{
    depth_blur, inpaint_image, remove_background, sepia_filter, smart_sharpen, upscale_image,
};
pub use editing::{expand_canvas, smart_crop, split_image, stitch_images};
pub use conversion::{
    compress_image, convert_format, convert_heic, flip_image, grayscale, resize_image,
    raster_to_svg, rotate_image, sharpen_image, blur_image,
};
pub use privacy::{add_image_watermark, add_watermark, redact_regions, strip_metadata};
pub use process::process_image;

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}