import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Wand2, X } from "lucide-react";
import { processImage, pickFile } from "../lib/tauri";

const springTransition = { type: "spring", stiffness: 300, damping: 30 };

const operations = [
  { id: "resize", label: "Resize", description: "Scale to fit within bounds" },
  { id: "grayscale", label: "Grayscale", description: "Convert to grayscale" },
  { id: "rotate", label: "Rotate 90°", description: "Rotate clockwise" },
  { id: "flip", label: "Flip Horizontal", description: "Mirror horizontally" },
  { id: "blur", label: "Blur", description: "Apply gaussian blur" },
  { id: "sharpen", label: "Sharpen", description: "Enhance sharpness" },
];

interface SelectedFile {
  name: string;
  path: string;
  size: number;
}

export default function ImageProcess({ defaultSub }: { defaultSub?: string } = {}) {
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [selectedOp, setSelectedOp] = useState(defaultSub || "resize");
  const [status, setStatus] = useState("");
  const [resizeW, setResizeW] = useState(800);
  const [resizeH, setResizeH] = useState(800);
  const [blurSigma, setBlurSigma] = useState(3.0);
  const [sharpenAmount, setSharpenAmount] = useState(1.0);

  const openPicker = useCallback(async () => {
    const picked = await pickFile([{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp"] }]);
    if (!picked) return;
    setFile({ name: picked.name, path: picked.path, size: picked.size });
  }, []);

  const handleApply = async () => {
    if (!file) return;
    setStatus("Processing...");
    try {
      const outPath = file.path.replace(/\.[^.]+$/, `_${selectedOp}.png`);
      let params: Record<string, unknown> = {};
      switch (selectedOp) {
        case "resize": params = { width: resizeW, height: resizeH }; break;
        case "blur": params = { sigma: blurSigma }; break;
        case "sharpen": params = { amount: sharpenAmount, radius: 1 }; break;
        case "rotate": params = { degrees: 90 }; break;
        case "flip": params = { direction: "horizontal" }; break;
      }
      const result = await processImage(file.path, outPath, selectedOp, params);
      setStatus(result.message);
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div>
        <h2 className="text-xl font-semibold">Image Process</h2>
        <p className="text-sm text-white/40 mt-1">
          Apply transformations to your images
        </p>
      </div>

      <div className="flex gap-6 flex-1">
        <div className="flex-1 flex flex-col gap-4">
          <motion.div
            animate={{
              backgroundColor: "rgba(255,255,255,0.02)",
            }}
            transition={springTransition}
            className="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-white/20 transition-colors"
            onClick={openPicker}
          >
            {file ? (
              <div className="max-h-40 rounded-xl bg-white/5 border border-border px-4 py-3 text-center">
                <p className="text-sm truncate">{file.name}</p>
                <p className="text-xs text-white/40 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-white/30" />
                <p className="text-sm text-white/60">
                  Click to browse an image
                </p>
              </>
            )}
          </motion.div>

          {file && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-border"
            >
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-border flex items-center justify-center">
                <p className="text-xs text-white/60 truncate px-1">{file.name.split(".").pop()}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{file.name}</p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </div>

        <div className="w-56 flex flex-col gap-3">
          <p className="text-xs text-white/40 uppercase tracking-wider">
            Operation
          </p>
          {operations.map((op) => (
            <motion.button
              key={op.id}
              onClick={() => setSelectedOp(op.id)}
              className={`text-left p-3 rounded-xl border transition-colors ${
                selectedOp === op.id
                  ? "bg-white/10 border-white/20"
                  : "bg-white/5 border-border hover:border-border-hover"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
            >
              <p className="text-sm font-medium">{op.label}</p>
              <p className="text-xs text-white/40">{op.description}</p>
            </motion.button>
          ))}

          {selectedOp === "resize" && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-border">
              <label className="text-xs text-white/40">Max Width
                <input type="number" value={resizeW} onChange={e => setResizeW(Number(e.target.value))} min={1}
                  className="mt-1 w-full bg-white/5 border border-border rounded-lg px-2 py-1 text-xs text-white/80 outline-none" />
              </label>
              <label className="text-xs text-white/40">Max Height
                <input type="number" value={resizeH} onChange={e => setResizeH(Number(e.target.value))} min={1}
                  className="mt-1 w-full bg-white/5 border border-border rounded-lg px-2 py-1 text-xs text-white/80 outline-none" />
              </label>
            </div>
          )}

          {selectedOp === "blur" && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-border">
              <label className="text-xs text-white/40">Sigma
                <input type="number" value={blurSigma} onChange={e => setBlurSigma(Number(e.target.value))} min={0.1} max={20} step={0.5}
                  className="mt-1 w-full bg-white/5 border border-border rounded-lg px-2 py-1 text-xs text-white/80 outline-none" />
              </label>
            </div>
          )}

          {selectedOp === "sharpen" && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-border">
              <label className="text-xs text-white/40">Amount
                <input type="number" value={sharpenAmount} onChange={e => setSharpenAmount(Number(e.target.value))} min={0.1} max={5} step={0.1}
                  className="mt-1 w-full bg-white/5 border border-border rounded-lg px-2 py-1 text-xs text-white/80 outline-none" />
              </label>
            </div>
          )}

          {status && (
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">{status}</div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={springTransition}
            disabled={!file}
            className="mt-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            onClick={handleApply}
          >
            <Wand2 className="w-4 h-4" />
            Apply
          </motion.button>
        </div>
      </div>
    </div>
  );
}
