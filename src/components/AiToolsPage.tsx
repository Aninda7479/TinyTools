import { useState } from "react";
import ToolPage, { OptionRow, OptionSlider } from "./ToolPage";
import { removeBackground, inpaintImage, upscaleImage, sepiaFilter, smartSharpen, depthBlur } from "../lib/tauri";

type AiTool = "bg-remove" | "inpaint" | "upscale" | "sepia" | "smart-sharpen" | "depth-blur";

const tools: { id: AiTool; label: string; description: string }[] = [
  { id: "bg-remove", label: "Background Removal", description: "Remove backgrounds → transparent PNG" },
  { id: "inpaint", label: "Object Removal", description: "Erase unwanted objects or text" },
  { id: "upscale", label: "AI Upscale", description: "Increase resolution 2x or 4x" },
  { id: "sepia", label: "Sepia Filter", description: "Vintage sepia tone effect" },
  { id: "smart-sharpen", label: "Smart Sharpen", description: "Edge-aware detail enhancement" },
  { id: "depth-blur", label: "Depth Blur", description: "DSLR-style bokeh background blur" },
];

export default function AiToolsPage() {
  const [selectedTool, setSelectedTool] = useState<AiTool>("bg-remove");
  const [scale, setScale] = useState(2);
  const [blurStrength, setBlurStrength] = useState(8.0);
  const [faceStrength, setFaceStrength] = useState(1.0);  const [status, setStatus] = useState("");

  const handleProcess = async (files: { name: string; path: string }[]) => {
    const f = files[0];
    if (!f?.path) { setStatus("Please provide file path (run from Tauri)"); return; }
    const out = f.path.replace(/\.[^.]+$/, `_${selectedTool}.png`);
    setStatus("Processing...");
    try {
      let result;
      switch (selectedTool) {
        case "bg-remove": result = await removeBackground(f.path, out); break;
        case "inpaint": result = await inpaintImage(f.path, out, [[10, 10, 50, 50]]); break;
        case "upscale": result = await upscaleImage(f.path, out, scale); break;
        case "sepia": result = await sepiaFilter(f.path, out); break;
        case "smart-sharpen": result = await smartSharpen(f.path, out, faceStrength); break;
        case "depth-blur": result = await depthBlur(f.path, out, blurStrength); break;
      }
      setStatus(result?.message || "Done");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  return (
    <ToolPage title="AI & Smart Tools" description="Local AI-powered image processing" onProcess={handleProcess} processLabel="Run AI Tool">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-white/40 uppercase tracking-wider">Select Tool</p>
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTool(t.id)}
            className={`text-left p-3 rounded-xl border transition-colors ${
              selectedTool === t.id ? "bg-white/10 border-white/20" : "bg-white/5 border-border hover:border-border-hover"
            }`}
          >
            <p className="text-sm font-medium">{t.label}</p>
            <p className="text-xs text-white/40">{t.description}</p>
          </button>
        ))}
      </div>

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
          {status}
        </div>
      )}
    </ToolPage>
  );
}
