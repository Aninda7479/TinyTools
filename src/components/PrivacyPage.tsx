import { useState } from "react";
import ToolPage, { OptionRow, OptionSlider, OptionSelect } from "./ToolPage";
import { stripMetadata, redactRegions, addWatermark } from "../lib/tauri";

type PrivacyTool = "strip-metadata" | "redact" | "watermark";

export default function PrivacyPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [selectedTool, setSelectedTool] = useState<PrivacyTool>((defaultSub as PrivacyTool) || "strip-metadata");
  const [watermarkText, setWatermarkText] = useState("WATERMARK");
  const [watermarkOpacity, setWatermarkOpacity] = useState(80);
  const [watermarkPosition, setWatermarkPosition] = useState("bottom-right");
  const [redactMethod, setRedactMethod] = useState("blur");
  const [status, setStatus] = useState("");

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
          break;
        case "redact":
          result = await redactRegions(f.path, out, [[50, 50, 100, 100]], redactMethod);
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

  return (
    <ToolPage title="Privacy & Metadata" description="Protect sensitive information in images" onProcess={handleProcess}>
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

      {selectedTool === "redact" && (
        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-border flex flex-col gap-2">
          <OptionRow label="Method">
            <OptionSelect value={redactMethod} onChange={setRedactMethod}
              options={[{ value: "blur", label: "Blur" }, { value: "pixelate", label: "Pixelate" }]}
            />
          </OptionRow>
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
