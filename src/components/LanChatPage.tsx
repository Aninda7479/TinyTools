import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle, Copy, Check, Shield, Eye, EyeOff, ExternalLink, X, Users,
} from "lucide-react";
import * as chat from "../lib/chat-api";

export default function LanChatPage() {
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [room, setRoom] = useState<chat.ChatRoomResult | null>(null);
  const [status, setStatus] = useState<chat.ChatRoomStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (room) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const s = await chat.getChatRoomStatus();
          setStatus(s);
        } catch {
          // ignore
        }
      }, 2000);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [room]);

  const handleStart = async () => {
    if (!password) {
      setError("Set a room password first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await chat.startChatRoom(password);
      setRoom(result);
    } catch (e: any) {
      setError(e?.toString() || "Failed to start chat room");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      await chat.stopChatRoom();
      setRoom(null);
      setStatus(null);
    } catch (e) {
      setError(e?.toString() || "Failed to stop chat room");
    }
  };

  const handleOpen = () => {
    if (room) window.open(room.url, "_blank");
  };

  const handleCopy = async () => {
    if (!room) return;
    await navigator.clipboard.writeText(room.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">LAN Chat</h2>
        <p className="text-sm text-white/40 mt-1">
          Host an end-to-end encrypted chat room on your local network — text, images & files. No cloud, nothing is stored.
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Create a Room</span>
            <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs text-white/70">Room password (shared secret)</span>
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed mb-2">
                Everyone who joins enters this password. Messages are encrypted in each browser with a
                key derived from it — the host only relays ciphertext.
              </p>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter room password..."
                  className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 pr-9 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors"
                />
                <button
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={loading || !!room}
            className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 text-sm font-medium flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            {loading ? "Starting..." : room ? "Room Active" : "Start Chat Room"}
          </button>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</motion.div>
          )}

          <div className="space-y-2">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">How it works</span>
            <div className="space-y-2">
              <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-border">
                <p className="text-xs text-white/70 font-medium mb-1">1. Start the room</p>
                <p className="text-[10px] text-white/40">
                  A secure HTTPS link is generated on your device. Share the URL and the password with people on your network.
                </p>
              </div>
              <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-border">
                <p className="text-xs text-white/70 font-medium mb-1">2. They open it in any browser</p>
                <p className="text-[10px] text-white/40">
                  Everyone visits <code className="text-white/60">https://&lt;ip&gt;:&lt;port&gt;/chat</code>, enters the password and a display name.
                </p>
              </div>
              <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-border">
                <p className="text-xs text-white/70 font-medium mb-1">3. Everyone is notified</p>
                <p className="text-[10px] text-white/40">
                  Join / leave notices appear for all members. Unlimited participants. No limits.
                </p>
              </div>
            </div>
          </div>

          <div className="px-3 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-[10px] text-yellow-400/80">
              The chat is ephemeral — messages and files live only in memory and are erased when the
              room stops. Files relay through your device (in-memory, max 50 MB) and auto-expire.
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0">
          {room ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md p-4 rounded-xl bg-white/5 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs font-medium text-white/80">Chat Room Active</span>
                <div className="ml-auto flex items-center gap-1.5 text-[10px] text-white/40">
                  <Users className="w-3 h-3" />
                  {status ? `${status.member_count} member${status.member_count === 1 ? "" : "s"}` : "..."}
                </div>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </div>

              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-xl bg-white">
                  <img
                    src={`data:image/png;base64,${room.qr_code_base64}`}
                    alt="QR Code"
                    className="w-40 h-40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Room URL</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-border font-mono text-xs text-white/70 truncate">
                  {room.url}
                </div>
                <button onClick={handleCopy}
                  className="px-2.5 py-2 rounded-lg bg-white/5 border border-border text-white/50 hover:text-white/80 transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <p className="text-[10px] text-white/30 text-center mb-3">
                Scan the QR code or share the URL + room password with people on the same network.
                Everyone chats in their browser.
              </p>

              <div className="flex gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleOpen}
                  className="flex-1 py-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-1.5">
                  <ExternalLink className="w-3 h-3" />
                  Open in Browser
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleStop}
                  className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-xs hover:bg-red-500/30 transition-colors flex items-center justify-center gap-1.5">
                  <X className="w-3 h-3" />
                  Stop Room
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <MessageCircle className="w-10 h-10 text-white/10" />
              <p className="text-sm text-white/50">Set a password and start a room to begin</p>
              <p className="text-[10px] text-white/30 text-center max-w-xs">
                Your device becomes the encrypted relay on the local network. Participants only need a
                browser — no app, no account, no cloud.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
