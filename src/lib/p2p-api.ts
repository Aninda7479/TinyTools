import { invoke } from "@tauri-apps/api/core";

export interface PortalResult {
  url: string;
  receive_url: string;
  qr_code_base64: string;
  port: number;
}

export interface IncomingTransferInfo {
  id: string;
  file_name: string;
  file_size: number;
  received_bytes: number;
  sender_ip: string;
  encrypted: boolean;
  status: string;
  save_path: string | null;
  created_at: number;
}

export async function startWebPortal(
  filePath: string | null,
  password?: string,
  receivePassword?: string
): Promise<PortalResult> {
  return invoke<PortalResult>("start_web_portal", {
    filePath: filePath ?? null,
    password: password ?? null,
    receivePassword: receivePassword ?? null,
  });
}

export async function stopWebPortal(): Promise<void> {
  return invoke<void>("stop_web_portal");
}

export async function getPendingTransfers(): Promise<IncomingTransferInfo[]> {
  return invoke<IncomingTransferInfo[]>("get_pending_transfers");
}

export async function acceptTransfer(transferId: string, savePath: string): Promise<void> {
  return invoke<void>("accept_transfer", { transferId, savePath });
}

export async function rejectTransfer(transferId: string): Promise<void> {
  return invoke<void>("reject_transfer", { transferId });
}

export async function revealInFolder(path: string): Promise<void> {
  return invoke<void>("reveal_in_folder", { path });
}

export async function cleanupP2P(): Promise<void> {
  return invoke<void>("cleanup");
}
