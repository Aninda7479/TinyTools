import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Globe, Upload, X, Shield, Eye, EyeOff, FileUp, Copy, Check, Wifi, WifiOff } from "lucide-react";
import * as p2p from "../lib/p2p-api";
import { pickFile } from "../lib/tauri";
import QRCode from "qrcode";

export default function GlobalSharePage() {
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [showSharePwd, setShowSharePwd] = useState(false);
  const [useSharePwd, setUseSharePwd] = useState(false);
  const [portal, setPortal] = useState<p2p.PortalResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedLocal, setCopiedLocal] = useState(false);
  const [upnpOk, setUpnpOk] = useState(false);
  const qrGenerated = useRef(false);

  useEffect(() => {
    return () => { p2p.cleanupP2P().catch(() => {}); };
  }, []);

  useEffect(() => {
    if (publicUrl && !qrGenerated.current) {
      qrGenerated.current = true;
      QRCode.toDataURL(publicUrl, { width: 300, margin: 2 }).then(setQrDataUrl).catch(() => {});
    }
  }, [publicUrl]);

  const openPicker = useCallback(async () => {
    const picked = await pickFile();
    if (!picked) return;
    setFilePath(picked.path);
    setFileName(picked.name);
    setError("");
  }, []);

  const clearFile = () => { setFilePath(""); setFileName(""); };

  const handleStartPortal = async () => {
    if (!filePath) { setError("Select a file first"); return; }
    setLoading(true);
    setError("");
    qrGenerated.current = false;
    try {
      const result = await p2p.startWebPortal(
        filePath,
        useSharePwd && sharePassword ? sharePassword : undefined,
      );
      setPortal(result);
      setUpnpOk(result.upnp_success);

      try {
        const resp = await fetch("https://api.ipify.org?format=json");
        const data = await resp.json();
        if (data.ip) {
          setPublicUrl(`https://${data.ip}:${result.port}`);
        }
      } catch {
        // public IP lookup failed, only local URL available
      }
    } catch (e: any) {
      setError(e?.toString() || "Failed to start global share");
    } finally {
      setLoading(false);
    }
  };

  const handleStopPortal = async () => {
    try {
      await p2p.stopWebPortal();
      setPortal(null);
      setPublicUrl("");
      setQrDataUrl("");
      qrGenerated.current = false;
    } catch (e) {
      console.error("Failed to stop portal:", e);
    }
  };

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Global Share</h2>
        <p className="text-sm text-white/40 mt-1">
          Share files over the internet — anyone with the URL can download through their browser
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Share a File</span>
          </div>

          <motion.div
            animate={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.02)" }}
            className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-white/20 transition-colors"
            onClick={openPicker}
          >
            {fileName ? (
              <div className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-white/70 truncate max-w-[200px]">{fileName}</span>
                <button onClick={(e) => { e.stopPropagation(); clearFile(); }} className="text-white/30 hover:text-white/60">
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
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Protection</span>
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-border">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-white/40" />
                <span className="text-xs text-white/60">Password protect download</span>
              </div>
              <button
                onClick={() => setUseSharePwd(!useSharePwd)}
                className={`w-8 h-4 rounded-full transition-colors relative ${useSharePwd ? "bg-blue-500" : "bg-white/10"}`}
              >
                <div className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform"
                  style={{ transform: useSharePwd ? "translateX(16px)" : "translateX(2px)" }} />
              </button>
            </div>
            {useSharePwd && (
              <div className="relative">
                <input type={showSharePwd ? "text" : "password"} value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  placeholder="Enter download password..."
                  className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 pr-9 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors" />
                <button onClick={() => setShowSharePwd(!showSharePwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showSharePwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          <button onClick={handleStartPortal} disabled={loading || !filePath}
            className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 text-sm font-medium flex items-center justify-center gap-2">
            <Globe className="w-4 h-4" />
            {loading ? "Starting..." : "Start Global Share"}
          </button>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</motion.div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0">
          {portal ? (
            <div className="flex flex-col items-center gap-4 w-full max-w-md">
              {publicUrl ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full p-4 rounded-xl bg-white/5 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-medium text-white/80">Global Share Active</span>
                    <div className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  </div>

                  <div className="flex justify-center mb-3">
                    {qrDataUrl ? (
                      <div className="p-3 rounded-xl bg-white">
                        <img src={qrDataUrl} alt="QR Code" className="w-40 h-40" />
                      </div>
                    ) : (
                      <div className="w-40 h-40 rounded-xl bg-white/5 flex items-center justify-center">
                        <span className="text-[10px] text-white/30">Loading QR...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <Wifi className="w-3 h-3 text-green-400" />
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">Global URL</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-border font-mono text-xs text-white/70 truncate">
                      {publicUrl}
                    </div>
                    <button onClick={() => handleCopy(publicUrl, setCopied)}
                      className="px-2.5 py-2 rounded-lg bg-white/5 border border-border text-white/50 hover:text-white/80 transition-colors">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <WifiOff className="w-3 h-3 text-white/30" />
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Local URL (same network)</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-border font-mono text-xs text-white/50 truncate">
                      {portal.url}
                    </div>
                    <button onClick={() => handleCopy(portal.url, setCopiedLocal)}
                      className="px-2.5 py-2 rounded-lg bg-white/5 border border-border text-white/30 hover:text-white/60 transition-colors">
                      {copiedLocal ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <p className="text-[10px] text-white/30 text-center mb-3">
                    Scan the QR code or share the Global URL. Recipients download directly from your device.
                  </p>
                  {!upnpOk && (
                    <div className="px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-3">
                      <p className="text-[9px] text-yellow-400/80 text-center">
                        Port forwarding required — your router doesn&apos;t support UPnP or it&apos;s disabled.
                        Manually forward port <strong>{portal.port}</strong> (TCP) to this device for external access.
                      </p>
                    </div>
                  )}

                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleStopPortal}
                    className="w-full py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-xs hover:bg-red-500/30 transition-colors">
                    Stop Global Share
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="w-full p-4 rounded-xl bg-white/5 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium text-white/80">Portal Started (Local Only)</span>
                    <div className="ml-auto w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  </div>
                  <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-border font-mono text-xs text-white/70 text-center mb-3">
                    {portal.url}
                  </div>
                  <p className="text-[10px] text-white/30 text-center mb-3">
                    Could not detect public IP. Share the local URL for same-network access only.
                  </p>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleStopPortal}
                    className="w-full py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-xs hover:bg-red-500/30 transition-colors">
                    Stop
                  </motion.button>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Globe className="w-10 h-10 text-white/10" />
              <p className="text-sm text-white/50">Select a file and click "Start Global Share"</p>
              <p className="text-[10px] text-white/30 text-center max-w-xs">
                A secure HTTPS link will be generated. Anyone with the URL can download your file
                directly from your device — no third party involved.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
