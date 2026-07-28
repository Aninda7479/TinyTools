import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Play, Layers, CheckCircle2, XCircle } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { OptionRow, OptionSlider, OptionSelect } from "./ToolPage";
import { batchCompress, batchResize, batchConvert, batchWatermark, pickFiles } from "../lib/tauri";

type BatchOp = "compress" | "resize" | "convert" | "watermark";

interface Progress {
  current: number;
  total: number;
  file_name: string;
  operation: string;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

export default function BatchPage() {
  const [operation, setOperation] = useState<BatchOp>("compress");
  const [files, setFiles] = useState<{ name: string; path: string }[]>([]);

  const [quality, setQuality] = useState(80);
  const [resizeW, setResizeW] = useState(1920);
  const [resizeH, setResizeH] = useState(1080);
  const [convertFormat, setConvertFormat] = useState("webp");
  const [wmText, setWmText] = useState("WATERMARK");
  const [wmOpacity, setWmOpacity] = useState(80);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    const unlisten = listen<Progress>("batch-progress", (event) => {
      setProgress(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const openPicker = useCallback(async () => {
    const picked = await pickFiles([{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp"] }]);
    if (picked.length === 0) return;
    setFiles((prev) => [...prev, ...picked.map(f => ({ name: f.name, path: f.path }))]);
  }, []);

  const handleProcess = async () => {
    const paths = files.map((f) => f.path).filter((p) => p);
    if (paths.length === 0) { setStatus("Provide file paths"); return; }
    const dir = paths[0].substring(0, paths[0].lastIndexOf("\\") || paths[0].lastIndexOf("/"));
    const outDir = dir + "/batch_output";
    setStatus(`Processing ${paths.length} files...`);
    setResult("");
    setIsProcessing(true);
    setProgress(null);
    try {
      let res;
      switch (operation) {
        case "compress": res = await batchCompress(paths, outDir, quality); break;
        case "resize": res = await batchResize(paths, outDir, resizeW, resizeH); break;
        case "convert": res = await batchConvert(paths, outDir, convertFormat); break;
        case "watermark": res = await batchWatermark(paths, outDir, wmText, wmOpacity); break;
      }
      setStatus(res?.message || "Done");
      setResult(`Processed: ${res?.processed} | Failed: ${res?.failed}`);
    } catch (e) {
      setStatus(`Error: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Batch Engine</h2>
        <p className="text-sm text-white/40 mt-1">Process multiple files in parallel using Rust multi-threading</p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Options */}
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">Operation</p>
            {(["compress", "resize", "convert", "watermark"] as BatchOp[]).map((op) => (
              <button key={op} onClick={() => setOperation(op)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  operation === op ? "bg-white/10 border-white/20" : "bg-white/5 border-border hover:border-border-hover"
                }`}
              >
                <p className="text-sm font-medium capitalize">{op}</p>
              </button>
            ))}
          </div>

          {operation === "compress" && (
            <div className="p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
              <OptionRow label="Quality"><OptionSlider value={quality} min={10} max={100} step={1} onChange={setQuality} /></OptionRow>
            </div>
          )}

          {operation === "resize" && (
            <div className="p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
              <OptionRow label="Width"><OptionSlider value={resizeW} min={100} max={4000} step={10} onChange={setResizeW} /></OptionRow>
              <OptionRow label="Height"><OptionSlider value={resizeH} min={100} max={4000} step={10} onChange={setResizeH} /></OptionRow>
            </div>
          )}

          {operation === "convert" && (
            <div className="p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
              <OptionRow label="Format">
                <OptionSelect value={convertFormat} onChange={setConvertFormat}
                  options={["png", "jpg", "webp", "bmp", "tiff"].map((f) => ({ value: f, label: f.toUpperCase() }))}
                />
              </OptionRow>
            </div>
          )}

          {operation === "watermark" && (
            <div className="p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
              <OptionRow label="Text">
                <input type="text" value={wmText} onChange={(e) => setWmText(e.target.value)}
                  className="w-32 px-2 py-1 rounded-lg bg-white/5 border border-border text-xs text-white/70 focus:outline-none"
                />
              </OptionRow>
              <OptionRow label="Opacity"><OptionSlider value={wmOpacity} min={10} max={255} step={5} onChange={setWmOpacity} /></OptionRow>
            </div>
          )}

          {isProcessing && progress && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-300 capitalize">{progress.operation}</span>
                <span className="text-white/50">{progress.current}/{progress.total}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "tween", duration: 0.2 }}
                />
              </div>
              <p className="text-[10px] text-white/30 truncate">{progress.file_name}</p>
            </div>
          )}

          {!isProcessing && status && (
            <div className={`p-3 rounded-xl border text-xs ${
              result.includes("Failed: 0")
                ? "bg-green-500/10 border-green-500/20 text-green-300"
                : result.includes("Failed:") && !result.includes("Failed: 0")
                  ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-300"
                  : "bg-blue-500/10 border-blue-500/20 text-blue-300"
            }`}>
              <div className="flex items-center gap-1.5">
                {result.includes("Failed: 0") ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : result.includes("Failed:") ? (
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                ) : null}
                <span>{status}</span>
              </div>
              {result && <p className="mt-1 opacity-80">{result}</p>}
            </div>
          )}
        </div>

        {/* Right: Drop zone */}
        <div className="flex-1 flex flex-col gap-4">
          <motion.div
            animate={{
              borderColor: "rgba(255,255,255,0.1)",
              backgroundColor: "rgba(255,255,255,0.02)",
            }}
            transition={spring}
            className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-white/20 transition-colors min-h-[200px]"
            onClick={() => !isProcessing && openPicker()}
          >
            {files.length > 0 ? (
              <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
                {files.map((f, i) => (
                  <div key={i} className="relative group">
                    <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center text-[9px] text-white/40 text-center p-1 break-all">
                      {f.name}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setFiles((p) => p.filter((_, j) => j !== i)); }}
                      disabled={isProcessing}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                    ><X className="w-2.5 h-2.5" /></button>
                    <p className="text-[9px] text-white/30 mt-0.5 truncate w-16 text-center">{f.name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <Layers className="w-10 h-10 text-white/20" />
                <p className="text-sm text-white/50">Drop multiple images for batch processing</p>
                <p className="text-xs text-white/30">Supports 100+ files in parallel</p>
              </>
            )}
          </motion.div>

          {files.length > 0 && (
            <motion.button whileHover={{ scale: isProcessing ? 1 : 1.02 }} whileTap={{ scale: isProcessing ? 1 : 0.98 }} transition={spring}
              onClick={handleProcess}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {isProcessing ? `Processing ${progress ? `${progress.current}/${progress.total}` : "..."}` : `Batch ${operation} ${files.length} files`}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
