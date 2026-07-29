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
  sender_ip: string;
  encrypted: boolean;
  status: string;
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

export async function acceptTransfer(transferId: string): Promise<string> {
  return invoke<string>("accept_transfer", { transferId });
}

export async function rejectTransfer(transferId: string): Promise<void> {
  return invoke<void>("reject_transfer", { transferId });
}

export async function saveTransferAs(transferId: string, outputPath: string): Promise<void> {
  return invoke<void>("save_transfer_as", { transferId, outputPath });
}

export async function cleanupP2P(): Promise<void> {
  return invoke<void>("cleanup");
}
