import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, Check, AlertCircle, Send, Download } from "lucide-react";
import * as p2p from "../lib/p2p-api";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1048576) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1048576).toFixed(1)} MB/s`;
}

function formatEta(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

interface TransferProgressProps {
  transferId: string;
  fileName: string;
  fileSize: number;
  direction: "send" | "receive";
  onCancel: () => void;
}

export default function P2PTransferProgress({
  transferId,
  fileName,
  direction,
  onCancel,
}: TransferProgressProps) {
  const [progress, setProgress] = useState<p2p.TransferInfo | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const poll = async () => {
      try {
        const info = await p2p.getTransferProgress(transferId);
        setProgress(info);
        if (info.status === "completed") {
          setDone(true);
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else if (info.status === "failed") {
          setError("Transfer failed");
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else if (info.status === "cancelled") {
          setError("Transfer cancelled");
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (e: any) {
        setError(e?.toString() || "Transfer error");
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [transferId]);

  const handleCancel = async () => {
    try {
      await p2p.cancelTransfer(transferId);
      onCancel();
    } catch (e) {
      console.error("Cancel failed:", e);
    }
  };

  const pct = progress
    ? progress.file_size > 0
      ? Math.min(100, Math.round((progress.bytes_sent / progress.file_size) * 100))
      : 0
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-xl bg-white/5 border border-border"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {direction === "send" ? (
            <Send className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <Download className="w-3.5 h-3.5 text-green-400" />
          )}
          <span className="text-xs font-medium text-white/80 truncate max-w-[200px]">
            {fileName}
          </span>
        </div>
        {!done && !error && (
          <button
            onClick={handleCancel}
            className="text-white/30 hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {done && <Check className="w-4 h-4 text-green-400" />}
        {error && <AlertCircle className="w-4 h-4 text-red-400" />}
      </div>

      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
        <motion.div
          className={`h-full rounded-full ${
            done ? "bg-green-400" : error ? "bg-red-400" : "bg-blue-400"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30">
          {progress
            ? `${formatSize(progress.bytes_sent)} / ${formatSize(progress.file_size)}`
            : "Starting..."}
        </span>
        <span className="text-[10px] text-white/30">
          {done
            ? "Complete"
            : error
            ? error
            : progress?.speed_bps
            ? `${formatSpeed(progress.speed_bps)} · ETA ${formatEta(progress.eta_secs)}`
            : ""}
        </span>
      </div>
    </motion.div>
  );
}
