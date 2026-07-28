import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  QrCode, Download, Copy, Check, Upload, X, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  QrStyle, defaultStyle, generateQrData, renderQrSvg, exportQr,
  type QrData, type DotShape, type EyeFrameShape, type EyeInnerShape,
} from "../lib/qr-renderer";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const dotShapes: { id: DotShape; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "rounded", label: "Rounded" },
  { id: "diamond", label: "Diamond" },
  { id: "star", label: "Star" },
  { id: "blob", label: "Blob" },
];

const eyeFrameShapes: { id: EyeFrameShape; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
];

const eyeInnerShapes: { id: EyeInnerShape; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "diamond", label: "Diamond" },
];

const presets: Partial<QrStyle>[] = [
  { dotShape: "square", fgColor: "#000000", bgColor: "#ffffff", eyeFrameColor: "#000000", eyeInnerColor: "#000000", fgGradient: "none" },
  { dotShape: "circle", fgGradient: "linear", fgGradientDir: "diagonal", fgGradientStops: [{ offset: 0, color: "#6366f1" }, { offset: 1, color: "#ec4899" }], bgColor: "#ffffff", eyeFrameColor: "#6366f1", eyeInnerColor: "#ec4899" },
  { dotShape: "rounded", fgGradient: "linear", fgGradientDir: "left-right", fgGradientStops: [{ offset: 0, color: "#059669" }, { offset: 1, color: "#0ea5e9" }], bgColor: "#f0fdf4", eyeFrameColor: "#059669", eyeInnerColor: "#0ea5e9" },
  { dotShape: "diamond", fgColor: "#1e1e1e", bgColor: "#fafafa", eyeFrameColor: "#dc2626", eyeInnerColor: "#dc2626" },
  { dotShape: "circle", fgGradient: "radial", fgGradientStops: [{ offset: 0, color: "#f59e0b" }, { offset: 1, color: "#ef4444" }], bgColor: "#fffbeb", eyeFrameColor: "#f59e0b", eyeInnerColor: "#ef4444" },
  { dotShape: "blob", fgGradient: "linear", fgGradientDir: "top-bottom", fgGradientStops: [{ offset: 0, color: "#8b5cf6" }, { offset: 1, color: "#06b6d4" }], bgColor: "#ffffff", eyeFrameColor: "#8b5cf6", eyeInnerColor: "#06b6d4" },
];

export default function QrGenerator() {
  const [input, setInput] = useState("https://example.com");
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [style, setStyle] = useState<QrStyle>({ ...defaultStyle });
  const [svgOutput, setSvgOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>("style");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const updateStyle = useCallback((patch: Partial<QrStyle>) => {
    setStyle((s) => ({ ...s, ...patch }));
  }, []);

  useEffect(() => {
    if (!input.trim()) { setQrData(null); setSvgOutput(""); return; }
    let cancelled = false;
    generateQrData(input, "H").then((data) => {
      if (cancelled) return;
      setQrData(data);
      const svg = renderQrSvg(data, style);
      if (!cancelled) setSvgOutput(svg);
    });
    return () => { cancelled = true; };
  }, [input]);

  useEffect(() => {
    if (!qrData) return;
    const svg = renderQrSvg(qrData, style);
    setSvgOutput(svg);
  }, [qrData, style]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateStyle({ logoDataUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleDownload = async (format: "png" | "webp" | "svg") => {
    if (!svgOutput) return;
    if (format === "svg") {
      const blob = new Blob([svgOutput], { type: "image/svg+xml" });
      downloadBlob(blob, "qrcode.svg");
      return;
    }
    const blob = await exportQr(svgOutput, style.exportScale, format);
    downloadBlob(blob, `qrcode.${format}`);
  };

  const handleCopy = async () => {
    if (!svgOutput) return;
    try {
      const blob = await exportQr(svgOutput, 2, "png");
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await navigator.clipboard.writeText(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <h2 className="text-xl font-semibold">QR Code Generator</h2>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Input + Controls */}
        <div className="w-[380px] flex flex-col gap-3 overflow-y-auto pr-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter text or URL..."
            className="h-20 p-3 rounded-xl bg-white/5 border border-border text-sm resize-none focus:outline-none focus:border-blue-500/50 placeholder:text-white/20"
          />

          {/* Presets */}
          <div className="flex gap-1.5 flex-wrap">
            {presets.map((p, i) => (
              <button
                key={i}
                onClick={() => updateStyle(p)}
                className="w-7 h-7 rounded-lg border border-border hover:border-border-hover transition-colors"
                style={{ background: p.fgGradient !== "none" ? p.fgGradientStops?.[0]?.color : p.fgColor }}
                title={`Preset ${i + 1}`}
              />
            ))}
          </div>

          <Section title="Style" id="style" active={activeSection} setActive={setActiveSection}>
            <Row label="Dot Shape">
              <div className="flex gap-1 flex-wrap">
                {dotShapes.map((ds) => (
                  <button
                    key={ds.id}
                    onClick={() => updateStyle({ dotShape: ds.id })}
                    className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                      style.dotShape === ds.id ? "bg-white/10 border-white/20 text-white" : "border-border text-white/50 hover:text-white/80"
                    }`}
                  >
                    {ds.label}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Dot Size">
              <Slider value={style.dotSize} min={0.5} max={1.5} step={0.05} onChange={(v) => updateStyle({ dotSize: v })} />
            </Row>
          </Section>

          <Section title="Colors" id="colors" active={activeSection} setActive={setActiveSection}>
            <Row label="Foreground">
              <div className="flex gap-2 items-center">
                <input type="color" value={style.fgColor} onChange={(e) => updateStyle({ fgColor: e.target.value, fgGradient: "none" })} className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent" />
                <span className="text-xs text-white/40">{style.fgColor}</span>
              </div>
            </Row>
            <Row label="Background">
              <div className="flex gap-2 items-center">
                <input type="color" value={style.bgColor} onChange={(e) => updateStyle({ bgColor: e.target.value })} className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent" />
                <select
                  value={style.bgType}
                  onChange={(e) => updateStyle({ bgType: e.target.value as QrStyle["bgType"] })}
                  className="bg-white/5 border border-border rounded-lg px-2 py-1 text-xs text-white/70"
                >
                  <option value="color">Solid</option>
                  <option value="transparent">Transparent</option>
                  <option value="glassmorphism">Glass</option>
                </select>
              </div>
            </Row>
            {style.bgType === "glassmorphism" && (
              <Row label="BG Opacity">
                <Slider value={style.bgOpacity} min={0.1} max={1} step={0.05} onChange={(v) => updateStyle({ bgOpacity: v })} />
              </Row>
            )}
            <Row label="FG Gradient">
              <select
                value={style.fgGradient}
                onChange={(e) => updateStyle({ fgGradient: e.target.value as QrStyle["fgGradient"] })}
                className="bg-white/5 border border-border rounded-lg px-2 py-1 text-xs text-white/70"
              >
                <option value="none">None</option>
                <option value="linear">Linear</option>
                <option value="radial">Radial</option>
              </select>
            </Row>
            {style.fgGradient !== "none" && (
              <>
                <Row label="Direction">
                  <select
                    value={style.fgGradientDir}
                    onChange={(e) => updateStyle({ fgGradientDir: e.target.value as QrStyle["fgGradientDir"] })}
                    className="bg-white/5 border border-border rounded-lg px-2 py-1 text-xs text-white/70"
                  >
                    <option value="top-bottom">Top-Bottom</option>
                    <option value="left-right">Left-Right</option>
                    <option value="diagonal">Diagonal</option>
                  </select>
                </Row>
                <Row label="Colors">
                  <div className="flex gap-1">
                    {style.fgGradientStops.map((s, i) => (
                      <input
                        key={i}
                        type="color"
                        value={s.color}
                        onChange={(e) => {
                          const stops = [...style.fgGradientStops];
                          stops[i] = { ...stops[i], color: e.target.value };
                          updateStyle({ fgGradientStops: stops });
                        }}
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                      />
                    ))}
                  </div>
                </Row>
              </>
            )}
          </Section>

          <Section title="Eyes" id="eyes" active={activeSection} setActive={setActiveSection}>
            <Row label="Frame Shape">
              <div className="flex gap-1">
                {eyeFrameShapes.map((ef) => (
                  <button
                    key={ef.id}
                    onClick={() => updateStyle({ eyeFrameShape: ef.id })}
                    className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                      style.eyeFrameShape === ef.id ? "bg-white/10 border-white/20 text-white" : "border-border text-white/50 hover:text-white/80"
                    }`}
                  >
                    {ef.label}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Inner Shape">
              <div className="flex gap-1">
                {eyeInnerShapes.map((ei) => (
                  <button
                    key={ei.id}
                    onClick={() => updateStyle({ eyeInnerShape: ei.id })}
                    className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                      style.eyeInnerShape === ei.id ? "bg-white/10 border-white/20 text-white" : "border-border text-white/50 hover:text-white/80"
                    }`}
                  >
                    {ei.label}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Frame Color">
              <input type="color" value={style.eyeFrameColor} onChange={(e) => updateStyle({ eyeFrameColor: e.target.value })} className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent" />
            </Row>
            <Row label="Inner Color">
              <input type="color" value={style.eyeInnerColor} onChange={(e) => updateStyle({ eyeInnerColor: e.target.value })} className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent" />
            </Row>
          </Section>

          <Section title="Logo" id="logo" active={activeSection} setActive={setActiveSection}>
            <Row label="Upload">
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-border text-xs text-white/60 hover:text-white transition-colors"
                >
                  <Upload className="w-3 h-3" /> Choose
                </button>
                {style.logoDataUrl && (
                  <button onClick={() => updateStyle({ logoDataUrl: "" })} className="text-white/30 hover:text-white/60">
                    <X className="w-3 h-3" />
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </Row>
            {style.logoDataUrl && (
              <Row label="Logo Size">
                <Slider value={style.logoSize} min={0.1} max={0.4} step={0.02} onChange={(v) => updateStyle({ logoSize: v })} />
              </Row>
            )}
          </Section>

          <Section title="Frame & Text" id="frame" active={activeSection} setActive={setActiveSection}>
            <Row label="Enable">
              <Toggle checked={style.frameEnabled} onChange={(v) => updateStyle({ frameEnabled: v })} />
            </Row>
            {style.frameEnabled && (
              <>
                <Row label="Text">
                  <input
                    type="text"
                    value={style.frameText}
                    onChange={(e) => updateStyle({ frameText: e.target.value })}
                    className="w-full px-2 py-1 rounded-lg bg-white/5 border border-border text-xs text-white/70 focus:outline-none focus:border-blue-500/50"
                    placeholder="SCAN ME"
                  />
                </Row>
                <Row label="Frame Color">
                  <input type="color" value={style.frameColor} onChange={(e) => updateStyle({ frameColor: e.target.value })} className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent" />
                </Row>
                <Row label="BG Color">
                  <input type="color" value={style.frameBgColor} onChange={(e) => updateStyle({ frameBgColor: e.target.value })} className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent" />
                </Row>
                <Row label="Radius">
                  <Slider value={style.frameRadius} min={0} max={32} step={1} onChange={(v) => updateStyle({ frameRadius: v })} />
                </Row>
              </>
            )}
          </Section>

          <Section title="Layout" id="layout" active={activeSection} setActive={setActiveSection}>
            <Row label="Margin">
              <Slider value={style.margin} min={0} max={8} step={0.5} onChange={(v) => updateStyle({ margin: v })} />
            </Row>
            <Row label="Export Scale">
              <div className="flex gap-1">
                {[1, 2, 4, 8].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStyle({ exportScale: s })}
                    className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                      style.exportScale === s ? "bg-white/10 border-white/20 text-white" : "border-border text-white/50 hover:text-white/80"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </Row>
          </Section>
        </div>

        {/* Right: Preview + Export */}
        <div className="flex-1 flex flex-col items-center gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: svgOutput ? 1 : 0.3, scale: svgOutput ? 1 : 0.95 }}
            transition={spring}
            className="flex items-center justify-center bg-[#e8e8e8] rounded-2xl p-6 min-h-[320px] max-h-[500px]"
            style={style.bgType === "glassmorphism" ? {
              backgroundImage: "radial-gradient(circle at 20% 50%, rgba(99,102,241,0.15), transparent 50%), radial-gradient(circle at 80% 20%, rgba(236,72,153,0.15), transparent 50%), radial-gradient(circle at 50% 80%, rgba(14,165,233,0.1), transparent 50%)",
              backgroundColor: "#d4d4d8",
            } : style.bgType === "transparent" ? {
              backgroundImage: "repeating-conic-gradient(#d4d4d8 0% 25%, #f4f4f5 0% 50%) 50% / 16px 16px",
            } : undefined}
          >
            {svgOutput ? (
              <div dangerouslySetInnerHTML={{ __html: svgOutput }} className="max-w-full max-h-[420px]" style={{ width: "100%", display: "flex", justifyContent: "center" }} />
            ) : (
              <QrCode className="w-16 h-16 text-black/10" />
            )}
          </motion.div>

          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring}
              onClick={handleCopy} disabled={!svgOutput}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border text-xs text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring}
              onClick={() => handleDownload("svg")} disabled={!svgOutput}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border text-xs text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <Download className="w-3 h-3" /> SVG
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring}
              onClick={() => handleDownload("png")} disabled={!svgOutput}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border text-xs text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <Download className="w-3 h-3" /> PNG {style.exportScale}x
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring}
              onClick={() => handleDownload("webp")} disabled={!svgOutput}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border text-xs text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <Download className="w-3 h-3" /> WebP
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, id, active, setActive, children }: {
  title: string; id: string; active: string | null; setActive: (id: string | null) => void; children: React.ReactNode;
}) {
  const isOpen = active === id;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setActive(isOpen ? null : id)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white/5 text-xs font-medium text-white/70 hover:bg-white/8 transition-colors"
      >
        {title}
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {isOpen && <div className="px-3 py-2 flex flex-col gap-2">{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-white/40 whitespace-nowrap">{label}</span>
      {children}
    </div>
  );
}

function Slider({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
      />
      <span className="text-xs text-white/40 w-8 text-right">{typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}</span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-8 h-4 rounded-full transition-colors relative ${checked ? "bg-blue-500" : "bg-white/10"}`}
    >
      <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${checked ? "translate-x-4.5 left-0.5" : "left-0.5"}`}
        style={{ transform: checked ? "translateX(16px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
