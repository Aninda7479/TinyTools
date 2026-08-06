import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Merge, Scissors, ArrowUpDown, RotateCw, Crop, Trash2,
  ImagePlus, Lock, Unlock, Minimize2, Stamp, Hash, Info, Upload,
  Play, X, ChevronLeft, CheckCircle, AlertTriangle, FolderOpen
} from "lucide-react";
import {
  mergePdfs, splitPdf, reorderPages, rotatePages,
  cropPages, deletePages, imagesToPdf, extractPdfText,
  encryptPdf, decryptPdf, unwrapPdf, compressPdf, flattenPdf,
  addPdfWatermark, addPageNumbers, pickFiles, saveFile, getPdfInfo,
  pickDirectory
} from "../lib/tauri";
import type { ToolResult } from "../lib/tauri";
import { revealInFolder } from "../lib/p2p-api";
import PdfInfoPage from "./PdfInfoPage";
import { readFile } from "@tauri-apps/plugin-fs";
import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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
  { id: "pagenum", icon: Hash, title: "Add Page no.", description: "Stamp page numbers", category: "Enhance" },
];

const categories = ["Info", "Pages", "Convert", "Security", "Enhance"];

interface PdfPageThumbnailProps {
  pdfDoc: any;
  pageNum: number;
}

function PdfPageThumbnail({ pdfDoc, pageNum }: PdfPageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pdfDoc) return;
    let active = true;

    pdfDoc.getPage(pageNum)
      .then((page: any) => {
        if (!active) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const viewport = page.getViewport({ scale: 0.15 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        return page.render(renderContext).promise;
      })
      .then(() => {
        if (active) setLoading(false);
      })
      .catch((err: any) => {
        console.error(`Error rendering page ${pageNum}:`, err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pdfDoc, pageNum]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black/10">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
          <span className="animate-spin w-4 h-4 border border-white/20 border-t-white/60 rounded-full" />
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
    </div>
  );
}

export default function PdfToolsPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [tool, setTool] = useState<PdfTool>((defaultSub as PdfTool) || "select");
  const [files, setFiles] = useState<{ name: string; path: string }[]>([]);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  // Interactive page selection & rotation state
  const [pageCount, setPageCount] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [individualRotations, setIndividualRotations] = useState<Record<number, number>>({});
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [splitMode, setSplitMode] = useState<"multiple" | "single">("multiple");

  const multiFile = tool === "merge" || tool === "img2pdf";

  const reset = () => {
    setTool("select");
    setFiles([]);
    setResult(null);
    setError("");
    setPages("");
    setOrderStr("");
    setPassword("");
    setOwnerPassword("");
    setAngle(90);
    setCropTop(0); setCropBottom(0); setCropLeft(0); setCropRight(0);
    setWmText("CONFIDENTIAL"); setWmSize(48); setWmOpacity(0.3); setWmAngle(-45);
    setPnSize(12); setPnPos("bottom-center");
    setMargin(20);
    setPageCount(0);
    setSelectedPages([]);
    setIndividualRotations({});
    setPdfDoc(null);
    setSplitMode("multiple");
  };

  const openPicker = useCallback(async () => {
    const filters = tool === "img2pdf"
      ? [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "heic"] }]
      : [{ name: "PDFs", extensions: ["pdf"] }];
    const picked = await pickFiles(filters);
    if (picked.length === 0) return;
    const arr = picked.map(f => ({ name: f.name, path: f.path }));
    setFiles(prev => multiFile ? [...prev, ...arr] : arr.slice(0, 1));
    setResult(null);
    setError("");
  }, [multiFile, tool]);

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

  const getSavePath = async (defaultName: string): Promise<string | null> => {
    const defaultSavePath = outPath(defaultName);
    let savePath = await saveFile(defaultSavePath, [{ name: "PDF Documents", extensions: ["pdf"] }]);
    if (!savePath) return null;
    if (!savePath.toLowerCase().endsWith(".pdf")) {
      savePath += ".pdf";
    }
    return savePath;
  };

  // Parse page range string (e.g., "1-3,5") to array of page numbers
  const parsePageRange = (rangeStr: string, maxPages: number): number[] => {
    const selected: number[] = [];
    const parts = rangeStr.split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes("-")) {
        const [startStr, endStr] = trimmed.split("-");
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        if (!isNaN(start) && !isNaN(end)) {
          const s = Math.min(start, end);
          const e = Math.max(start, end);
          for (let i = s; i <= e; i++) {
            if (i >= 1 && i <= maxPages) selected.push(i);
          }
        }
      } else {
        const page = parseInt(trimmed);
        if (!isNaN(page) && page >= 1 && page <= maxPages) {
          selected.push(page);
        }
      }
    }
    return Array.from(new Set(selected)).sort((a, b) => a - b);
  };

  // Convert array of page numbers to a range string (e.g., [1,2,3,5] -> "1-3,5")
  const formatPageRange = (pagesArr: number[]): string => {
    if (pagesArr.length === 0) return "";
    const sorted = [...pagesArr].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        if (start === end) {
          ranges.push(`${start}`);
        } else {
          ranges.push(`${start}-${end}`);
        }
        start = sorted[i];
        end = sorted[i];
      }
    }
    if (start === end) {
      ranges.push(`${start}`);
    } else {
      ranges.push(`${start}-${end}`);
    }
    return ranges.join(",");
  };

  useEffect(() => {
    if (files.length === 0) {
      setPageCount(0);
      setSelectedPages([]);
      setIndividualRotations({});
      setPdfDoc(null);
      return;
    }
    if (tool === "rotate" || tool === "split") {
      setLoading(true);
      setError("");

      readFile(files[0].path)
        .then(bytes => {
          const loadingTask = pdfjs.getDocument({ data: bytes });
          return loadingTask.promise;
        })
        .then(pdf => {
          setPdfDoc(pdf);
          const count = pdf.numPages || 0;
          setPageCount(count);
          // Initialize rotations to 0
          const initial: Record<number, number> = {};
          for (let i = 1; i <= count; i++) {
            initial[i] = 0;
          }
          setIndividualRotations(initial);
          setSelectedPages([]);
          setPages("");
        })
        .catch(err => {
          console.error("PDF.js load error:", err);
          // Fall back to Rust info fetching if file reading/parsing fails
          getPdfInfo(files[0].path)
            .then(r => {
              if (r.success) {
                const info = JSON.parse(r.message);
                const count = info.page_count || 0;
                setPageCount(count);
                const initial: Record<number, number> = {};
                for (let i = 1; i <= count; i++) {
                  initial[i] = 0;
                }
                setIndividualRotations(initial);
                setSelectedPages([]);
                setPages("");
              } else {
                setError(r.message);
              }
            })
            .catch(e => {
              setError(`Failed to read PDF pages: ${String(e)}`);
            });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [files, tool]);

  const handlePageCardClick = (pageNum: number) => {
    let newSelected: number[];
    if (selectedPages.includes(pageNum)) {
      newSelected = selectedPages.filter(p => p !== pageNum);
    } else {
      newSelected = [...selectedPages, pageNum];
    }
    setSelectedPages(newSelected);
    setPages(formatPageRange(newSelected));
  };

  const handlePageCardRotate = (pageNum: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid toggling selection when clicking rotate button
    setIndividualRotations(prev => {
      const current = prev[pageNum] || 0;
      const next = (current + 90) % 360;
      return { ...prev, [pageNum]: next };
    });
  };

  const handleBatchRotate = (rotAngle: number) => {
    setIndividualRotations(prev => {
      const updated = { ...prev };
      // If no page is selected, rotate all of them
      const targetPages = selectedPages.length > 0
        ? selectedPages
        : Array.from({ length: pageCount }, (_, i) => i + 1);

      for (const p of targetPages) {
        updated[p] = ((prev[p] || 0) + rotAngle) % 360;
      }
      return updated;
    });
  };

  const renderToolPanel = () => {
    switch (tool) {
      case "merge":
        return <p className="text-xs text-white/40">Select 2+ PDF files to merge in order</p>;
      case "split":
        return (
          <>
            <label className="text-xs text-white/40">
              Extraction Mode
              <select value={splitMode} onChange={e => setSplitMode(e.target.value as "multiple" | "single")}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80">
                <option value="multiple">Multiple Files (One file per page)</option>
                <option value="single">Single File (Combine to one PDF)</option>
              </select>
            </label>
            <label className="text-xs text-white/40 mt-3 block">
              Pages to extract (e.g. 1-3,5,8 or leave empty for all)
              <input value={pages} onChange={e => {
                const val = e.target.value;
                setPages(val);
                if (pageCount > 0) {
                  const parsed = parsePageRange(val, pageCount);
                  setSelectedPages(parsed);
                }
              }} placeholder="1-3,5,8 or leave empty for all"
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
          </>
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
              Pages to rotate (e.g. 1-3,5)
              <input value={pages} onChange={e => {
                const val = e.target.value;
                setPages(val);
                if (pageCount > 0) {
                  const parsed = parsePageRange(val, pageCount);
                  setSelectedPages(parsed);
                }
              }} placeholder="1-5 or leave empty for all"
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <label className="text-xs text-white/40">
              Angle (for batch rotation)
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
            <label className="text-xs text-white/40">Document Open Password (User)
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
            <label className="text-xs text-white/40 mt-3 block">Permissions Password (Owner - Optional)
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

  const process = async () => {
    if (files.length === 0) return;
    const paths = files.map(f => f.path);

    switch (tool) {
      case "merge": {
        const savePath = await getSavePath("merged.pdf");
        if (!savePath) return;
        return run(() => mergePdfs(paths, savePath));
      }
      case "split": {
        if (splitMode === "multiple") {
          const outDir = await pickDirectory();
          if (!outDir) return;
          return run(() => splitPdf(paths[0], outDir, pages || undefined));
        } else {
          const savePath = await getSavePath("extracted.pdf");
          if (!savePath) return;
          const pagesToKeep = pages
            ? parsePageRange(pages, pageCount)
            : Array.from({ length: pageCount }, (_, i) => i + 1);

          if (pagesToKeep.length === 0) {
            setError("Please select at least one page to extract.");
            return;
          }
          return run(() => reorderPages(paths[0], savePath, pagesToKeep));
        }
      }
      case "reorder": {
        const savePath = await getSavePath("reordered.pdf");
        if (!savePath) return;
        const order = orderStr.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        return run(() => reorderPages(paths[0], savePath, order));
      }
      case "rotate": {
        const savePath = await getSavePath("rotated.pdf");
        if (!savePath) return;

        // Group page indices by rotation angle
        const rotations: Record<number, number[]> = { 90: [], 180: [], 270: [] };
        for (const [pageStr, val] of Object.entries(individualRotations)) {
          const pageNum = Number(pageStr);
          const normalizedAngle = ((val % 360) + 360) % 360;
          if (normalizedAngle !== 0) {
            rotations[normalizedAngle as 90 | 180 | 270]?.push(pageNum);
          }
        }

        const activeRotations = Object.entries(rotations)
          .filter(([_, pList]) => pList.length > 0)
          .map(([ang, pList]) => ({ angle: Number(ang), pages: pList.sort((a, b) => a - b) }));

        if (activeRotations.length === 0) {
          // Fallback if no individual rotation is set: use selected pages and global angle
          return run(() => rotatePages(paths[0], savePath, pages || undefined, angle));
        }

        // Run sequential rotations
        return run(async () => {
          let currentInput = paths[0];
          let lastResult: ToolResult = { success: false, message: "", output_path: null };
          
          for (let i = 0; i < activeRotations.length; i++) {
            const { angle: rotAngle, pages: rotPages } = activeRotations[i];
            const pagesStr = rotPages.join(",");
            const isLast = i === activeRotations.length - 1;
            const tempOutput = isLast ? savePath : outPath(`rotated_temp_${i}.pdf`);
            
            lastResult = await rotatePages(currentInput, tempOutput, pagesStr, rotAngle);
            if (!lastResult.success) {
              throw new Error(lastResult.message || `Failed to rotate pages for angle ${rotAngle}`);
            }
            
            currentInput = tempOutput;
          }
          
          return lastResult;
        });
      }
      case "crop": {
        const savePath = await getSavePath("cropped.pdf");
        if (!savePath) return;
        return run(() => cropPages(paths[0], savePath, pages || undefined, cropTop, cropBottom, cropLeft, cropRight));
      }
      case "delete": {
        const savePath = await getSavePath("deleted.pdf");
        if (!savePath) return;
        const del = pages.split(",").flatMap(s => {
          if (s.includes("-")) {
            const [a, b] = s.split("-").map(Number);
            return Array.from({ length: b - a + 1 }, (_, i) => a + i);
          }
          return [parseInt(s)];
        }).filter(n => !isNaN(n));
        return run(() => deletePages(paths[0], savePath, del));
      }
      case "img2pdf": {
        const savePath = await getSavePath("images.pdf");
        if (!savePath) return;
        return run(() => imagesToPdf(paths, savePath, margin));
      }
      case "text":
        return run(() => extractPdfText(paths[0]));
      case "encrypt": {
        const savePath = await getSavePath("encrypted.pdf");
        if (!savePath) return;
        return run(() => encryptPdf(paths[0], savePath, password, ownerPassword || password));
      }
      case "decrypt": {
        const savePath = await getSavePath("decrypted.pdf");
        if (!savePath) return;
        return run(() => decryptPdf(paths[0], savePath, password));
      }
      case "unwrap": {
        const savePath = await getSavePath("unwrapped.pdf");
        if (!savePath) return;
        return run(() => unwrapPdf(paths[0], savePath, password));
      }
      case "compress": {
        const savePath = await getSavePath("compressed.pdf");
        if (!savePath) return;
        return run(() => compressPdf(paths[0], savePath));
      }
      case "flatten": {
        const savePath = await getSavePath("flattened.pdf");
        if (!savePath) return;
        return run(() => flattenPdf(paths[0], savePath));
      }
      case "watermark": {
        const savePath = await getSavePath("watermarked.pdf");
        if (!savePath) return;
        return run(() => addPdfWatermark(paths[0], savePath, wmText, wmSize, wmOpacity, wmAngle));
      }
      case "pagenum": {
        const savePath = await getSavePath("numbered.pdf");
        if (!savePath) return;
        return run(() => addPageNumbers(paths[0], savePath, pnSize, pnPos));
      }
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

  if (tool === "info") {
    return <PdfInfoPage onBack={reset} />;
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
          {/* Interactive Page Selection/Rotation Grid */}
          {(tool === "rotate" || tool === "split") && files.length > 0 && pageCount > 0 ? (
            <div className="flex flex-col gap-3 flex-1 min-h-0 bg-white/[0.02] border border-white/5 rounded-2xl p-4 overflow-y-auto">
              {/* File Info & Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px] text-white/70 max-w-[200px] truncate">{files[0].name}</span>
                  <button onClick={reset} className="p-0.5 hover:bg-white/10 rounded">
                    <X className="w-3.5 h-3.5 text-white/40" />
                  </button>
                </div>

                {/* Selection Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const all = Array.from({ length: pageCount }, (_, i) => i + 1);
                      setSelectedPages(all);
                      setPages(formatPageRange(all));
                    }}
                    className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-white/20 text-[10px] text-white/70 transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPages([]);
                      setPages("");
                    }}
                    className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-white/20 text-[10px] text-white/70 transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>

                {/* Batch Rotate Action */}
                {tool === "rotate" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/40 mr-1">Rotate selected:</span>
                    {[90, 180, 270].map(deg => (
                      <button
                        key={deg}
                        onClick={() => handleBatchRotate(deg)}
                        className="flex items-center gap-0.5 px-2 py-1 rounded bg-blue-500/15 border border-blue-500/25 hover:bg-blue-500/25 text-[10px] text-blue-400 transition-colors cursor-pointer"
                      >
                        <RotateCw className="w-3 h-3" />
                        +{deg}°
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setIndividualRotations(prev => {
                          const updated = { ...prev };
                          const targetPages = selectedPages.length > 0 ? selectedPages : Array.from({ length: pageCount }, (_, i) => i + 1);
                          for (const p of targetPages) {
                            updated[p] = 0;
                          }
                          return updated;
                        });
                      }}
                      className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:border-white/20 text-[10px] text-white/60 transition-colors cursor-pointer"
                    >
                      Reset Selected
                    </button>
                  </div>
                )}
              </div>

              {/* Responsive Page Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pt-2">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(pageNum => {
                  const isSelected = selectedPages.includes(pageNum);
                  const rot = tool === "rotate" ? (individualRotations[pageNum] || 0) : 0;
                  return (
                    <div
                      key={pageNum}
                      onClick={() => handlePageCardClick(pageNum)}
                      className={`relative group flex flex-col items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none bg-surface/40 hover:bg-surface/60 ${
                        isSelected
                          ? "border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.1)]"
                          : "border-white/5 hover:border-white/15"
                      }`}
                    >
                      {/* Checkbox and Individual Rotate Button overlay */}
                      <div className="absolute top-2 left-2 right-2 flex justify-between items-center opacity-80 group-hover:opacity-100 transition-opacity z-10">
                        {/* Checkbox */}
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-blue-500 border-blue-600 text-white"
                              : "border-white/25 bg-black/20"
                          }`}
                        >
                          {isSelected && <span className="text-[9px] font-bold">✓</span>}
                        </div>

                        {/* Card rotate button (+90) */}
                        {tool === "rotate" && (
                          <button
                            onClick={e => handlePageCardRotate(pageNum, e)}
                            className="p-1 rounded bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/25 transition-all text-white/60 hover:text-white cursor-pointer"
                            title="Rotate 90° Clockwise"
                          >
                            <RotateCw className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Visual Page Thumbnail Container */}
                      <div className="w-20 h-28 my-4 flex items-center justify-center">
                        <motion.div
                          animate={{ rotate: rot }}
                          transition={{ type: "spring", stiffness: 200, damping: 20 }}
                          className={`w-16 h-22 rounded-md bg-gradient-to-br from-white/[0.04] to-white/[0.01] border flex flex-col items-center justify-center shadow-lg relative overflow-hidden ${
                            isSelected ? "border-blue-500/30" : "border-white/10"
                          }`}
                        >
                          {/* Inside Thumbnail design */}
                          {pdfDoc ? (
                            <PdfPageThumbnail pdfDoc={pdfDoc} pageNum={pageNum} />
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1.5 w-full h-full">
                              <FileText className={`w-6 h-6 ${isSelected ? "text-blue-400/50" : "text-white/20"}`} />
                              <span className="text-[9px] font-semibold text-white/40">{pageNum}</span>
                            </div>
                          )}
                          
                          {/* Corner folding effect */}
                          <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-black/30 border-b border-l border-white/10 rounded-bl-sm z-10" />
                        </motion.div>
                      </div>

                      {/* Card Footer labels */}
                      <div className="w-full flex items-center justify-between text-[10px] text-white/35 mt-1 border-t border-white/[0.03] pt-1.5 font-sans">
                        <span>Page {pageNum}</span>
                        {rot > 0 && (
                          <span className="font-semibold text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded text-[8px]">
                            {rot}°
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Standard Drop Zone */
            <motion.div
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); openPicker(); }}
              animate={{ borderColor: files.length ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)" }}
              className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-white/20 transition-colors min-h-[120px]"
              onClick={openPicker}
            >
              {files.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {files.map((f) => (
                    <div key={f.path} className="relative group flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <FileText className="w-4 h-4 text-white/50" />
                      <span className="text-xs text-white/70 max-w-[150px] truncate">{f.name}</span>
                      <button onClick={e => { e.stopPropagation(); setFiles(p => p.filter(x => x.path !== f.path)); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
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
            </motion.div>
          )}

          {/* Process button */}
          {files.length > 0 && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring}
              disabled={loading}
              onClick={process}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50 cursor-pointer">
              {loading ? <span className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" /> : <Play className="w-4 h-4" />}
              {loading ? "Processing..." : toolCard.title}
            </motion.button>
          )}

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-emerald-300/80 whitespace-pre-wrap break-all">{result.message}</div>
                </div>
                {result.output_path && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-emerald-500/10 mt-1">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400/40">Output File</span>
                    <span className="text-[10px] text-emerald-300/60 break-all font-mono">{result.output_path}</span>
                    <button
                      onClick={() => revealInFolder(result.output_path!)}
                      className="flex items-center gap-1.5 self-start px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors text-[10px] font-medium cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Open in Folder
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {error && (
              <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
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
