import { useState, useRef, useEffect } from "react";
import ToolPage, { OptionRow, OptionSlider, OptionSelect } from "./ToolPage";
import { stripMetadata, redactRegions, addWatermark, readMetadata, isTauri } from "../lib/tauri";

type PrivacyTool = "strip-metadata" | "redact" | "watermark";

export default function PrivacyPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [selectedTool, setSelectedTool] = useState<PrivacyTool>((defaultSub as PrivacyTool) || "strip-metadata");
  const [watermarkText, setWatermarkText] = useState("WATERMARK");
  const [watermarkOpacity, setWatermarkOpacity] = useState(80);
  const [watermarkPosition, setWatermarkPosition] = useState("bottom-right");
  const [redactMethod, setRedactMethod] = useState("blur");
  const [status, setStatus] = useState("");
  const [metadata, setMetadata] = useState<Record<string, string> | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{name: string, path: string}[]>([]);
  const [regions, setRegions] = useState<[number, number, number, number][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);
  const [currentBox, setCurrentBox] = useState<[number, number, number, number] | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (selectedFiles.length > 0 && selectedTool === "redact") {
      const src = selectedFiles[0].path;
      if (isTauri()) {
        import('@tauri-apps/api/core').then((tauri) => setPreviewUrl(tauri.convertFileSrc(src)));
      } else {
        setPreviewUrl(src);
      }
    }
  }, [selectedFiles, selectedTool]);

  const handleFilesChange = async (files: { name: string; path: string }[]) => {
    setSelectedFiles(files);
    setRegions([]);
    setMetadata(null);
    setStatus("");
    if (files.length > 0 && selectedTool === "strip-metadata") {
      try {
        const result = await readMetadata(files[0].path);
        if (result.success) {
          setMetadata(result.metadata);
        } else {
          setMetadata(null);
          setStatus("Failed to read metadata: " + result.message);
        }
      } catch (e) {
        setMetadata(null);
        setStatus("Error reading file");
      }
    }
  };

  const handleProcess = async (files: { name: string; path: string }[]) => {
    const f = files[0];
    if (!f?.path) { setStatus("Provide file path"); return; }
    const out = f.path.replace(/\.[^.]+$/, `_${selectedTool}.png`);
    setStatus("Processing...");
    try {
      let result;
      switch (selectedTool) {
        case "strip-metadata":
          result = await stripMetadata(f.path, out);
          setMetadata(null);
          break;
        case "redact":
          const finalRegions = regions.length > 0 ? regions : [[50, 50, 100, 100]] as [number, number, number, number][];
          result = await redactRegions(f.path, out, finalRegions, redactMethod);
          break;
        case "watermark":
          result = await addWatermark(f.path, out, watermarkText, watermarkOpacity, watermarkPosition);
          break;
      }
      setStatus(result?.message || "Done");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  const tools = [
    { id: "strip-metadata" as const, label: "EXIF Stripper", desc: "Remove GPS, camera info, timestamps" },
    { id: "redact" as const, label: "Sensitive Redactor", desc: "Blur/pixelate sensitive regions" },
    { id: "watermark" as const, label: "Text Watermark", desc: "Add visible text overlay" },
  ];

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setIsDrawing(true);
    setCurrentBox([x, y, 0, 0]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPos || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const bx = Math.min(x, startPos.x);
    const by = Math.min(y, startPos.y);
    const bw = Math.abs(x - startPos.x);
    const bh = Math.abs(y - startPos.y);
    setCurrentBox([bx, by, bw, bh]);
  };

  const handleMouseUp = () => {
    if (isDrawing && currentBox && imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      const scaleX = imgRef.current.naturalWidth / rect.width;
      const scaleY = imgRef.current.naturalHeight / rect.height;
      const mappedBox: [number, number, number, number] = [
        Math.round(currentBox[0] * scaleX),
        Math.round(currentBox[1] * scaleY),
        Math.round(currentBox[2] * scaleX),
        Math.round(currentBox[3] * scaleY),
      ];
      if (mappedBox[2] > 5 && mappedBox[3] > 5) {
        setRegions([...regions, mappedBox]);
      }
    }
    setIsDrawing(false);
    setStartPos(null);
    setCurrentBox(null);
  };

  const renderPreviewNode = () => {
    if (selectedTool !== "redact" || selectedFiles.length === 0 || !previewUrl) return undefined;
    return (
      <div 
        className="relative w-full h-full flex items-center justify-center bg-black/40 rounded-xl overflow-hidden cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
          ref={imgRef}
          src={previewUrl} 
          alt="Preview" 
          className="max-w-full max-h-[300px] object-contain pointer-events-none"
          draggable={false}
        />
        {/* Draw confirmed regions */}
        {imgRef.current && regions.map((r, i) => {
          const rect = imgRef.current!.getBoundingClientRect();
          const scaleX = rect.width / imgRef.current!.naturalWidth;
          const scaleY = rect.height / imgRef.current!.naturalHeight;
          return (
            <div key={i} className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none"
              style={{
                left: (rect.left - imgRef.current!.parentElement!.getBoundingClientRect().left) + r[0] * scaleX,
                top: (rect.top - imgRef.current!.parentElement!.getBoundingClientRect().top) + r[1] * scaleY,
                width: r[2] * scaleX,
                height: r[3] * scaleY,
              }}
            />
          );
        })}
        {/* Draw current box */}
        {imgRef.current && currentBox && (
          <div className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
            style={{
              left: (imgRef.current.getBoundingClientRect().left - imgRef.current.parentElement!.getBoundingClientRect().left) + currentBox[0],
              top: (imgRef.current.getBoundingClientRect().top - imgRef.current.parentElement!.getBoundingClientRect().top) + currentBox[1],
              width: currentBox[2],
              height: currentBox[3],
            }}
          />
        )}
      </div>
    );
  };

  return (
    <ToolPage key={selectedTool} title="Privacy & Metadata" description="Protect sensitive information in images" onProcess={handleProcess} onFilesChange={handleFilesChange} allowWeb={true} previewNode={renderPreviewNode()}>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-white/40 uppercase tracking-wider">Select Tool</p>
        {tools.map((t) => (
          <button key={t.id} onClick={() => setSelectedTool(t.id)}
            className={`text-left p-3 rounded-xl border transition-colors ${
              selectedTool === t.id ? "bg-white/10 border-white/20" : "bg-white/5 border-border hover:border-border-hover"
            }`}
          >
            <p className="text-sm font-medium">{t.label}</p>
            <p className="text-xs text-white/40">{t.desc}</p>
          </button>
        ))}
      </div>

      {selectedTool === "strip-metadata" && metadata && Object.keys(metadata).length > 0 && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2 max-h-64 overflow-y-auto">
          <p className="text-xs text-white/60 mb-1 flex justify-between">
            <span>EXIF Data Found:</span>
            <span className="text-red-400">{Object.keys(metadata).length} tags</span>
          </p>
          {Object.entries(metadata).map(([k, v]) => {
            const isSensitive = k.toLowerCase().includes("gps") || k.toLowerCase().includes("author") || k.toLowerCase().includes("location");
            return (
              <div key={k} className="flex justify-between items-center text-[10px] gap-2 border-b border-white/5 pb-1">
                <span className={`truncate flex-1 ${isSensitive ? "text-red-300" : "text-white/40"}`}>{k}</span>
                <span className="text-white/80 truncate flex-1 text-right">{v}</span>
              </div>
            );
          })}
        </div>
      )}

      {selectedTool === "strip-metadata" && metadata && Object.keys(metadata).length === 0 && (
        <div className="mt-2 p-3 rounded-xl border border-green-500/20 bg-green-500/10 flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-green-400"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <p className="text-sm font-medium text-green-400">Image is Clean!</p>
          <p className="text-xs text-green-400/60 mt-1 max-w-[200px]">
            No sensitive metadata found. This image is already safe to share.
          </p>
        </div>
      )}

      {selectedTool === "redact" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
          <OptionRow label="Method">
            <OptionSelect value={redactMethod} onChange={setRedactMethod}
              options={[{ value: "blur", label: "Blur" }, { value: "pixelate", label: "Pixelate" }]}
            />
          </OptionRow>
          {regions.length > 0 && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
              <span className="text-xs text-white/60">{regions.length} regions selected</span>
              <button onClick={() => setRegions([])} className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/30">Clear</button>
            </div>
          )}
        </div>
      )}

      {selectedTool === "watermark" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
          <OptionRow label="Text">
            <input type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)}
              className="w-32 px-2 py-1 rounded-lg bg-white/5 border border-border text-xs text-white/70 focus:outline-none"
            />
          </OptionRow>
          <OptionRow label="Opacity">
            <OptionSlider value={watermarkOpacity} min={10} max={255} step={5} onChange={setWatermarkOpacity} />
          </OptionRow>
          <OptionRow label="Position">
            <OptionSelect value={watermarkPosition} onChange={setWatermarkPosition}
              options={[
                { value: "bottom-right", label: "Bottom Right" },
                { value: "bottom-left", label: "Bottom Left" },
                { value: "top-right", label: "Top Right" },
                { value: "top-left", label: "Top Left" },
                { value: "center", label: "Center" },
              ]}
            />
          </OptionRow>
        </div>
      )}

      {status && (
        <div className="mt-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">{status}</div>
      )}
    </ToolPage>
  );
}
