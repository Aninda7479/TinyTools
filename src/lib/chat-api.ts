import { invoke } from "@tauri-apps/api/core";

export interface ChatRoomResult {
  url: string;
  qr_code_base64: string;
  port: number;
}

export interface ChatRoomStatus {
  running: boolean;
  url: string | null;
  member_count: number;
}

export async function startChatRoom(password: string): Promise<ChatRoomResult> {
  return invoke<ChatRoomResult>("start_chat_room", { password });
}

export async function stopChatRoom(): Promise<void> {
  return invoke<void>("stop_chat_room");
}

export async function getChatRoomStatus(): Promise<ChatRoomStatus> {
  return invoke<ChatRoomStatus>("get_chat_room_status");
}
