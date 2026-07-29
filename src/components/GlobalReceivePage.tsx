import { useState } from "react";
import { Globe, ExternalLink, WifiOff } from "lucide-react";

export default function GlobalReceivePage() {
  const [receiveUrl, setReceiveUrl] = useState("");

  const handleOpenUrl = () => {
    if (!receiveUrl.trim()) return;
    const url = receiveUrl.trim().startsWith("http") ? receiveUrl.trim() : "https://" + receiveUrl.trim();
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Global Receive</h2>
        <p className="text-sm text-white/40 mt-1">
          Download files shared with you over the internet — no app needed
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[380px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              Enter a Global Share URL
            </span>
            <input
              type="text"
              value={receiveUrl}
              onChange={(e) => setReceiveUrl(e.target.value)}
              placeholder="https://<ip>:<port>"
              className="w-full rounded-xl bg-white/5 border border-border px-3 py-2.5 text-sm text-white/70 font-mono outline-none focus:border-border-hover transition-colors"
            />
            <button
              onClick={handleOpenUrl}
              disabled={!receiveUrl.trim()}
              className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 text-sm font-medium flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Browser
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">How it works</span>
            <div className="space-y-2">
              <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-border">
                <p className="text-xs text-white/70 font-medium mb-1">1. Get the URL</p>
                <p className="text-[10px] text-white/40">
                  The sender gives you a URL that looks like{" "}
                  <code className="text-white/60">https://203.0.113.1:34567</code>
                </p>
              </div>
              <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-border">
                <p className="text-xs text-white/70 font-medium mb-1">2. Open in browser</p>
                <p className="text-[10px] text-white/40">
                  Paste it above or open it in any browser. You&apos;ll see a download page.
                </p>
              </div>
              <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-border">
                <p className="text-xs text-white/70 font-medium mb-1">3. Download</p>
                <p className="text-[10px] text-white/40">
                  The file is served directly from the sender&apos;s device over an encrypted HTTPS
                  connection. No third party handles your data.
                </p>
              </div>
            </div>
          </div>

          <div className="px-3 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-[10px] text-yellow-400/80">
              The sender must have port forwarding configured on their router for external users to
              reach their device. On the same local network, the local URL works automatically.
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0">
          <Globe className="w-10 h-10 text-white/10" />
          <p className="text-sm text-white/50">Global Receive — download files from any Global Share</p>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-[10px] text-white/30">
            <WifiOff className="w-3 h-3" />
            No active connection — paste a URL above to start
          </div>
          <p className="text-[10px] text-white/20 text-center max-w-xs">
            The Global Share sender creates a secure HTTPS server on their device.
            You download the file directly from them through your browser.
            No sign-up, no accounts, no cloud.
          </p>
        </div>
      </div>
    </div>
  );
}
