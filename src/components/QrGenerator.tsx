import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  QrCode, Download, Copy, Check, Upload, X, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  QrStyle, defaultStyle, generateQrData, renderQrSvg, exportQr,
  getContrastRatio,
  type QrData, type DotShape, type EyeFrameShape, type EyeInnerShape,
} from "../lib/qr-renderer";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

type QrInputType = "url" | "text" | "wifi" | "vcard" | "email";

const inputTypes: { id: QrInputType; label: string }[] = [
  { id: "url", label: "URL" },
  { id: "text", label: "Text" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "vcard", label: "Contact" },
  { id: "email", label: "Email" },
];

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

interface ThemePreset {
  label: string;
  fg: string;
  bg: string;
  eyeFrame: string;
  eyeInner: string;
  gradient?: "none" | "linear" | "radial";
  gradientDir?: "top-bottom" | "left-right" | "diagonal";
  gradientStops?: { offset: number; color: string }[];
}

const themePresets: ThemePreset[] = [
  { label: "Original", fg: "#000000", bg: "#ffffff", eyeFrame: "#000000", eyeInner: "#000000" },
  { label: "Ocean", fg: "#000000", bg: "#e0f2fe", eyeFrame: "#0284c7", eyeInner: "#0369a1", gradient: "linear", gradientDir: "diagonal", gradientStops: [{ offset: 0, color: "#6366f1" }, { offset: 1, color: "#ec4899" }] },
  { label: "Neon", fg: "#000000", bg: "#f0fdf4", eyeFrame: "#059669", eyeInner: "#047857", gradient: "linear", gradientDir: "left-right", gradientStops: [{ offset: 0, color: "#059669" }, { offset: 1, color: "#0ea5e9" }] },
  { label: "Midnight", fg: "#ffffff", bg: "#1e1e2e", eyeFrame: "#facc15", eyeInner: "#facc15" },
  { label: "Amber", fg: "#000000", bg: "#fffbeb", eyeFrame: "#f59e0b", eyeInner: "#ef4444", gradient: "radial", gradientStops: [{ offset: 0, color: "#f59e0b" }, { offset: 1, color: "#ef4444" }] },
  { label: "Violet", fg: "#ffffff", bg: "#1e1b4b", eyeFrame: "#c084fc", eyeInner: "#a855f7", gradient: "linear", gradientDir: "top-bottom", gradientStops: [{ offset: 0, color: "#8b5cf6" }, { offset: 1, color: "#06b6d4" }] },
];

type PreviewBg = "light" | "dark" | "checker";

export default function QrGenerator() {
  const [inputType, setInputType] = useState<QrInputType>("url");
  // URL/Text
  const [rawInput, setRawInput] = useState("https://example.com");
  // Wi-Fi
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [wifiEnc, setWifiEnc] = useState<"WPA" | "WPA2" | "Open">("WPA2");
  // vCard
  const [vcardName, setVcardName] = useState("");
  const [vcardPhone, setVcardPhone] = useState("");
  const [vcardEmail, setVcardEmail] = useState("");
  const [vcardOrg, setVcardOrg] = useState("");
  // Email
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const [qrData, setQrData] = useState<QrData | null>(null);
  const [style, setStyle] = useState<QrStyle>({ ...defaultStyle });
  const [svgOutput, setSvgOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>("style");
  const [previewBg, setPreviewBg] = useState<PreviewBg>("light");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const currentInput = useCallback(() => {
    switch (inputType) {
      case "url": return rawInput;
      case "text": return rawInput;
      case "wifi": {
        if (!wifiSsid) return "";
        if (wifiEnc === "Open") return `WIFI:S:${wifiSsid};T:${wifiEnc};;`;
        return `WIFI:S:${wifiSsid};T:${wifiEnc};P:${wifiPass};;`;
      }
      case "vcard": {
        let v = "BEGIN:VCARD\nVERSION:3.0\n";
        if (vcardName) v += `FN:${vcardName}\nN:${vcardName};;;\n`;
        if (vcardPhone) v += `TEL:${vcardPhone}\n`;
        if (vcardEmail) v += `EMAIL:${vcardEmail}\n`;
        if (vcardOrg) v += `ORG:${vcardOrg}\n`;
        v += "END:VCARD";
        return v;
      }
      case "email": {
        let m = `mailto:${emailTo}`;
        const params: string[] = [];
        if (emailSubject) params.push(`subject=${encodeURIComponent(emailSubject)}`);
        if (emailBody) params.push(`body=${encodeURIComponent(emailBody)}`);
        if (params.length) m += `?${params.join("&")}`;
        return m;
      }
    }
  }, [inputType, rawInput, wifiSsid, wifiPass, wifiEnc, vcardName, vcardPhone, vcardEmail, vcardOrg, emailTo, emailSubject, emailBody]);

  const updateStyle = useCallback((patch: Partial<QrStyle>) => {
    setStyle((s) => ({ ...s, ...patch }));
  }, []);

  useEffect(() => {
    const input = currentInput();
    if (!input.trim()) { setQrData(null); setSvgOutput(""); return; }
    let cancelled = false;
    generateQrData(input, "H").then((data) => {
      if (cancelled) return;
      setQrData(data);
      const svg = renderQrSvg(data, style);
      if (!cancelled) setSvgOutput(svg);
    });
    return () => { cancelled = true; };
  }, [currentInput]);

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
      await navigator.clipboard.writeText(currentInput());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const applyTheme = (t: ThemePreset) => {
    const patch: Partial<QrStyle> = {
      fgColor: t.fg,
      bgColor: t.bg,
      eyeFrameColor: t.eyeFrame,
      eyeInnerColor: t.eyeInner,
    };
    if (t.gradient) {
      patch.fgGradient = t.gradient;
      if (t.gradientDir) patch.fgGradientDir = t.gradientDir;
      if (t.gradientStops) patch.fgGradientStops = t.gradientStops;
    } else {
      patch.fgGradient = "none";
    }
    updateStyle(patch);
  };

  const contrastRatio = style.bgType === "color" ? getContrastRatio(style.fgColor, style.bgColor) : null;
  const contrastBadge = contrastRatio !== null
    ? contrastRatio >= 4.5
      ? { text: "Scannable", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" }
      : { text: "Low Contrast", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" }
    : null;

  const previewBgStyle = (() => {
    if (previewBg === "dark") return { backgroundColor: "#27272a" };
    if (previewBg === "checker") return {
      backgroundImage: "repeating-conic-gradient(#d4d4d8 0% 25%, #f4f4f5 0% 50%) 50% / 16px 16px",
    };
    return { backgroundColor: "#e8e8e8" };
  })();

  const pngPx = (() => {
    if (!svgOutput) return "";
    const svgEl = (() => { try { const p = new DOMParser().parseFromString(svgOutput, "image/svg+xml"); return p.querySelector("svg"); } catch { return null; } })();
    if (!svgEl) return "";
    const w = parseFloat(svgEl.getAttribute("width") || "0");
    return ` (${Math.round(w * style.exportScale)}px)`;
  })();

  return (
    <div className="flex flex-col h-full gap-4">
      <h2 className="text-xl font-semibold">QR Code Generator</h2>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Input + Controls */}
        <div className="w-[380px] flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Input Type Tabs */}
          <div className="flex gap-1">
            {inputTypes.map((t) => (
              <button key={t.id}
                onClick={() => setInputType(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  inputType === t.id ? "bg-white/10 border-white/20 text-white" : "border-border text-white/50 hover:text-white/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Dynamic Input Fields */}
          {(inputType === "url" || inputType === "text") && (
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={inputType === "url" ? "https://example.com" : "Enter text..."}
              className="h-20 p-3 rounded-xl bg-white/5 border border-border text-sm resize-none focus:outline-none focus:border-blue-500/50 placeholder:text-white/20"
            />
          )}

          {inputType === "wifi" && (
            <div className="flex flex-col gap-2">
              <InputField label="Network Name (SSID)" value={wifiSsid} onChange={setWifiSsid} placeholder="My Wi-Fi" />
              <InputField label="Password" value={wifiPass} onChange={setWifiPass} placeholder="••••••••" type="password" />
              <label className="text-xs text-white/40">Encryption
                <select value={wifiEnc} onChange={(e) => setWifiEnc(e.target.value as typeof wifiEnc)}
                  className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-1.5 text-xs text-white/70">
                  <option value="WPA2">WPA2</option>
                  <option value="WPA">WPA</option>
                  <option value="Open">Open</option>
                </select>
              </label>
            </div>
          )}

          {inputType === "vcard" && (
            <div className="flex flex-col gap-2">
              <InputField label="Name" value={vcardName} onChange={setVcardName} placeholder="John Doe" />
              <InputField label="Phone" value={vcardPhone} onChange={setVcardPhone} placeholder="+1 555-0123" />
              <InputField label="Email" value={vcardEmail} onChange={setVcardEmail} placeholder="john@example.com" />
              <InputField label="Organization" value={vcardOrg} onChange={setVcardOrg} placeholder="Acme Inc" />
            </div>
          )}

          {inputType === "email" && (
            <div className="flex flex-col gap-2">
              <InputField label="To" value={emailTo} onChange={setEmailTo} placeholder="recipient@example.com" />
              <InputField label="Subject" value={emailSubject} onChange={setEmailSubject} placeholder="Subject" />
              <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Body..."
                className="h-16 p-3 rounded-xl bg-white/5 border border-border text-sm resize-none focus:outline-none focus:border-blue-500/50 placeholder:text-white/20"
              />
            </div>
          )}

          {/* Theme Presets */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-white/20 px-0.5">Theme Presets</span>
            <div className="flex gap-1.5 flex-wrap">
              {themePresets.map((t, i) => (
                <button key={i} onClick={() => applyTheme(t)}
                  title={t.label}
                  className="group relative w-8 h-8 rounded-lg border border-border hover:border-white/30 transition-colors flex items-center justify-center"
                  style={{ background: t.bg }}
                >
                  <span className="w-4 h-4 rounded-sm" style={{ background: t.gradient !== "none" && t.gradientStops ? t.gradientStops[0].color : t.fg }} />
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Section title="Style" id="style" active={activeSection} setActive={setActiveSection}>
            <Row label="Dot Shape">
              <div className="flex gap-1 flex-wrap">
                {dotShapes.map((ds) => (
                  <button key={ds.id} onClick={() => updateStyle({ dotShape: ds.id })}
                    className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                      style.dotShape === ds.id ? "bg-white/10 border-white/20 text-white" : "border-border text-white/50 hover:text-white/80"
                    }`}
                  >{ds.label}</button>
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
                <select value={style.bgType} onChange={(e) => updateStyle({ bgType: e.target.value as QrStyle["bgType"] })}
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
              <select value={style.fgGradient} onChange={(e) => updateStyle({ fgGradient: e.target.value as QrStyle["fgGradient"] })}
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
                  <select value={style.fgGradientDir} onChange={(e) => updateStyle({ fgGradientDir: e.target.value as QrStyle["fgGradientDir"] })}
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
                      <input key={i} type="color" value={s.color}
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
                  <button key={ef.id} onClick={() => updateStyle({ eyeFrameShape: ef.id })}
                    className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                      style.eyeFrameShape === ef.id ? "bg-white/10 border-white/20 text-white" : "border-border text-white/50 hover:text-white/80"
                    }`}
                  >{ef.label}</button>
                ))}
              </div>
            </Row>
            <Row label="Inner Shape">
              <div className="flex gap-1">
                {eyeInnerShapes.map((ei) => (
                  <button key={ei.id} onClick={() => updateStyle({ eyeInnerShape: ei.id })}
                    className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                      style.eyeInnerShape === ei.id ? "bg-white/10 border-white/20 text-white" : "border-border text-white/50 hover:text-white/80"
                    }`}
                  >{ei.label}</button>
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
                <button onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-border text-xs text-white/60 hover:text-white transition-colors"
                ><Upload className="w-3 h-3" /> Choose</button>
                {style.logoDataUrl && (
                  <button onClick={() => updateStyle({ logoDataUrl: "" })} className="text-white/30 hover:text-white/60">
                    <X className="w-3 h-3" />
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </Row>
            {style.logoDataUrl && (
              <>
                <Row label="Logo Size">
                  <Slider value={style.logoSize} min={0.1} max={0.4} step={0.02} onChange={(v) => updateStyle({ logoSize: v })} />
                </Row>
                <Row label="BG Padding">
                  <Slider value={style.logoMargin} min={0.2} max={2} step={0.1} onChange={(v) => updateStyle({ logoMargin: v })} />
                </Row>
              </>
            )}
          </Section>

          <Section title="Frame & Text" id="frame" active={activeSection} setActive={setActiveSection}>
            <Row label="Enable">
              <Toggle checked={style.frameEnabled} onChange={(v) => updateStyle({ frameEnabled: v })} />
            </Row>
            {style.frameEnabled && (
              <>
                <Row label="Text">
                  <input type="text" value={style.frameText} onChange={(e) => updateStyle({ frameText: e.target.value })}
                    className="w-full px-2 py-1 rounded-lg bg-white/5 border border-border text-xs text-white/70 focus:outline-none focus:border-blue-500/50" placeholder="SCAN ME"
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
                  <button key={s} onClick={() => updateStyle({ exportScale: s })}
                    className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                      style.exportScale === s ? "bg-white/10 border-white/20 text-white" : "border-border text-white/50 hover:text-white/80"
                    }`}
                  >{s}x</button>
                ))}
              </div>
            </Row>
          </Section>
        </div>

        {/* Right: Preview + Export */}
        <div className="flex-1 flex flex-col items-center gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: svgOutput ? 1 : 0.3, scale: svgOutput ? 1 : 0.95 }}
            transition={spring}
            className="flex items-center justify-center rounded-2xl p-6 min-h-[320px] max-h-[480px] w-full"
            style={previewBgStyle}
          >
            {svgOutput ? (
              <div dangerouslySetInnerHTML={{ __html: svgOutput }} className="max-w-full max-h-[400px]" style={{ width: "100%", display: "flex", justifyContent: "center" }} />
            ) : (
              <QrCode className="w-16 h-16 text-white/10" />
            )}
          </motion.div>

          {/* Scannability Badge + Preview Bg Toggles */}
          <div className="flex items-center gap-3">
            {contrastBadge && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${contrastBadge.cls}`}>
                {contrastBadge.text}
              </span>
            )}
            <div className="flex gap-1">
              {(["light", "dark", "checker"] as PreviewBg[]).map((b) => (
                <button key={b} onClick={() => setPreviewBg(b)}
                  className={`w-5 h-5 rounded-full border transition-colors ${
                    previewBg === b ? "border-white/40 ring-1 ring-white/20" : "border-white/10"
                  }`}
                  title={b}
                  style={b === "light" ? { backgroundColor: "#e8e8e8" } : b === "dark" ? { backgroundColor: "#27272a" } : {
                    backgroundImage: "repeating-conic-gradient(#d4d4d8 0% 25%, #f4f4f5 0% 50%)",
                    backgroundSize: "6px 6px",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <ActionBtn onClick={handleCopy} disabled={!svgOutput}>
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </ActionBtn>
            <ActionBtn onClick={() => handleDownload("svg")} disabled={!svgOutput}>
              <Download className="w-3 h-3" /> SVG
            </ActionBtn>
            <ActionBtn onClick={() => handleDownload("png")} disabled={!svgOutput}>
              <Download className="w-3 h-3" /> PNG{pngPx}
            </ActionBtn>
            <ActionBtn onClick={() => handleDownload("webp")} disabled={!svgOutput}>
              <Download className="w-3 h-3" /> WebP
            </ActionBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="text-xs text-white/40">
      {label}
      <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-blue-500/50 placeholder:text-white/20"
      />
    </label>
  );
}

function ActionBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring}
      onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border text-xs text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
    >
      {children}
    </motion.button>
  );
}

function Section({ title, id, active, setActive, children }: {
  title: string; id: string; active: string | null; setActive: (id: string | null) => void; children: React.ReactNode;
}) {
  const isOpen = active === id;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setActive(isOpen ? null : id)}
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
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
      />
      <span className="text-xs text-white/40 w-8 text-right">{typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}</span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
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
