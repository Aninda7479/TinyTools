import { useState } from "react";
import ToolPage, { OptionRow, OptionSlider, OptionSelect } from "./ToolPage";
import { smartCrop, expandCanvas, splitImage, stitchImages } from "../lib/tauri";

type EditTool = "crop" | "expand" | "split" | "stitch";

export default function EditingPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [selectedTool, setSelectedTool] = useState<EditTool>((defaultSub as EditTool) || "crop");
  const [cropW, setCropW] = useState(800);
  const [cropH, setCropH] = useState(600);
  const [gravity, setGravity] = useState("center");
  const [padTop, setPadTop] = useState(20);
  const [padBottom, setPadBottom] = useState(20);
  const [padLeft, setPadLeft] = useState(20);
  const [padRight, setPadRight] = useState(20);
  const [padColor, setPadColor] = useState("#ffffff");
  const [splitRows, setSplitRows] = useState(3);
  const [splitCols, setSplitCols] = useState(3);
  const [stitchDir, setStitchDir] = useState("horizontal");
  const [status, setStatus] = useState("");

  const tools = [
    { id: "crop" as const, label: "Smart Crop", desc: "Crop to any aspect ratio or preset" },
    { id: "expand" as const, label: "Canvas Expand", desc: "Add borders, padding, or frames" },
    { id: "split" as const, label: "Image Splitter", desc: "Slice into grid for social media" },
    { id: "stitch" as const, label: "Image Stitcher", desc: "Combine multiple photos" },
  ];

  const presets = [
    { label: "1:1 Square", w: 1080, h: 1080 },
    { label: "9:16 Story", w: 1080, h: 1920 },
    { label: "16:9 Landscape", w: 1920, h: 1080 },
    { label: "4:5 Instagram", w: 1080, h: 1350 },
    { label: "Passport", w: 600, h: 600 },
  ];

  const handleProcess = async (files: { name: string; path: string }[]) => {
    const f = files[0];
    if (!f?.path) { setStatus("Provide file path"); return; }
    setStatus("Processing...");
    try {
      let result;
      switch (selectedTool) {
        case "crop":
          result = await smartCrop(f.path, f.path.replace(/\.[^.]+$/, "_cropped.png"), cropW, cropH, gravity);
          break;
        case "expand":
          result = await expandCanvas(f.path, f.path.replace(/\.[^.]+$/, "_expanded.png"), padTop, padBottom, padLeft, padRight, padColor);
          break;
        case "split":
          const dir = f.path.substring(0, f.path.lastIndexOf("\\") || f.path.lastIndexOf("/"));
          result = await splitImage(f.path, dir + "/split", splitRows, splitCols);
          break;
        case "stitch": {
          const paths = files.map((f: { name: string; path: string }) => f.path);
          const outDir = paths[0].substring(0, paths[0].lastIndexOf("\\") || paths[0].lastIndexOf("/"));
          result = await stitchImages(paths, outDir + "/stitched.png", stitchDir);
          break;
        }
      }
      setStatus(result?.message || "Done");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  return (
    <ToolPage title="Editing & Layout" description="Crop, pad, split, and combine images" onProcess={handleProcess} multiFile={selectedTool === "stitch"}>
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

      {selectedTool === "crop" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
          <p className="text-xs text-white/30 mb-1">Presets</p>
          <div className="flex flex-wrap gap-1">
            {presets.map((p) => (
              <button key={p.label} onClick={() => { setCropW(p.w); setCropH(p.h); }}
                className="px-2 py-1 rounded-lg text-[10px] border border-border text-white/50 hover:text-white hover:border-white/20 transition-colors"
              >{p.label}</button>
            ))}
          </div>
          <OptionRow label="Width"><OptionSlider value={cropW} min={100} max={4000} step={10} onChange={setCropW} /></OptionRow>
          <OptionRow label="Height"><OptionSlider value={cropH} min={100} max={4000} step={10} onChange={setCropH} /></OptionRow>
          <OptionRow label="Gravity">
            <OptionSelect value={gravity} onChange={setGravity}
              options={[{ value: "center", label: "Center" }, { value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }]}
            />
          </OptionRow>
        </div>
      )}

      {selectedTool === "expand" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
          <OptionRow label="Top"><OptionSlider value={padTop} min={0} max={200} step={5} onChange={setPadTop} /></OptionRow>
          <OptionRow label="Bottom"><OptionSlider value={padBottom} min={0} max={200} step={5} onChange={setPadBottom} /></OptionRow>
          <OptionRow label="Left"><OptionSlider value={padLeft} min={0} max={200} step={5} onChange={setPadLeft} /></OptionRow>
          <OptionRow label="Right"><OptionSlider value={padRight} min={0} max={200} step={5} onChange={setPadRight} /></OptionRow>
          <OptionRow label="Color">
            <input type="color" value={padColor} onChange={(e) => setPadColor(e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent" />
          </OptionRow>
        </div>
      )}

      {selectedTool === "split" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
          <OptionRow label="Rows"><OptionSlider value={splitRows} min={1} max={6} step={1} onChange={setSplitRows} /></OptionRow>
          <OptionRow label="Cols"><OptionSlider value={splitCols} min={1} max={6} step={1} onChange={setSplitCols} /></OptionRow>
          <p className="text-[10px] text-white/30">Output: {splitRows}x{splitCols} = {splitRows * splitCols} pieces</p>
        </div>
      )}

      {selectedTool === "stitch" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
          <OptionRow label="Direction">
            <OptionSelect value={stitchDir} onChange={setStitchDir}
              options={[{ value: "horizontal", label: "Horizontal" }, { value: "vertical", label: "Vertical" }]}
            />
          </OptionRow>
          <p className="text-[10px] text-white/30">Drop multiple images to stitch them together</p>
        </div>
      )}

      {status && (
        <div className="mt-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">{status}</div>
      )}
    </ToolPage>
  );
}
