import { invoke } from "@tauri-apps/api/core";

export interface PeerInfo {
  name: string;
  ip: string;
  port: number;
  hostname: string;
}

export interface PeerListResult {
  peers: PeerInfo[];
}

export interface TransferInfo {
  id: string;
  file_name: string;
  file_size: number;
  peer_ip: string;
  encrypted: boolean;
  status: string;
  bytes_sent: number;
  speed_bps: number;
  eta_secs: number;
}

export interface SendResult {
  success: boolean;
  transfer_id: string;
  message: string;
}

export interface PortalResult {
  url: string;
  qr_code_base64: string;
  port: number;
}

export async function startDiscovery(): Promise<PeerListResult> {
  return invoke<PeerListResult>("start_discovery");
}

export async function stopDiscovery(): Promise<void> {
  return invoke<void>("stop_discovery");
}

export async function getPeers(): Promise<PeerListResult> {
  return invoke<PeerListResult>("get_peers");
}

export async function sendFile(filePath: string, peerIp: string, password?: string): Promise<SendResult> {
  return invoke<SendResult>("send_file", { filePath, peerIp, password: password ?? null });
}

export async function startWebPortal(filePath: string, password?: string): Promise<PortalResult> {
  return invoke<PortalResult>("start_web_portal", { filePath, password: password ?? null });
}

export async function stopWebPortal(): Promise<void> {
  return invoke<void>("stop_web_portal");
}

export async function getTransferProgress(transferId: string): Promise<TransferInfo> {
  return invoke<TransferInfo>("get_transfer_progress", { transferId });
}

export async function cancelTransfer(transferId: string): Promise<void> {
  return invoke<void>("cancel_transfer", { transferId });
}

export async function isReceiving(): Promise<boolean> {
  return invoke<boolean>("is_receiving");
}

export async function startReceiving(): Promise<void> {
  return invoke<void>("start_receiving");
}

export async function stopReceiving(): Promise<void> {
  return invoke<void>("stop_receiving");
}

export async function cleanupP2P(): Promise<void> {
  return invoke<void>("cleanup");
}
