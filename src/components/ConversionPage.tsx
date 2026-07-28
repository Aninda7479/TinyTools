import { useState } from "react";
import ToolPage, { OptionRow, OptionSlider, OptionSelect } from "./ToolPage";
import { smartCompress, convertFormat, convertHeic, rasterToSvg } from "../lib/tauri";

type ConvertTool = "compress" | "convert" | "heic" | "vectorize";

export default function ConversionPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [selectedTool, setSelectedTool] = useState<ConvertTool>((defaultSub as ConvertTool) || "compress");
  const [quality, setQuality] = useState(80);
  const [useTarget, setUseTarget] = useState(false);
  const [targetSize, setTargetSize] = useState(500);
  const [targetFormat, setTargetFormat] = useState("webp");
  const [status, setStatus] = useState("");

  const tools = [
    { id: "compress" as const, label: "Smart Compress", desc: "Target file size or quality slider" },
    { id: "convert" as const, label: "Format Converter", desc: "PNG, JPG, WebP, BMP, TIFF, ICO" },
    { id: "heic" as const, label: "HEIC Converter", desc: "iPhone .heic to JPG/PNG locally" },
    { id: "vectorize" as const, label: "Raster to SVG", desc: "Convert bitmap logos to vector" },
  ];

  const formats = ["png", "jpg", "webp", "bmp", "tiff", "ico"];

  const handleProcess = async (files: { name: string; path: string }[]) => {
    const f = files[0];
    if (!f?.path) { setStatus("Provide file path"); return; }
    setStatus("Processing...");
    try {
      let result;
      switch (selectedTool) {
        case "compress":
          result = await smartCompress(f.path, f.path.replace(/\.[^.]+$/, "_compressed.jpg"), quality, useTarget ? targetSize : undefined);
          break;
        case "convert":
          result = await convertFormat(f.path, f.path.replace(/\.[^.]+$/, `.${targetFormat}`));
          break;
        case "heic":
          result = await convertHeic(f.path, f.path.replace(/\.[^.]+$/, ".jpg"));
          break;
        case "vectorize":
          result = await rasterToSvg(f.path, f.path.replace(/\.[^.]+$/, ".svg"));
          break;
      }
      setStatus(result?.message || "Done");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  return (
    <ToolPage title="Compression & Conversion" description="Optimize and convert image formats" onProcess={handleProcess}>
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

      {selectedTool === "compress" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
          <OptionRow label="Target Size">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={useTarget} onChange={(e) => setUseTarget(e.target.checked)}
                className="accent-blue-400"
              />
              {useTarget && (
                <div className="flex items-center gap-1">
                  <OptionSlider value={targetSize} min={50} max={5000} step={50} onChange={setTargetSize} />
                  <span className="text-[10px] text-white/30">KB</span>
                </div>
              )}
            </div>
          </OptionRow>
          {!useTarget && (
            <OptionRow label="Quality">
              <OptionSlider value={quality} min={10} max={100} step={1} onChange={setQuality} />
            </OptionRow>
          )}
        </div>
      )}

      {selectedTool === "convert" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
          <OptionRow label="Format">
            <OptionSelect value={targetFormat} onChange={setTargetFormat}
              options={formats.map((f) => ({ value: f, label: f.toUpperCase() }))}
            />
          </OptionRow>
        </div>
      )}

      {selectedTool === "vectorize" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border">
          <p className="text-xs text-white/30">Best for logos, line art, and simple graphics. Complex photos may produce large SVGs.</p>
        </div>
      )}

      {status && (
        <div className="mt-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">{status}</div>
      )}
    </ToolPage>
  );
}
