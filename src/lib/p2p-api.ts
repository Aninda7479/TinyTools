import { invoke } from "@tauri-apps/api/core";

export interface PortalResult {
  url: string;
  qr_code_base64: string;
  port: number;
}

export async function startWebPortal(filePath: string, password?: string): Promise<PortalResult> {
  return invoke<PortalResult>("start_web_portal", { filePath, password: password ?? null });
}

export async function stopWebPortal(): Promise<void> {
  return invoke<void>("stop_web_portal");
}

export async function cleanupP2P(): Promise<void> {
  return invoke<void>("cleanup");
}
