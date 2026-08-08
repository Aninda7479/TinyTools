import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Globe, Upload, X, Shield, Eye, EyeOff, FileUp,
} from "lucide-react";
import * as p2p from "../lib/p2p-api";
import { isTauri, pickFile } from "../lib/tauri";
import P2PWebPortal from "./P2PWebPortal";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

export default function P2PSendPage() {
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [showSharePwd, setShowSharePwd] = useState(false);
  const [useSharePwd, setUseSharePwd] = useState(false);
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
    setError("");
  }, []);

  const clearFile = () => {
    setFilePath("");
    setFileName("");
  };

  const handleStartPortal = async () => {
    if (!isTauri()) {
      setError("Hosting a Local Web Portal requires the TinyTools Desktop App.");
      return;
    }
    if (!filePath) {
      setError("Select a file first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await p2p.startWebPortal(
        filePath,
        useSharePwd && sharePassword ? sharePassword : undefined,
      );
      setPortal(result);
    } catch (e: any) {
      setError(e?.toString() || "Failed to start portal");
    } finally {
      setLoading(false);
    }
  };

  const handleStopPortal = async () => {
    if (!isTauri()) return;
    try {
      await p2p.stopWebPortal();
      setPortal(null);
    } catch (e) {
      console.error("Failed to stop portal:", e);
    }
  };

  if (!isTauri()) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
          <Globe className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold">Desktop App Required</h2>
        <p className="text-sm text-white/50 leading-relaxed">
          Hosting a Local Web Portal requires spinning up a web server on your local network. Web browsers do not have the capability to act as network servers.
        </p>
        <p className="text-sm text-white/50 leading-relaxed mt-2">
          Please download the <span className="text-white/80 font-medium">TinyTools Desktop App</span> to share files securely across your network. (Recipients can still download via their browser!)
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Local Web Portal — Send</h2>
        <p className="text-sm text-white/40 mt-1">
          Share a file with anyone on the same Wi-Fi through their browser — no app needed
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              Share a File
            </span>
          </div>

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
                  onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  className="text-white/30 hover:text-white/60"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-white/30" />
                <p className="text-sm text-white/60">Click to select a file</p>
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
                <span className="text-xs text-white/60">Password protect download</span>
              </div>
              <button
                onClick={() => setUseSharePwd(!useSharePwd)}
                className={`w-8 h-4 rounded-full transition-colors relative ${
                  useSharePwd ? "bg-blue-500" : "bg-white/10"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform"
                  style={{
                    transform: useSharePwd ? "translateX(16px)" : "translateX(2px)",
                  }}
                />
              </button>
            </div>
            {useSharePwd && (
              <div className="relative">
                <input
                  type={showSharePwd ? "text" : "password"}
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  placeholder="Enter download password..."
                  className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 pr-9 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors"
                />
                <button
                  onClick={() => setShowSharePwd(!showSharePwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showSharePwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleStartPortal}
            disabled={loading || !filePath}
            className="w-full py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-40 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Globe className="w-4 h-4" />
            {loading ? "Starting..." : "Start Local Web Portal"}
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

        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0">
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
              <p className="text-sm text-white/50">No active local web portal</p>
              <p className="text-[10px] text-white/30 text-center max-w-xs">
                Select a file and click "Start Local Web Portal". Others can download your file
                at the share URL and send files to you at the receive URL.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
