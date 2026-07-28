import { invoke } from "@tauri-apps/api/core";

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  extension: string;
}

export interface ImageProcessResult {
  success: boolean;
  output_path: string | null;
  message: string;
}

export async function compressImage(
  inputPath: string,
  outputPath: string,
  quality: number
): Promise<ImageProcessResult> {
  return invoke<ImageProcessResult>("compress_image", {
    inputPath,
    outputPath,
    quality,
  });
}

export async function generateQrCode(
  data: string,
  outputPath: string
): Promise<ImageProcessResult> {
  return invoke<ImageProcessResult>("generate_qr_code", { data, outputPath });
}

export async function getFileInfo(path: string): Promise<FileInfo> {
  return invoke<FileInfo>("get_file_info", { path });
}

export async function processImage(
  inputPath: string,
  outputPath: string,
  operation: string,
  params?: string
): Promise<ImageProcessResult> {
  return invoke<ImageProcessResult>("process_image", {
    inputPath,
    outputPath,
    operation,
    params,
  });
}
