import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Merge, Scissors, ArrowUpDown, RotateCw, Crop, Trash2,
  ImagePlus, Lock, Unlock, Minimize2, Stamp, Hash, Info, Upload,
  Play, X, ChevronLeft, CheckCircle, AlertTriangle
} from "lucide-react";
import {
  getPdfInfo, mergePdfs, splitPdf, reorderPages, rotatePages,
  cropPages, deletePages, imagesToPdf, extractPdfText,
  encryptPdf, decryptPdf, unwrapPdf, compressPdf, flattenPdf,
  addPdfWatermark, addPageNumbers
} from "../lib/tauri";
import type { ToolResult } from "../lib/tauri";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

type PdfTool =
  | "select" | "info" | "merge" | "split" | "reorder" | "rotate"
  | "crop" | "delete" | "img2pdf" | "text" | "encrypt" | "decrypt" | "unwrap"
  | "compress" | "flatten" | "watermark" | "pagenum";

interface ToolCard {
  id: PdfTool;
  icon: typeof FileText;
  title: string;
  description: string;
  category: string;
}

const tools: ToolCard[] = [
  { id: "info", icon: Info, title: "PDF Info", description: "View page count, size, version", category: "Info" },
  { id: "merge", icon: Merge, title: "Merge PDFs", description: "Combine multiple PDFs", category: "Pages" },
  { id: "split", icon: Scissors, title: "Split & Extract", description: "Extract pages to separate files", category: "Pages" },
  { id: "reorder", icon: ArrowUpDown, title: "Reorder Pages", description: "Change page order", category: "Pages" },
  { id: "rotate", icon: RotateCw, title: "Rotate Pages", description: "Rotate 90/180/270 degrees", category: "Pages" },
  { id: "crop", icon: Crop, title: "Crop Pages", description: "Trim margins or regions", category: "Pages" },
  { id: "delete", icon: Trash2, title: "Delete Pages", description: "Remove specific pages", category: "Pages" },
  { id: "img2pdf", icon: ImagePlus, title: "Images to PDF", description: "Convert images to PDF", category: "Convert" },
  { id: "text", icon: FileText, title: "Extract Text", description: "Extract text content", category: "Convert" },
  { id: "encrypt", icon: Lock, title: "Encrypt PDF", description: "Password protect", category: "Security" },
  { id: "decrypt", icon: Unlock, title: "Decrypt PDF", description: "Remove password protection", category: "Security" },
  { id: "unwrap", icon: Unlock, title: "Unwrap PDF", description: "Decrypt TTENC1-wrapped PDF", category: "Security" },
  { id: "compress", icon: Minimize2, title: "Compress PDF", description: "Reduce file size", category: "Enhance" },
  { id: "flatten", icon: Minimize2, title: "Flatten PDF", description: "Remove form fields", category: "Enhance" },
  { id: "watermark", icon: Stamp, title: "Watermark", description: "Add text watermark overlay", category: "Enhance" },
  { id: "pagenum", icon: Hash, title: "Page Numbers", description: "Stamp page numbers", category: "Enhance" },
];

const categories = ["Info", "Pages", "Convert", "Security", "Enhance"];

export default function PdfToolsPage() {
  const [tool, setTool] = useState<PdfTool>("select");
  const [files, setFiles] = useState<{ name: string; path: string }[]>([]);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Options state
  const [pages, setPages] = useState("");
  const [angle, setAngle] = useState(90);
  const [cropTop, setCropTop] = useState(0);
  const [cropBottom, setCropBottom] = useState(0);
  const [cropLeft, setCropLeft] = useState(0);
  const [cropRight, setCropRight] = useState(0);
  const [orderStr, setOrderStr] = useState("");
  const [password, setPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [wmText, setWmText] = useState("CONFIDENTIAL");
  const [wmSize, setWmSize] = useState(48);
  const [wmOpacity, setWmOpacity] = useState(0.3);
  const [wmAngle, setWmAngle] = useState(-45);
  const [pnSize, setPnSize] = useState(12);
  const [pnPos, setPnPos] = useState("bottom-center");
  const [margin, setMargin] = useState(20);

  const acceptPdf = tool === "img2pdf" ? "image/*,.jpg,.jpeg,.png,.webp,.heic" : ".pdf,application/pdf";
  const multiFile = tool === "merge" || tool === "img2pdf";

  const reset = () => {
    setTool("select");
    setFiles([]);
    setResult(null);
    setError("");
    setPages("");
    setOrderStr("");
    setPassword("");
  };

  const handleFiles = useCallback((fileList: FileList) => {
    const arr = Array.from(fileList).map(f => ({
      name: f.name,
      path: (f as unknown as { path?: string }).path || "",
    }));
    setFiles(prev => multiFile ? [...prev, ...arr] : arr.slice(0, 1));
    setResult(null);
    setError("");
  }, [multiFile]);

  const run = async (action: () => Promise<ToolResult>) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await action();
      setResult(r);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const outPath = (name: string) => {
    const p = files[0]?.path || "";
    const dir = p.replace(/[\\/][^\\/]+$/, "");
    return `${dir}/${name}`;
  };

  const renderToolPanel = () => {
    switch (tool) {
      case "info":
        return (
          <>
            <p className="text-xs text-white/40">Select a PDF to view its info</p>
            {result && (
              <pre className="text-xs text-white/70 bg-white/5 p-3 rounded-lg whitespace-pre-wrap">{result.message}</pre>
            )}
          </>
        );
      case "merge":
        return <p className="text-xs text-white/40">Select 2+ PDF files to merge in order</p>;
      case "split":
        return (
          <label className="text-xs text-white/40">
            Pages to extract (e.g. 1-3,5,8 or leave empty for all)
            <input value={pages} onChange={e => setPages(e.target.value)} placeholder="1-3,5,8"
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
        );
      case "reorder":
        return (
          <label className="text-xs text-white/40">
            New order (comma-separated, e.g. 3,1,2)
            <input value={orderStr} onChange={e => setOrderStr(e.target.value)} placeholder="3,1,2"
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
        );
      case "rotate":
        return (
          <>
            <label className="text-xs text-white/40">
              Pages (empty = all)
              <input value={pages} onChange={e => setPages(e.target.value)} placeholder="1-5"
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <label className="text-xs text-white/40">
              Angle
              <select value={angle} onChange={e => setAngle(Number(e.target.value))}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80">
                <option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option>
              </select>
            </label>
          </>
        );
      case "crop":
        return (
          <>
            <label className="text-xs text-white/40">Pages (empty = all)
              <input value={pages} onChange={e => setPages(e.target.value)} placeholder="1-5"
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([["Top", cropTop, setCropTop], ["Bottom", cropBottom, setCropBottom], ["Left", cropLeft, setCropLeft], ["Right", cropRight, setCropRight]] as const).map(([l, v, s]) => (
                <label key={l} className="text-xs text-white/40">{l} (pt)
                  <input type="number" value={v} onChange={e => s(Number(e.target.value))} min={0}
                    className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
                </label>
              ))}
            </div>
          </>
        );
      case "delete":
        return (
          <label className="text-xs text-white/40">
            Pages to delete (e.g. 1,3,5-7)
            <input value={pages} onChange={e => setPages(e.target.value)} placeholder="1,3,5-7"
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
        );
      case "img2pdf":
        return (
          <>
            <label className="text-xs text-white/40">Margin (pt)
              <input type="number" value={margin} onChange={e => setMargin(Number(e.target.value))} min={0}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <p className="text-xs text-white/30">Select JPG, PNG, or WebP images</p>
          </>
        );
      case "encrypt":
        return (
          <>
            <label className="text-xs text-white/40">User Password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <label className="text-xs text-white/40">Owner Password
              <input type="password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
          </>
        );
      case "decrypt":
      case "unwrap":
        return (
          <>
            <label className="text-xs text-white/40">Password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <p className="text-xs text-white/30">{tool === "unwrap" ? "Decrypt a TinyTools TTENC1-wrapped PDF" : "Decrypt a TinyTools-encrypted PDF"}</p>
          </>
        );
      case "watermark":
        return (
          <>
            <label className="text-xs text-white/40">Text
              <input value={wmText} onChange={e => setWmText(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <label className="text-xs text-white/40">Font Size
              <input type="number" value={wmSize} onChange={e => setWmSize(Number(e.target.value))} min={8} max={200}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <label className="text-xs text-white/40">Opacity (0-1)
              <input type="number" value={wmOpacity} onChange={e => setWmOpacity(Number(e.target.value))} min={0.05} max={1} step={0.05}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <label className="text-xs text-white/40">Angle (degrees)
              <input type="number" value={wmAngle} onChange={e => setWmAngle(Number(e.target.value))} min={-180} max={180}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
          </>
        );
      case "pagenum":
        return (
          <>
            <label className="text-xs text-white/40">Font Size
              <input type="number" value={pnSize} onChange={e => setPnSize(Number(e.target.value))} min={6} max={48}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <label className="text-xs text-white/40">Position
              <select value={pnPos} onChange={e => setPnPos(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80">
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="top-center">Top Center</option>
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
              </select>
            </label>
          </>
        );
      default:
        return null;
    }
  };

  const process = () => {
    if (files.length === 0) return;
    const paths = files.map(f => f.path);

    switch (tool) {
      case "info":
        return run(() => getPdfInfo(paths[0]));
      case "merge":
        return run(() => mergePdfs(paths, outPath("merged.pdf")));
      case "split":
        return run(() => splitPdf(paths[0], files[0].path.replace(/[\\/][^\\/]+$/, ""), pages || undefined));
      case "reorder": {
        const order = orderStr.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        return run(() => reorderPages(paths[0], outPath("reordered.pdf"), order));
      }
      case "rotate":
        return run(() => rotatePages(paths[0], outPath("rotated.pdf"), pages || undefined, angle));
      case "crop":
        return run(() => cropPages(paths[0], outPath("cropped.pdf"), pages || undefined, cropTop, cropBottom, cropLeft, cropRight));
      case "delete": {
        const del = pages.split(",").flatMap(s => {
          if (s.includes("-")) {
            const [a, b] = s.split("-").map(Number);
            return Array.from({ length: b - a + 1 }, (_, i) => a + i);
          }
          return [parseInt(s)];
        }).filter(n => !isNaN(n));
        return run(() => deletePages(paths[0], outPath("deleted.pdf"), del));
      }
      case "img2pdf":
        return run(() => imagesToPdf(paths, outPath("images.pdf"), margin));
      case "text":
        return run(() => extractPdfText(paths[0]));
      case "encrypt":
        return run(() => encryptPdf(paths[0], outPath("encrypted.pdf"), password, ownerPassword || password));
      case "decrypt":
        return run(() => decryptPdf(paths[0], outPath("decrypted.pdf"), password));
      case "unwrap":
        return run(() => unwrapPdf(paths[0], outPath("unwrapped.pdf"), password));
      case "compress":
        return run(() => compressPdf(paths[0], outPath("compressed.pdf")));
      case "flatten":
        return run(() => flattenPdf(paths[0], outPath("flattened.pdf")));
      case "watermark":
        return run(() => addPdfWatermark(paths[0], outPath("watermarked.pdf"), wmText, wmSize, wmOpacity, wmAngle));
      case "pagenum":
        return run(() => addPageNumbers(paths[0], outPath("numbered.pdf"), pnSize, pnPos));
    }
  };

  if (tool === "select") {
    return (
      <div className="flex flex-col h-full">
        <h2 className="text-xl font-semibold mb-1">PDF Tools</h2>
        <p className="text-sm text-white/40 mb-6">Full-featured PDF processor — 100% offline</p>
        {categories.map(cat => (
          <div key={cat} className="mb-4">
            <h3 className="text-[10px] uppercase tracking-widest text-white/20 mb-2">{cat}</h3>
            <div className="grid grid-cols-5 gap-2">
              {tools.filter(t => t.category === cat).map(t => {
                const Icon = t.icon;
                return (
                  <motion.button key={t.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    transition={spring}
                    onClick={() => { setTool(t.id); setFiles([]); setResult(null); setError(""); }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-surface/50 hover:border-border-hover hover:bg-surface-hover transition-colors cursor-pointer">
                    <Icon className="w-5 h-5 text-white/60" />
                    <span className="text-[10px] font-medium text-center">{t.title}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const toolCard = tools.find(t => t.id === tool)!;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <button onClick={reset} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <ChevronLeft className="w-4 h-4 text-white/50" />
        </button>
        <div>
          <h2 className="text-lg font-semibold">{toolCard.title}</h2>
          <p className="text-xs text-white/40">{toolCard.description}</p>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Options */}
        <div className="w-[300px] flex flex-col gap-3 overflow-y-auto pr-1">
          {renderToolPanel()}
        </div>

        {/* Right: File + Results */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Drop zone */}
          <motion.div
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            animate={{ borderColor: files.length ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)" }}
            className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-white/20 transition-colors min-h-[120px]"
            onClick={() => inputRef.current?.click()}
          >
            {files.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {files.map((f, i) => (
                  <div key={i} className="relative group flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                    <FileText className="w-4 h-4 text-white/50" />
                    <span className="text-xs text-white/70 max-w-[150px] truncate">{f.name}</span>
                    <button onClick={e => { e.stopPropagation(); setFiles(p => p.filter((_, j) => j !== i)); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3 text-white/40" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-white/30" />
                <p className="text-xs text-white/50">Drop {multiFile ? "files" : "a PDF"} here or click to browse</p>
              </>
            )}
            <input ref={inputRef} type="file" accept={acceptPdf} multiple={multiFile} className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)} />
          </motion.div>

          {/* Process button */}
          {files.length > 0 && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring}
              disabled={loading}
              onClick={process}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50">
              {loading ? <span className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" /> : <Play className="w-4 h-4" />}
              {loading ? "Processing..." : toolCard.title}
            </motion.button>
          )}

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs text-emerald-300/80 whitespace-pre-wrap break-all">{result.message}</div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="text-xs text-red-300/80 whitespace-pre-wrap break-all">{error}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
