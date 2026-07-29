import QRCode from "qrcode";

export type DotShape = "square" | "circle" | "rounded" | "diamond" | "star" | "blob";
export type EyeFrameShape = "square" | "rounded" | "circle";
export type EyeInnerShape = "square" | "circle" | "diamond";
export type GradientType = "none" | "linear" | "radial";
export type GradientDirection = "top-bottom" | "left-right" | "diagonal" | "radial";

export interface GradientStop {
  offset: number;
  color: string;
}

export interface QrStyle {
  dotShape: DotShape;
  dotSize: number;
  fgColor: string;
  bgType: "color" | "transparent" | "glassmorphism";
  bgColor: string;
  bgOpacity: number;
  eyeFrameShape: EyeFrameShape;
  eyeInnerShape: EyeInnerShape;
  eyeFrameColor: string;
  eyeInnerColor: string;
  fgGradient: GradientType;
  fgGradientDir: GradientDirection;
  fgGradientStops: GradientStop[];
  bgGradient: GradientType;
  bgGradientDir: GradientDirection;
  bgGradientStops: GradientStop[];
  margin: number;
  logoDataUrl: string;
  logoSize: number;
  logoMargin: number;
  frameEnabled: boolean;
  frameText: string;
  frameColor: string;
  frameBgColor: string;
  frameRadius: number;
  exportScale: number;
}

export const defaultStyle: QrStyle = {
  dotShape: "square",
  dotSize: 1.0,
  fgColor: "#000000",
  bgType: "color",
  bgColor: "#ffffff",
  bgOpacity: 1.0,
  eyeFrameShape: "square",
  eyeInnerShape: "square",
  eyeFrameColor: "#000000",
  eyeInnerColor: "#000000",
  fgGradient: "none",
  fgGradientDir: "top-bottom",
  fgGradientStops: [
    { offset: 0, color: "#000000" },
    { offset: 1, color: "#333333" },
  ],
  bgGradient: "none",
  bgGradientDir: "top-bottom",
  bgGradientStops: [
    { offset: 0, color: "#ffffff" },
    { offset: 1, color: "#f0f0f0" },
  ],
  margin: 4,
  logoDataUrl: "",
  logoSize: 0.24,
  logoMargin: 0.8,
  frameEnabled: false,
  frameText: "SCAN ME",
  frameColor: "#000000",
  frameBgColor: "#ffffff",
  frameRadius: 16,
  exportScale: 4,
};

export interface QrData {
  modules: boolean[][];
  size: number;
}

export async function generateQrData(text: string, errorCorrectionLevel: "L" | "M" | "Q" | "H" = "H"): Promise<QrData> {
  const qr = QRCode.create(text, { errorCorrectionLevel });
  const modules: boolean[][] = [];
  for (let row = 0; row < qr.modules.size; row++) {
    modules[row] = [];
    for (let col = 0; col < qr.modules.size; col++) {
      modules[row][col] = qr.modules.get(row, col);
    }
  }
  return { modules, size: qr.modules.size };
}

function dotPath(shape: DotShape, cx: number, cy: number, s: number): string {
  const h = s / 2;
  switch (shape) {
    case "circle":
      return `M${cx - h},${cy}A${h},${h},0,1,1,${cx + h},${cy}A${h},${h},0,1,1,${cx - h},${cy}Z`;
    case "rounded": {
      const r = h * 0.4;
      const x1 = cx - h, y1 = cy - h, x2 = cx + h, y2 = cy + h;
      return `M${x1 + r},${y1}L${x2 - r},${y1}Q${x2},${y1},${x2},${y1 + r}L${x2},${y2 - r}Q${x2},${y2},${x2 - r},${y2}L${x1 + r},${y2}Q${x1},${y2},${x1},${y2 - r}L${x1},${y1 + r}Q${x1},${y1},${x1 + r},${y1}Z`;
    }
    case "diamond":
      return `M${cx},${cy - h}L${cx + h},${cy}L${cx},${cy + h}L${cx - h},${cy}Z`;
    case "star": {
      const outer = h;
      const inner = h * 0.45;
      let d = "";
      for (let i = 0; i < 5; i++) {
        const aOuter = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const aInner = aOuter + Math.PI / 5;
        const ox = cx + outer * Math.cos(aOuter);
        const oy = cy + outer * Math.sin(aOuter);
        const ix = cx + inner * Math.cos(aInner);
        const iy = cy + inner * Math.sin(aInner);
        d += (i === 0 ? "M" : "L") + `${ox},${oy}L${ix},${iy}`;
      }
      return d + "Z";
    }
    case "blob": {
      const r = h * 0.85;
      const bx = (Math.sin(cx * 0.1) * 0.15 + 0.9) * r;
      const by = (Math.cos(cy * 0.1) * 0.15 + 0.9) * r;
      return `M${cx - bx},${cy}C${cx - bx},${cy - by * 0.6},${cx - bx * 0.6},${cy - by},${cx},${cy - by}C${cx + bx * 0.6},${cy - by},${cx + bx},${cy - by * 0.6},${cx + bx},${cy}C${cx + bx},${cy + by * 0.6},${cx + bx * 0.6},${cy + by},${cx},${cy + by}C${cx - bx * 0.6},${cy + by},${cx - bx},${cy + by * 0.6},${cx - bx},${cy}Z`;
    }
    case "square":
    default:
      return `M${cx - h},${cy - h}L${cx + h},${cy - h}L${cx + h},${cy + h}L${cx - h},${cy + h}Z`;
  }
}

function eyeFramePath(shape: EyeFrameShape, x: number, y: number, size: number): string {
  const h = size / 2;
  const cy = y + h;
  switch (shape) {
    case "circle":
      return `M${x},${cy}A${h},${h},0,1,1,${x + size},${cy}A${h},${h},0,1,1,${x},${cy}Z`;
    case "rounded": {
      const r = size * 0.2;
      return `M${x + r},${y}L${x + size - r},${y}Q${x + size},${y},${x + size},${y + r}L${x + size},${y + size - r}Q${x + size},${y + size},${x + size - r},${y + size}L${x + r},${y + size}Q${x},${y + size},${x},${y + size - r}L${x},${y + r}Q${x},${y},${x + r},${y}Z`;
    }
    case "square":
    default:
      return `M${x},${y}L${x + size},${y}L${x + size},${y + size}L${x},${y + size}Z`;
  }
}

function eyeInnerPath(shape: EyeInnerShape, cx: number, cy: number, size: number): string {
  const h = size / 2;
  switch (shape) {
    case "circle":
      return `M${cx - h},${cy}A${h},${h},0,1,1,${cx + h},${cy}A${h},${h},0,1,1,${cx - h},${cy}Z`;
    case "diamond":
      return `M${cx},${cy - h}L${cx + h},${cy}L${cx},${cy + h}L${cx - h},${cy}Z`;
    case "square":
    default:
      return `M${cx - h},${cy - h}L${cx + h},${cy - h}L${cx + h},${cy + h}L${cx - h},${cy + h}Z`;
  }
}

export function renderQrSvg(data: QrData, style: QrStyle): string {
  const { modules, size } = data;
  const m = style.margin;
  const cellSize = 10 * style.dotSize;
  const qrPixelSize = size * cellSize;
  const totalSize = qrPixelSize + m * 2 * cellSize;
  const frameExtra = style.frameEnabled ? cellSize * 4 : 0;
  const canvasW = totalSize + frameExtra * 2;
  const canvasH = totalSize + frameExtra * 2 + (style.frameEnabled ? cellSize * 2.5 : 0);

  const fgId = `fg-grad-${Math.random().toString(36).slice(2, 8)}`;
  const bgId = `bg-grad-${Math.random().toString(36).slice(2, 8)}`;
  let defs = "";

  if (style.fgGradient !== "none") {
    if (style.fgGradient === "linear") {
      let x1 = "0%", y1 = "0%", x2 = "0%", y2 = "100%";
      if (style.fgGradientDir === "left-right") { x1 = "0%"; y1 = "0%"; x2 = "100%"; y2 = "0%"; }
      if (style.fgGradientDir === "diagonal") { x1 = "0%"; y1 = "0%"; x2 = "100%"; y2 = "100%"; }
      defs += `<linearGradient id="${fgId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">`;
      for (const s of style.fgGradientStops) defs += `<stop offset="${s.offset * 100}%" stop-color="${s.color}"/>`;
      defs += `</linearGradient>`;
    } else {
      defs += `<radialGradient id="${fgId}" cx="50%" cy="50%" r="50%">`;
      for (const s of style.fgGradientStops) defs += `<stop offset="${s.offset * 100}%" stop-color="${s.color}"/>`;
      defs += `</radialGradient>`;
    }
  }

  if (style.bgGradient !== "none") {
    if (style.bgGradient === "linear") {
      let x1 = "0%", y1 = "0%", x2 = "0%", y2 = "100%";
      if (style.bgGradientDir === "left-right") { x2 = "100%"; y2 = "0%"; }
      if (style.bgGradientDir === "diagonal") { x2 = "100%"; y2 = "100%"; }
      defs += `<linearGradient id="${bgId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">`;
      for (const s of style.bgGradientStops) defs += `<stop offset="${s.offset * 100}%" stop-color="${s.color}"/>`;
      defs += `</linearGradient>`;
    } else {
      defs += `<radialGradient id="${bgId}" cx="50%" cy="50%" r="50%">`;
      for (const s of style.bgGradientStops) defs += `<stop offset="${s.offset * 100}%" stop-color="${s.color}"/>`;
      defs += `</radialGradient>`;
    }
  }

  const fgFill = style.fgGradient !== "none" ? `url(#${fgId})` : style.fgColor;
  const bgFill = style.bgGradient !== "none" ? `url(#${bgId})` : style.bgColor;

  let bgRect = "";
  if (style.bgType === "color" || style.bgType === "glassmorphism") {
    const opacity = style.bgType === "glassmorphism" ? style.bgOpacity : 1;
    bgRect = `<rect width="${canvasW}" height="${canvasH}" fill="${bgFill}" opacity="${opacity}"/>`;
  } else {
    bgRect = `<rect width="${canvasW}" height="${canvasH}" fill="none"/>`;
  }

  const ox = frameExtra + m * cellSize;
  const oy = frameExtra + m * cellSize;

  const eyePositions = [
    { row: 0, col: 0 },
    { row: 0, col: size - 7 },
    { row: size - 7, col: 0 },
  ];

  let modulesSvg = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!modules[row][col]) continue;
      const isFinder = eyePositions.some(
        (p) => row >= p.row && row < p.row + 7 && col >= p.col && col < p.col + 7
      );
      if (isFinder) continue;

      const cx = ox + col * cellSize + cellSize / 2;
      const cy = oy + row * cellSize + cellSize / 2;
      const s = cellSize * 0.85;
      const d = dotPath(style.dotShape, cx, cy, s);
      modulesSvg += `<path d="${d}" fill="${fgFill}"/>`;
    }
  }

  let eyesSvg = "";
  for (const pos of eyePositions) {
    const ex = ox + pos.col * cellSize;
    const ey = oy + pos.row * cellSize;
    const outerSize = 7 * cellSize;
    const framePad = cellSize * 0.5;
    const innerSize = 3 * cellSize;
    const innerCx = ex + outerSize / 2;
    const innerCy = ey + outerSize / 2;

    const framePath = eyeFramePath(style.eyeFrameShape, ex + framePad / 2, ey + framePad / 2, outerSize - framePad);
    const holePath = eyeFramePath("square", ex + cellSize, ey + cellSize, 5 * cellSize);
    const innerPath = eyeInnerPath(style.eyeInnerShape, innerCx, innerCy, innerSize);

    eyesSvg += `<path d="${framePath}" fill="${style.eyeFrameColor}"/>`;
    eyesSvg += `<path d="${holePath}" fill="${bgTypeToFill(style.bgType, bgFill)}"/>`;
    eyesSvg += `<path d="${innerPath}" fill="${style.eyeInnerColor}"/>`;
  }

  let logoSvg = "";
  if (style.logoDataUrl) {
    const logoPx = qrPixelSize * style.logoSize;
    const logoX = ox + (qrPixelSize - logoPx) / 2;
    const logoY = oy + (qrPixelSize - logoPx) / 2;
    const logoPad = cellSize * style.logoMargin;
    const bgX = logoX - logoPad;
    const bgY = logoY - logoPad;
    const bgSize = logoPx + logoPad * 2;
    const bgRadius = cellSize * 1.5;
    logoSvg += `<rect x="${bgX}" y="${bgY}" width="${bgSize}" height="${bgSize}" rx="${bgRadius}" fill="${bgTypeToFill(style.bgType, bgFill)}"/>`;
    logoSvg += `<image href="${style.logoDataUrl}" x="${logoX}" y="${logoY}" width="${logoPx}" height="${logoPx}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  let frameSvg = "";
  if (style.frameEnabled) {
    const fPad = cellSize * 1.5;
    const fX = frameExtra - fPad;
    const fY = frameExtra - fPad;
    const fW = totalSize + fPad * 2;
    const fH = totalSize + fPad * 2 + cellSize * 2.5;
    frameSvg = `<rect x="${fX}" y="${fY}" width="${fW}" height="${fH}" rx="${style.frameRadius}" fill="${style.frameBgColor}" stroke="${style.frameColor}" stroke-width="${cellSize * 0.3}"/>`;
    if (style.frameText) {
      const textY = canvasH - cellSize * 0.5;
      frameSvg += `<text x="${canvasW / 2}" y="${textY}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${cellSize * 2}" font-weight="700" fill="${style.frameColor}">${escapeXml(style.frameText)}</text>`;
    }
  }

  let glassSvg = "";
  if (style.bgType === "glassmorphism") {
    glassSvg = `<rect width="${canvasW}" height="${canvasH}" fill="${style.bgColor}" opacity="0.15"/>`;
    glassSvg += `<rect width="${canvasW}" height="${canvasH}" rx="0" fill="url(#${bgId || fgId})" opacity="0.05"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
<defs>${defs}</defs>
${bgRect}
${glassSvg}
${frameSvg}
${modulesSvg}
${eyesSvg}
${logoSvg}
</svg>`;

  return svg;
}

function bgTypeToFill(bgType: string, bgFill: string): string {
  if (bgType === "transparent") return "transparent";
  return bgFill;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function exportQr(svgString: string, scale: number, format: "png" | "webp" = "png"): Promise<Blob> {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  URL.revokeObjectURL(url);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), `image/${format}`, 1.0);
  });
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function linearize(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function getContrastRatio(fg: string, bg: string): number {
  const [r1, g1, b1] = hexToRgb(fg).map(linearize);
  const [r2, g2, b2] = hexToRgb(bg).map(linearize);
  const l1 = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
  const l2 = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
