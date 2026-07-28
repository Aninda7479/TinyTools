import { invoke } from "@tauri-apps/api/core";

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  extension: string;
}

export interface ToolResult {
  success: boolean;
  output_path: string | null;
  message: string;
}

export interface BatchResult {
  success: boolean;
  processed: number;
  failed: number;
  output_dir: string;
  message: string;
}

// AI Tools
export async function removeBackground(input: string, output: string): Promise<ToolResult> {
  return invoke<ToolResult>("remove_background", { inputPath: input, outputPath: output });
}
export async function inpaintImage(input: string, output: string, regions: [number, number, number, number][]): Promise<ToolResult> {
  return invoke<ToolResult>("inpaint_image", { inputPath: input, outputPath: output, regions });
}
export async function upscaleImage(input: string, output: string, scale: number): Promise<ToolResult> {
  return invoke<ToolResult>("upscale_image", { inputPath: input, outputPath: output, scale });
}
export async function colorizeImage(input: string, output: string): Promise<ToolResult> {
  return invoke<ToolResult>("colorize_image", { inputPath: input, outputPath: output });
}
export async function faceEnhance(input: string, output: string, strength: number): Promise<ToolResult> {
  return invoke<ToolResult>("face_enhance", { inputPath: input, outputPath: output, strength });
}
export async function depthBlur(input: string, output: string, blurStrength: number): Promise<ToolResult> {
  return invoke<ToolResult>("depth_blur", { inputPath: input, outputPath: output, blurStrength });
}

// Privacy
export async function stripMetadata(input: string, output: string): Promise<ToolResult> {
  return invoke<ToolResult>("strip_metadata", { inputPath: input, outputPath: output });
}
export async function redactRegions(input: string, output: string, regions: [number, number, number, number][], method: string): Promise<ToolResult> {
  return invoke<ToolResult>("redact_regions", { inputPath: input, outputPath: output, regions, method });
}
export async function addWatermark(input: string, output: string, text: string, opacity: number, position: string): Promise<ToolResult> {
  return invoke<ToolResult>("add_watermark", { inputPath: input, outputPath: output, text, opacity, position });
}

// Editing
export async function smartCrop(input: string, output: string, width: number, height: number, gravity: string): Promise<ToolResult> {
  return invoke<ToolResult>("smart_crop", { inputPath: input, outputPath: output, width, height, gravity });
}
export async function expandCanvas(input: string, output: string, top: number, bottom: number, left: number, right: number, color: string): Promise<ToolResult> {
  return invoke<ToolResult>("expand_canvas", { inputPath: input, outputPath: output, top, bottom, left, right, color });
}
export async function splitImage(input: string, outputDir: string, rows: number, cols: number): Promise<ToolResult> {
  return invoke<ToolResult>("split_image", { inputPath: input, outputDir: outputDir, rows, cols });
}
export async function stitchImages(paths: string[], output: string, direction: string): Promise<ToolResult> {
  return invoke<ToolResult>("stitch_images", { paths, outputPath: output, direction });
}

// Compression & Conversion
export async function smartCompress(input: string, output: string, quality: number, targetSizeKb?: number): Promise<ToolResult> {
  return invoke<ToolResult>("smart_compress", { inputPath: input, outputPath: output, quality, targetSizeKb: targetSizeKb ?? null });
}
export async function convertFormat(input: string, output: string): Promise<ToolResult> {
  return invoke<ToolResult>("convert_format", { inputPath: input, outputPath: output });
}
export async function convertHeic(input: string, output: string): Promise<ToolResult> {
  return invoke<ToolResult>("convert_heic", { inputPath: input, outputPath: output });
}
export async function rasterToSvg(input: string, output: string): Promise<ToolResult> {
  return invoke<ToolResult>("raster_to_svg", { inputPath: input, outputPath: output });
}

// Batch
export async function batchCompress(paths: string[], outputDir: string, quality: number, targetSizeKb?: number): Promise<BatchResult> {
  return invoke<BatchResult>("batch_compress", { inputPaths: paths, outputDir, quality, targetSizeKb: targetSizeKb ?? null });
}
export async function batchResize(paths: string[], outputDir: string, width: number, height: number): Promise<BatchResult> {
  return invoke<BatchResult>("batch_resize", { inputPaths: paths, outputDir, width, height });
}
export async function batchConvert(paths: string[], outputDir: string, targetFormat: string): Promise<BatchResult> {
  return invoke<BatchResult>("batch_convert", { inputPaths: paths, outputDir, targetFormat });
}
export async function batchWatermark(paths: string[], outputDir: string, text: string, opacity: number): Promise<BatchResult> {
  return invoke<BatchResult>("batch_watermark", { inputPaths: paths, outputDir, text, opacity });
}

// PDF Tools
export async function getPdfInfo(input: string): Promise<ToolResult> {
  return invoke<ToolResult>("get_pdf_info", { inputPath: input });
}
export async function mergePdfs(inputs: string[], output: string): Promise<ToolResult> {
  return invoke<ToolResult>("merge_pdfs", { inputPaths: inputs, outputPath: output });
}
export async function splitPdf(input: string, outputDir: string, pages?: string): Promise<ToolResult> {
  return invoke<ToolResult>("split_pdf", { inputPath: input, outputDir, pages: pages ?? null });
}
export async function reorderPages(input: string, output: string, newOrder: number[]): Promise<ToolResult> {
  return invoke<ToolResult>("reorder_pages", { inputPath: input, outputPath: output, newOrder });
}
export async function rotatePages(input: string, output: string, pages?: string, angle: number = 90): Promise<ToolResult> {
  return invoke<ToolResult>("rotate_pages", { inputPath: input, outputPath: output, pages: pages ?? null, angle });
}
export async function cropPages(input: string, output: string, pages?: string, top: number = 0, bottom: number = 0, left: number = 0, right: number = 0): Promise<ToolResult> {
  return invoke<ToolResult>("crop_pages", { inputPath: input, outputPath: output, pages: pages ?? null, top, bottom, left, right });
}
export async function deletePages(input: string, output: string, pagesToDelete: number[]): Promise<ToolResult> {
  return invoke<ToolResult>("delete_pages", { inputPath: input, outputPath: output, pagesToDelete });
}
export async function imagesToPdf(inputs: string[], output: string, margin: number = 20): Promise<ToolResult> {
  return invoke<ToolResult>("images_to_pdf", { inputPaths: inputs, outputPath: output, margin });
}
export async function extractPdfText(input: string): Promise<ToolResult> {
  return invoke<ToolResult>("extract_text", { inputPath: input });
}
export async function encryptPdf(input: string, output: string, userPassword: string, ownerPassword: string): Promise<ToolResult> {
  return invoke<ToolResult>("encrypt_pdf", { inputPath: input, outputPath: output, userPassword, ownerPassword });
}
export async function decryptPdf(input: string, output: string): Promise<ToolResult> {
  return invoke<ToolResult>("decrypt_pdf", { inputPath: input, outputPath: output });
}
export async function compressPdf(input: string, output: string): Promise<ToolResult> {
  return invoke<ToolResult>("compress_pdf", { inputPath: input, outputPath: output });
}
export async function flattenPdf(input: string, output: string): Promise<ToolResult> {
  return invoke<ToolResult>("flatten_pdf", { inputPath: input, outputPath: output });
}
export async function addPdfWatermark(input: string, output: string, text: string, fontSize: number, opacity: number, angle: number): Promise<ToolResult> {
  return invoke<ToolResult>("add_pdf_watermark", { inputPath: input, outputPath: output, text, fontSize, opacity, angle });
}
export async function addPageNumbers(input: string, output: string, fontSize: number = 12, position: string = "bottom-center"): Promise<ToolResult> {
  return invoke<ToolResult>("add_page_numbers", { inputPath: input, outputPath: output, fontSize, position });
}

// Password Generator
export interface PasswordRequest {
  mode: string;
  length?: number;
  word_count?: number;
  count?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
  exclude_ambiguous?: boolean;
  custom_symbols?: string;
  separator?: string;
  pattern?: string;
}

export interface GeneratedPassword {
  password: string;
  entropy_bits: number;
  strength_label: string;
  charset_size: number;
  length: number;
}

export interface BulkPasswordResult {
  passwords: GeneratedPassword[];
  count: number;
  exported_path: string | null;
}

export async function generatePassword(req: PasswordRequest): Promise<GeneratedPassword> {
  return invoke<GeneratedPassword>("generate_password", { req });
}

export async function generateBulkPasswords(req: PasswordRequest): Promise<BulkPasswordResult> {
  return invoke<BulkPasswordResult>("generate_bulk", { req });
}

export async function exportPasswords(passwords: string[], format: string, outputPath: string): Promise<string> {
  return invoke<string>("export_passwords", { passwords, format, outputPath });
}
