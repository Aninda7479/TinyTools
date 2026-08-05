import { useState, useEffect, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { writeFile } from "@tauri-apps/plugin-fs";
import ToolPage, { OptionRow, OptionSlider } from "./ToolPage";
import { inpaintImage, upscaleImage, sepiaFilter, smartSharpen, depthBlur } from "../lib/tauri";

type AiTool = "bg-remove" | "inpaint" | "upscale" | "sepia" | "smart-sharpen" | "depth-blur";

const tools: { id: AiTool; label: string; description: string }[] = [
  { id: "bg-remove", label: "Background Removal", description: "Remove backgrounds → transparent PNG" },
  { id: "inpaint", label: "Object Removal", description: "Erase unwanted objects or text" },
  { id: "upscale", label: "AI Upscale", description: "Increase resolution 2x or 4x" },
  { id: "sepia", label: "Sepia Filter", description: "Vintage sepia tone effect" },
  { id: "smart-sharpen", label: "Smart Sharpen", description: "Edge-aware detail enhancement" },
  { id: "depth-blur", label: "Depth Blur", description: "DSLR-style bokeh background blur" },
];

function BoundingBoxSelector({ src, onChange }: { src: string, onChange: (rect: [number, number, number, number]) => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [rect, setRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const r = imgRef.current.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const rawX = clientX - r.left;
    const rawY = clientY - r.top;

    // Scale to natural image size
    const scaleX = imgRef.current.naturalWidth / r.width;
    const scaleY = imgRef.current.naturalHeight / r.height;
    return { x: rawX * scaleX, y: rawY * scaleY };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const { x, y } = getCoordinates(e);
    setStartPos({ x, y });
    setRect({ x, y, w: 0, h: 0 });
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    setRect({
      x: Math.min(startPos.x, x),
      y: Math.min(startPos.y, y),
      w: Math.abs(x - startPos.x),
      h: Math.abs(y - startPos.y)
    });
  };

  const handlePointerUp = () => {
    if (isDrawing && rect) {
      setIsDrawing(false);
      onChange([Math.round(rect.x), Math.round(rect.y), Math.round(rect.w), Math.round(rect.h)]);
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs text-white/70 bg-white/10 px-3 py-1 rounded-full mb-4">Click and drag to select the object to remove</div>
      <div
        className="relative inline-block select-none cursor-crosshair"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <img ref={imgRef} src={src} draggable={false} className="max-w-full max-h-[300px] object-contain rounded-lg shadow-lg pointer-events-none" />
        {rect && imgRef.current && (
          <div
            className="absolute border border-blue-500 bg-blue-500/20"
            style={{
              left: (rect.x / imgRef.current.naturalWidth) * 100 + "%",
              top: (rect.y / imgRef.current.naturalHeight) * 100 + "%",
              width: (rect.w / imgRef.current.naturalWidth) * 100 + "%",
              height: (rect.h / imgRef.current.naturalHeight) * 100 + "%",
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function AiToolsPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [selectedTool, setSelectedTool] = useState<AiTool>((defaultSub as AiTool) || "bg-remove");
  const [scale, setScale] = useState(2);
  const [blurStrength, setBlurStrength] = useState(8.0);
  const [faceStrength, setFaceStrength] = useState(1.0);
  const [inpaintRegions, setInpaintRegions] = useState<[number, number, number, number][]>([]);
  const [bgModel, setBgModel] = useState("studioludens/birefnet-lite-512");
  const [status, setStatus] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL("../lib/ai-worker.ts", import.meta.url), { type: "module" });
    return () => workerRef.current?.terminate();
  }, []);

  const inpaintImageWeb = async (imageUrl: string, regions: [number, number, number, number][]) => {
    return new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Canvas not supported");
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const w = canvas.width;
        const h = canvas.height;

        for (const [rx, ry, rw, rh] of regions) {
          let sumR = 0, sumG = 0, sumB = 0, count = 0;
          const border = 8;
          const startY = Math.max(0, ry - border);
          const endY = Math.min(h, ry + rh + border);
          const startX = Math.max(0, rx - border);
          const endX = Math.min(w, rx + rw + border);

          for (let sy = startY; sy < endY; sy++) {
            for (let sx = startX; sx < endX; sx++) {
              if (sx >= rx && sx < rx + rw && sy >= ry && sy < ry + rh) continue;
              const idx = (sy * w + sx) * 4;
              sumR += data[idx];
              sumG += data[idx + 1];
              sumB += data[idx + 2];
              count++;
            }
          }

          if (count > 0) {
            const avgR = sumR / count;
            const avgG = sumG / count;
            const avgB = sumB / count;

            const boxEndY = Math.min(h, ry + rh);
            const boxEndX = Math.min(w, rx + rw);
            for (let y = Math.max(0, ry); y < boxEndY; y++) {
              for (let x = Math.max(0, rx); x < boxEndX; x++) {
                const dxEdge = Math.min(x - rx, rx + rw - x - 1);
                const dyEdge = Math.min(y - ry, ry + rh - y - 1);
                const edgeDist = Math.min(dxEdge, dyEdge, border);
                const blend = Math.min(edgeDist / border, 1.0);

                const idx = (y * w + x) * 4;
                data[idx] = data[idx] * (1 - blend) + avgR * blend;
                data[idx + 1] = data[idx + 1] * (1 - blend) + avgG * blend;
                data[idx + 2] = data[idx + 2] * (1 - blend) + avgB * blend;
                data[idx + 3] = 255;
              }
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject("Failed to create blob");
        }, "image/png");
      };
      img.onerror = () => reject("Failed to load image");
      img.src = imageUrl;
    });
  };

  const handleProcess = async (files: { name: string; path: string }[]) => {
    const f = files[0];
    if (!f?.path) { setStatus("Please provide file path (run from Tauri)"); return; }
    const out = f.path.replace(/\.[^.]+$/, `_${selectedTool}.png`);
    setStatus("Processing...");

    try {
      let result;
      if (selectedTool === "bg-remove") {
        setDownloadProgress(0);
        result = await new Promise<any>((resolve, reject) => {
          const worker = workerRef.current;
          if (!worker) return reject("Worker not initialized");

          const handleMessage = async (e: MessageEvent) => {
            const { type, id, blob, progressData, error } = e.data;
            if (id !== f.path) return;

            if (type === "progress") {
              if (progressData.status === "progress") {
                setDownloadProgress(progressData.progress || 0);
                setStatus(`Downloading AI Model (${Math.round(progressData.progress || 0)}%)...`);
              } else if (progressData.status === "ready" || progressData.status === "done") {
                setDownloadProgress(0);
                setStatus("AI Model Ready. Processing image...");
              } else if (progressData.status === "initiate") {
                setStatus(`Initiating download...`);
              }
            } else if (type === "processing") {
              setStatus("Processing image with WebGPU...");
            } else if (type === "result") {
              worker.removeEventListener("message", handleMessage);
              try {
                if ((window as any).__TAURI_INTERNALS__) {
                  const buffer = await blob.arrayBuffer();
                  await writeFile(out, new Uint8Array(buffer));
                } else {
                  // Fallback for Web Browser
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = out.split(/[/\\]/).pop() || "result.png";
                  a.click();
                  URL.revokeObjectURL(url);
                }
                resolve({ message: "Done" });
              } catch (writeErr) {
                reject(writeErr);
              }
            } else if (type === "error") {
              worker.removeEventListener("message", handleMessage);
              reject(error);
            }
          };

          worker.addEventListener("message", handleMessage);
          const imageUrl = f.path.startsWith("blob:") ? f.path : convertFileSrc(f.path);
          worker.postMessage({ action: "remove_background", id: f.path, imageUrl, model: bgModel });
        });
      } else {
        switch (selectedTool) {
          case "inpaint": {
            if (inpaintRegions.length === 0) {
              setStatus("Please select a region on the image first.");
              return;
            }
            if ((window as any).__TAURI_INTERNALS__) {
              result = await inpaintImage(f.path, out, inpaintRegions);
            } else {
              const blob = await inpaintImageWeb(f.path, inpaintRegions);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = out.split(/[/\\]/).pop() || "result.png";
              a.click();
              URL.revokeObjectURL(url);
              result = { message: "Done" };
            }
            break;
          }
          case "upscale": result = await upscaleImage(f.path, out, scale); break;
          case "sepia": result = await sepiaFilter(f.path, out); break;
          case "smart-sharpen": result = await smartSharpen(f.path, out, faceStrength); break;
          case "depth-blur": result = await depthBlur(f.path, out, blurStrength); break;
        }
      }
      setStatus(result?.message || "Done");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  return (
    <ToolPage
      title="AI & Smart Tools"
      description="Local AI-powered image processing"
      onProcess={handleProcess}
      processLabel="Run AI Tool"
      renderPreview={selectedTool === "inpaint" ? (f) => (
        <BoundingBoxSelector src={f.path} onChange={(r) => setInpaintRegions([r])} />
      ) : undefined}
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs text-white/40 uppercase tracking-wider">Select Tool</p>
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTool(t.id)}
            className={`text-left p-3 rounded-xl border transition-colors ${selectedTool === t.id ? "bg-white/10 border-white/20" : "bg-white/5 border-border hover:border-border-hover"
              }`}
          >
            <p className="text-sm font-medium">{t.label}</p>
            <p className="text-xs text-white/40">{t.description}</p>
          </button>
        ))}
      </div>

      {selectedTool === "bg-remove" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
          <OptionRow label="AI Model">
            <select
              value={bgModel}
              onChange={(e) => setBgModel(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white outline-none w-full ml-4"
            >
              <option value="Xenova/modnet">MODNet (Open-source, Best for Portraits)</option>
              <option value="studioludens/birefnet-lite-512">BiRefNet Lite (Open-source, General Objects)</option>
              <option value="kittypdf/RMBG-1.4-transformersjs">RMBG-1.4 (High Quality, Non-Commercial Only)</option>
            </select>
          </OptionRow>
          {bgModel === "kittypdf/RMBG-1.4-transformersjs" && (
            <p className="text-[10px] text-orange-300/80 mt-1 font-medium bg-orange-500/10 p-2 rounded border border-orange-500/20">
              Disclaimer: RMBG-1.4 is provided for Non-Commercial use only. By using this model, you agree to its{" "}
              <a href="https://bria.ai/bria-huggingface-model-license-agreement/" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-200">
                license terms
              </a>.
            </p>
          )}
        </div>
      )}

      {selectedTool === "inpaint" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border">
          <p className="text-xs text-white/70">
            First, upload an image and draw a box around the object you wish to remove.
          </p>
        </div>
      )}

      {selectedTool === "upscale" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border">
          <OptionRow label="Scale">
            <div className="flex gap-1">
              {[2, 4].map((s) => (
                <button key={s} onClick={() => setScale(s)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-colors ${scale === s ? "bg-white/10 border-white/20 text-white" : "border-border text-white/50"}`}
                >{s}x</button>
              ))}
            </div>
          </OptionRow>
        </div>
      )}

      {selectedTool === "depth-blur" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border">
          <OptionRow label="Blur Strength">
            <OptionSlider value={blurStrength} min={2} max={20} step={0.5} onChange={setBlurStrength} />
          </OptionRow>
        </div>
      )}

      {selectedTool === "smart-sharpen" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border">
          <OptionRow label="Strength">
            <OptionSlider value={faceStrength} min={0.5} max={3} step={0.1} onChange={setFaceStrength} />
          </OptionRow>
        </div>
      )}

      {status && (
        <div className="mt-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
          <div className="flex justify-between mb-1">
            <span>{status}</span>
            {downloadProgress > 0 && <span>{Math.round(downloadProgress)}%</span>}
          </div>
          {downloadProgress > 0 && (
            <div className="h-1.5 w-full bg-blue-500/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </ToolPage>
  );
}
