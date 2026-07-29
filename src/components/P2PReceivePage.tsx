import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Download, Eye, EyeOff, FileDown,
} from "lucide-react";
import * as p2p from "../lib/p2p-api";
import { saveFile, pickDirectory } from "../lib/tauri";
import P2PWebPortal from "./P2PWebPortal";

export default function P2PReceivePage() {
  const [receivePassword, setReceivePassword] = useState("");
  const [showRecvPwd, setShowRecvPwd] = useState(false);
  const [portal, setPortal] = useState<p2p.PortalResult | null>(null);
  const [fileList, setFileList] = useState<p2p.IncomingTransferInfo[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      p2p.cleanupP2P().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!portal) {
      setFileList([]);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const files = await p2p.getPendingTransfers();
        setFileList(files);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [portal]);

  const handleStartPortal = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await p2p.startWebPortal(
        null,
        undefined,
        receivePassword || undefined,
      );
      setPortal(result);
    } catch (e: any) {
      setError(e?.toString() || "Failed to start portal");
    } finally {
      setLoading(false);
    }
  };

  const handleStopPortal = async () => {
    try {
      await p2p.stopWebPortal();
      setPortal(null);
    } catch (e) {
      console.error("Failed to stop portal:", e);
    }
  };

  const handleDownload = async (id: string) => {
    const file = fileList.find((t) => t.id === id);
    if (!file) return;
    const dest = await saveFile(file.file_name);
    if (!dest) return;
    setSaving(id);
    try {
      await p2p.saveTransferAs(id, dest);
      setFileList((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e?.toString() || "Failed to save file");
    } finally {
      setSaving(null);
    }
  };

  const handleDownloadAll = async () => {
    if (fileList.length === 0) return;
    const dir = await pickDirectory();
    if (!dir) return;
    const sep = dir.includes("\\") ? "\\" : "/";
    setSaving("all");
    try {
      for (const file of fileList) {
        await p2p.saveTransferAs(file.id, dir + sep + file.file_name);
      }
      setFileList([]);
    } catch (e: any) {
      setError(e?.toString() || "Failed to save files");
    } finally {
      setSaving(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Local Web Portal — Receive</h2>
        <p className="text-sm text-white/40 mt-1">
          Receive files from anyone on the same Wi-Fi through their browser
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              Upload Password
            </span>
            <div className="relative">
              <input
                type={showRecvPwd ? "text" : "password"}
                value={receivePassword}
                onChange={(e) => setReceivePassword(e.target.value)}
                placeholder="Password (optional)..."
                className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 pr-9 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors"
              />
              <button
                onClick={() => setShowRecvPwd(!showRecvPwd)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showRecvPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleStartPortal}
            disabled={loading || !!portal}
            className="w-full py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-40 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Globe className="w-4 h-4" />
            {loading ? "Starting..." : "Start Web Portal (Receive)"}
          </button>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
            >
              {error}
            </motion.div>
          )}

        </div>

        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
          {portal ? (
            <>
              <div className="flex flex-col items-center justify-center gap-4 shrink-0">
                <P2PWebPortal
                  url={portal.url}
                  qrCodeBase64={portal.qr_code_base64}
                  port={portal.port}
                  onStop={handleStopPortal}
                  variant="receive"
                />
              </div>

              <AnimatePresence>
                {fileList.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md mx-auto space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">
                        Uploaded Files ({fileList.length})
                      </span>
                      {fileList.length > 1 && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleDownloadAll}
                          disabled={saving === "all"}
                          className="px-2.5 py-1 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] hover:bg-green-500/30 transition-colors disabled:opacity-40 flex items-center gap-1"
                        >
                          <FileDown className="w-2.5 h-2.5" />
                          {saving === "all" ? "Saving..." : "Download All"}
                        </motion.button>
                      )}
                    </div>
                    {fileList.map((t) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="px-3 py-2.5 rounded-xl bg-white/5 border border-border flex items-center gap-3"
                      >
                        <Download className="w-4 h-4 text-blue-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/80 truncate">{t.file_name}</p>
                          <p className="text-[10px] text-white/30">
                            {formatSize(t.file_size)} &middot; {t.sender_ip}
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDownload(t.id)}
                          disabled={saving === t.id}
                          className="px-2.5 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-[11px] hover:bg-green-500/30 transition-colors disabled:opacity-40 flex items-center gap-1 shrink-0"
                        >
                          <FileDown className="w-3 h-3" />
                          {saving === t.id ? "Saving..." : "Download"}
                        </motion.button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Globe className="w-10 h-10 text-white/10" />
              <p className="text-sm text-white/50">No active local web portal</p>
              <p className="text-[10px] text-white/30 text-center max-w-xs">
                Click "Start Web Portal (Receive)" to begin receiving files.
                Share the receive URL with others on your Wi-Fi.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
