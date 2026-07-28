import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Download,
  Globe,
  Upload,
  X,
  Radio,
  Shield,
  Eye,
  EyeOff,
  FileUp,
} from "lucide-react";
import * as p2p from "../lib/p2p-api";
import { pickFile } from "../lib/tauri";
import P2PPeerList from "./P2PPeerList";
import P2PTransferProgress from "./P2PTransferProgress";
import P2PWebPortal from "./P2PWebPortal";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

type Tab = "send" | "receive" | "portal";

interface ActiveTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  direction: "send" | "receive";
}

export default function P2PPage() {
  const [tab, setTab] = useState<Tab>("send");
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [activeTransfers, setActiveTransfers] = useState<ActiveTransfer[]>([]);
  const [portal, setPortal] = useState<p2p.PortalResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      p2p.cleanupP2P().catch(() => {});
    };
  }, []);

  const openPicker = useCallback(async () => {
    const picked = await pickFile();
    if (!picked) return;
    setFilePath(picked.path);
    setFileName(picked.name);
    setFileSize(picked.size);
    setError("");
  }, []);

  const clearFile = () => {
    setFilePath("");
    setFileName("");
    setFileSize(0);
  };

  const handleSendToPeer = async (peer: p2p.PeerInfo) => {
    if (!filePath) {
      setError("Select a file first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await p2p.sendFile(
        filePath,
        peer.ip,
        usePassword && password ? password : undefined
      );
      if (result.success) {
        setActiveTransfers((prev) => [
          ...prev,
          {
            id: result.transfer_id,
            fileName,
            fileSize,
            direction: "send",
          },
        ]);
        clearFile();
      } else {
        setError(result.message);
      }
    } catch (e: any) {
      setError(e?.toString() || "Send failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStartPortal = async () => {
    if (!filePath) {
      setError("Select a file first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await p2p.startWebPortal(
        filePath,
        usePassword && password ? password : undefined
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

  const tabs: { id: Tab; icon: typeof Send; label: string }[] = [
    { id: "send", icon: Send, label: "Send" },
    { id: "receive", icon: Download, label: "Receive" },
    { id: "portal", icon: Globe, label: "Web Portal" },
  ];

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">P2P File Sharing</h2>
        <p className="text-sm text-white/40 mt-1">
          Send files to nearby devices or share via web portal — no server required
        </p>
      </div>

      <div className="flex gap-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                tab === t.id
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              {tab === "send"
                ? "Select File to Send"
                : tab === "portal"
                ? "Select File to Share"
                : "Receive Settings"}
            </span>
          </div>

          {tab !== "receive" && (
            <>
              <motion.div
                animate={{
                  borderColor: "rgba(255,255,255,0.1)",
                  backgroundColor: "rgba(255,255,255,0.02)",
                }}
                transition={spring}
                className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-white/20 transition-colors"
                onClick={openPicker}
              >
                {fileName ? (
                  <div className="flex items-center gap-2">
                    <FileUp className="w-5 h-5 text-blue-400" />
                    <span className="text-sm text-white/70">{fileName}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                      className="text-white/30 hover:text-white/60"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-white/30" />
                    <p className="text-sm text-white/60">
                      Click to select a file
                    </p>
                  </>
                )}
              </motion.div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">
                  Protection
                </span>
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-border">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-xs text-white/60">Password protect</span>
                  </div>
                  <button
                    onClick={() => setUsePassword(!usePassword)}
                    className={`w-8 h-4 rounded-full transition-colors relative ${
                      usePassword ? "bg-blue-500" : "bg-white/10"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform"
                      style={{
                        transform: usePassword
                          ? "translateX(16px)"
                          : "translateX(2px)",
                      }}
                    />
                  </button>
                </div>
                {usePassword && (
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password..."
                      className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 pr-9 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {tab === "send" && (
                <button
                  onClick={handleStartPortal}
                  disabled={loading || !filePath}
                  className="w-full py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-40 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Globe className="w-4 h-4" />
                  {loading ? "Starting..." : "Open Web Portal"}
                </button>
              )}

              {tab === "portal" && (
                <button
                  onClick={handleStartPortal}
                  disabled={loading || !filePath}
                  className="w-full py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-40 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Globe className="w-4 h-4" />
                  {loading ? "Starting..." : "Start Web Portal"}
                </button>
              )}
            </>
          )}

          {tab === "receive" && (
            <div className="space-y-3">
              <div className="py-8 text-center">
                <Radio className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/50 mb-1">Ready to Receive</p>
                <p className="text-[10px] text-white/30">
                  Other TinyTools devices on your network can send files to this device.
                  The web portal can also receive files from any browser.
                </p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-white/5 border border-border">
                <p className="text-[10px] text-white/30">
                  Port: 8787 (receiver mode)
                </p>
              </div>
            </div>
          )}

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

        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <AnimatePresence mode="wait">
            {tab === "send" && (
              <motion.div
                key="send-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={spring}
                className="flex-1 flex flex-col gap-3 min-h-0"
              >
                <P2PPeerList
                  onSend={handleSendToPeer}
                  disabled={!filePath || loading}
                />

                {activeTransfers.filter((t) => t.direction === "send").length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">
                      Transfers
                    </span>
                    {activeTransfers
                      .filter((t) => t.direction === "send")
                      .map((t) => (
                        <P2PTransferProgress
                          key={t.id}
                          transferId={t.id}
                          fileName={t.fileName}
                          fileSize={t.fileSize}
                          direction="send"
                          onCancel={() =>
                            setActiveTransfers((prev) =>
                              prev.filter((x) => x.id !== t.id)
                            )
                          }
                        />
                      ))}
                  </div>
                )}

                {portal && (
                  <P2PWebPortal
                    url={portal.url}
                    qrCodeBase64={portal.qr_code_base64}
                    port={portal.port}
                    onStop={handleStopPortal}
                  />
                )}
              </motion.div>
            )}

            {tab === "receive" && (
              <motion.div
                key="receive-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={spring}
                className="flex-1 flex flex-col items-center justify-center text-white/20 rounded-xl bg-white/5 border border-border"
              >
                <Download className="w-10 h-10 mb-3" />
                <p className="text-sm">No incoming transfers</p>
                <p className="text-[10px] text-white/10 mt-2">
                  Files sent from other TinyTools devices will appear here
                </p>
              </motion.div>
            )}

            {tab === "portal" && (
              <motion.div
                key="portal-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={spring}
                className="flex-1 flex flex-col items-center justify-center gap-4"
              >
                {portal ? (
                  <P2PWebPortal
                    url={portal.url}
                    qrCodeBase64={portal.qr_code_base64}
                    port={portal.port}
                    onStop={handleStopPortal}
                  />
                ) : (
                  <>
                    <Globe className="w-10 h-10 text-white/10" />
                    <p className="text-sm text-white/50">No active web portal</p>
                    <p className="text-[10px] text-white/30 text-center max-w-xs">
                      Select a file and click "Start Web Portal" to generate a QR code.
                      Anyone on the same Wi-Fi can download the file through their browser.
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-[10px] text-white/20 text-center">
            All transfers are end-to-end encrypted over local Wi-Fi — zero cloud dependency
          </div>
        </div>
      </div>
    </div>
  );
}
