import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Radio, Monitor, Smartphone, Laptop, RefreshCw } from "lucide-react";
import * as p2p from "../lib/p2p-api";

interface PeerListProps {
  onSend: (peer: p2p.PeerInfo) => void;
  disabled: boolean;
}

export default function P2PPeerList({ onSend, disabled }: PeerListProps) {
  const [peers, setPeers] = useState<p2p.PeerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const refreshPeers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await p2p.getPeers();
      setPeers(result.peers);
    } catch (e) {
      console.error("Failed to get peers:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (scanning) {
      interval = setInterval(refreshPeers, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanning, refreshPeers]);

  const startScanning = async () => {
    try {
      await p2p.startDiscovery();
      setScanning(true);
      await refreshPeers();
    } catch (e) {
      console.error("Failed to start discovery:", e);
    }
  };

  const stopScanning = async () => {
    setScanning(false);
    try {
      await p2p.stopDiscovery();
    } catch (e) {
      console.error("Failed to stop discovery:", e);
    }
  };

  const getPeerIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("iphone") || lower.includes("android") || lower.includes("phone")) {
      return Smartphone;
    }
    if (lower.includes("mac") || lower.includes("laptop") || lower.includes("surface")) {
      return Laptop;
    }
    return Monitor;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Nearby Devices</span>
        <div className="flex gap-1.5">
          {!scanning ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startScanning}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] hover:bg-blue-500/30 transition-colors"
            >
              <Radio className="w-3 h-3" />
              Scan
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stopScanning}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] hover:bg-red-500/30 transition-colors"
            >
              Stop
            </motion.button>
          )}
          {scanning && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={refreshPeers}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 text-white/50 border border-transparent hover:bg-white/10 text-[11px] transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </motion.button>
          )}
        </div>
      </div>

      {scanning && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[11px] text-blue-400">Scanning for nearby devices...</span>
        </div>
      )}

      {peers.length === 0 ? (
        <div className="py-8 text-center">
          <Radio className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <p className="text-xs text-white/30">
            {scanning ? "No devices found yet" : "Click Scan to discover nearby devices"}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {peers.map((peer) => {
            const Icon = getPeerIcon(peer.name);
            return (
              <motion.div
                key={peer.ip}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-border hover:border-border-hover transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-white/50" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/80">{peer.hostname}</p>
                    <p className="text-[10px] text-white/30">{peer.ip}</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSend(peer)}
                  disabled={disabled}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] hover:bg-blue-500/30 transition-colors disabled:opacity-40"
                >
                  Send
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
