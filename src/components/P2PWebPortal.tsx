import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Copy, Check, Upload } from "lucide-react";

interface P2PWebPortalProps {
  url: string;
  qrCodeBase64: string;
  port: number;
  onStop: () => void;
  variant?: "send" | "receive";
}

export default function P2PWebPortal({
  url,
  qrCodeBase64,
  onStop,
  variant = "send",
}: P2PWebPortalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedRecv, setCopiedRecv] = useState(false);

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4"
    >
      <div className="w-full p-4 rounded-xl bg-white/5 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium text-white/80">Local Web Portal Active</span>
          <div className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>

        <div className="flex justify-center mb-3">
          <div className="p-3 rounded-xl bg-white">
            <img
              src={`data:image/png;base64,${qrCodeBase64}`}
              alt="QR Code"
              className="w-40 h-40"
            />
          </div>
        </div>

        {variant === "send" && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Download</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-border font-mono text-xs text-white/70 truncate">
                {url}
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCopy(url, setCopiedUrl)}
                className="px-2.5 py-2 rounded-lg bg-white/5 border border-border text-white/50 hover:text-white/80 transition-colors"
              >
                {copiedUrl ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </motion.button>
            </div>
          </>
        )}

        {variant === "receive" && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Upload className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Upload</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-border font-mono text-xs text-white/70 truncate">
                {url}
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCopy(url, setCopiedRecv)}
                className="px-2.5 py-2 rounded-lg bg-white/5 border border-border text-white/50 hover:text-white/80 transition-colors"
              >
                {copiedRecv ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </motion.button>
            </div>
            <p className="text-[10px] text-white/30 text-center mb-3">
              Others can upload files to you at this URL.
            </p>
          </>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStop}
          className="w-full py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-xs hover:bg-red-500/30 transition-colors"
        >
          Stop Portal
        </motion.button>
      </div>
    </motion.div>
  );
}
