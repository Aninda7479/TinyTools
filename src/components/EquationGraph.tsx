import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ZoomIn, ZoomOut, Sun, Grid3X3, RotateCcw } from "lucide-react";
import { splitEquation, detectVariables, findRoots, fmtCoeff, parseGraphExpr } from "../lib/calc-solve";
import { evalExpression } from "../lib/calc-engine";

interface View {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

const CURVE = "#60a5fa";

function niceStep(range: number, targetTicks: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return nice * mag;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  if (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-4) return n.toExponential(2);
  return parseFloat(n.toPrecision(6)).toString();
}

function formatTick(n: number): string {
  if (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-4) return n.toExponential(0);
  return parseFloat(n.toPrecision(6)).toString();
}

interface GraphAnalysis {
  variable: string;
  f: (x: number) => number;
  roots: number[];
  label: string;
}

export default function EquationGraph({ equation }: { equation: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{ x: number; y: number; view: View } | null>(null);
  const [view, setView] = useState<View>({ xMin: -10, xMax: 10, yMin: -6, yMax: 6 });
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [hover, setHover] = useState<{ px: number; py: number; x: number; y: number } | null>(null);

  const analysis = useMemo<GraphAnalysis | { error: string }>(() => {
    if (!equation.trim()) return { error: "Enter an equation or function to graph." };
    const expr = parseGraphExpr(equation);
    const { lhs, rhs } = splitEquation(equation);
    const vars = detectVariables([expr]);
    let variable = vars[0] || "x";

    if (vars.length > 1) {
      return { error: `Multiple variables found: ${vars.join(", ")}. Use a single variable like x.` };
    }

    try {
      const f = (x: number) => evalExpression(expr, { variables: { [variable]: x } });
      const testVal = f(0);
      if (typeof testVal !== "number" || Number.isNaN(testVal)) {
        return { error: "Could not evaluate equation." };
      }
      const roots = findRoots(f);

      let label = equation.trim();
      const lClean = lhs.trim().toLowerCase();
      if (lClean === "y" || /^[a-z]\([a-z]\)$/.test(lClean)) {
        label = `y = ${rhs.trim()}`;
      } else if (!equation.includes("=")) {
        label = `y = ${equation.trim()}`;
      }

      return { variable, f, roots, label };
    } catch (e: any) {
      return { error: e?.message || "Could not parse equation." };
    }
  }, [equation]);

  // Auto-fit view to the curve + roots when the equation changes
  useEffect(() => {
    if ("error" in analysis) return;
    const { f, roots } = analysis;
    let xs: [number, number] = [-10, 10];
    if (roots.length > 0) {
      const lo = Math.min(...roots);
      const hi = Math.max(...roots);
      const span = Math.max(hi - lo, 4);
      xs = [lo - span * 0.15, hi + span * 0.15];
    }
    const xMin = xs[0];
    const xMax = xs[1];
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i <= 400; i++) {
      const x = xMin + (i / 400) * (xMax - xMin);
      try {
        const y = f(x);
        if (Number.isFinite(y) && Math.abs(y) < 1e7) {
          if (y < yMin) yMin = y;
          if (y > yMax) yMax = y;
        }
      } catch { /* skip */ }
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = -6;
      yMax = 6;
    }
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
    const pad = (yMax - yMin) * 0.15 || 1;
    setView({ xMin, xMax, yMin: yMin - pad, yMax: yMax + pad });
  }, [analysis]);

  // Resize observer
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ w: rect.width, h: rect.height });
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Native wheel listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, cx, cy);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = size;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if ("error" in analysis) return;
    const { f, roots, variable, label } = analysis;
    const { xMin, xMax, yMin, yMax } = view;
    const xToPx = (x: number) => ((x - xMin) / (xMax - xMin)) * w;
    const yToPx = (y: number) => h - ((y - yMin) / (yMax - yMin)) * h;
    const xStep = niceStep(xMax - xMin, Math.max(6, w / 80));
    const yStep = niceStep(yMax - yMin, Math.max(6, h / 50));

    if (showGrid) {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let gx = Math.ceil(xMin / xStep) * xStep; gx <= xMax; gx += xStep) {
        ctx.beginPath();
        ctx.moveTo(xToPx(gx), 0);
        ctx.lineTo(xToPx(gx), h);
        ctx.stroke();
      }
      for (let gy = Math.ceil(yMin / yStep) * yStep; gy <= yMax; gy += yStep) {
        ctx.beginPath();
        ctx.moveTo(0, yToPx(gy));
        ctx.lineTo(w, yToPx(gy));
        ctx.stroke();
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    const x0 = xToPx(0);
    const y0 = yToPx(0);
    if (xMin <= 0 && xMax >= 0) {
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, h);
      ctx.stroke();
    }
    if (yMin <= 0 && yMax >= 0) {
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(w, y0);
      ctx.stroke();
    }

    if (showLabels) {
      ctx.font = "10px -apple-system, 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let gx = Math.ceil(xMin / xStep) * xStep; gx <= xMax + 1e-9; gx += xStep) {
        if (Math.abs(gx) < xStep * 0.25) continue;
        ctx.fillText(formatTick(gx), xToPx(gx), y0 + 4);
      }
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let gy = Math.ceil(yMin / yStep) * yStep; gy <= yMax + 1e-9; gy += yStep) {
        if (Math.abs(gy) < yStep * 0.25) continue;
        ctx.fillText(formatTick(gy), x0 - 4, yToPx(gy));
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("0", x0 - 12, y0 + 10);
    }

    // Curve: f(x) = LHS − RHS
    const samples = Math.max(200, Math.min(1200, w * 2));
    ctx.strokeStyle = CURVE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let penDown = false;
    let prevY: number | null = null;
    for (let i = 0; i <= samples; i++) {
      const x = xMin + (i / samples) * (xMax - xMin);
      let y: number;
      try {
        y = f(x);
      } catch {
        y = NaN;
      }
      if (!Number.isFinite(y)) {
        penDown = false;
        prevY = null;
        continue;
      }
      const jump = prevY !== null && Math.abs(y - prevY) > (yMax - yMin) * 0.5;
      prevY = y;
      if (jump) penDown = false;
      const px = xToPx(x);
      const py = yToPx(y);
      if (!penDown) {
        ctx.moveTo(px, py);
        penDown = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // Root markers
    for (const r of roots) {
      if (r < xMin || r > xMax) continue;
      const px = xToPx(r);
      const py = yToPx(0);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fb7185";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251,113,133,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(251,113,133,0.95)";
      ctx.font = "bold 11px -apple-system, 'Segoe UI', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${variable} = ${fmt(r)}`, px + 10, py - 8);
    }

    // Legend
    ctx.font = "11px -apple-system, 'Segoe UI', sans-serif";
    const legend = `f(${variable}) = ${label}`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(legend, 10, 10);

    // Hover crosshair
    if (hover) {
      const { px, py, x, y } = hover;
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "10px -apple-system, 'Segoe UI', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const box = `(${fmt(x)}, ${fmt(y)})`;
      const bw = ctx.measureText(box).width + 10;
      const bx = Math.min(w - bw - 4, Math.max(4, px + 10));
      const by = Math.min(h - 2, Math.max(16, py - 8));
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(bx, by - 14, bw, 18, 4);
      } else {
        ctx.rect(bx, by - 14, bw, 18);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(box, bx + 5, by - 1);
    }
  }, [view, analysis, showGrid, showLabels, hover, size]);

  useEffect(() => {
    draw();
  }, [draw]);

  const zoom = (factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const wpx = size.w || 400;
      const hpx = size.h || 300;
      const fx = cx !== undefined ? cx / wpx : 0.5;
      const fy = cy !== undefined ? cy / hpx : 0.5;
      const nx = v.xMin + fx * (v.xMax - v.xMin);
      const ny = v.yMin + (1 - fy) * (v.yMax - v.yMin);
      const dw = (v.xMax - v.xMin) * factor;
      const dh = (v.yMax - v.yMin) * factor;
      return {
        xMin: nx - fx * dw,
        xMax: nx + (1 - fx) * dw,
        yMin: ny - (1 - fy) * dh,
        yMax: ny + fy * dh,
      };
    });
  };

  const refit = () => {
    if ("error" in analysis) return;
    const { f, roots } = analysis;
    let xs: [number, number] = [-10, 10];
    if (roots.length > 0) {
      const lo = Math.min(...roots);
      const hi = Math.max(...roots);
      const span = Math.max(hi - lo, 4);
      xs = [lo - span * 0.15, hi + span * 0.15];
    }
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i <= 400; i++) {
      const x = xs[0] + (i / 400) * (xs[1] - xs[0]);
      try {
        const y = f(x);
        if (Number.isFinite(y) && Math.abs(y) < 1e7) {
          if (y < yMin) yMin = y;
          if (y > yMax) yMax = y;
        }
      } catch { /* skip */ }
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = -6;
      yMax = 6;
    }
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
    const pad = (yMax - yMin) * 0.15 || 1;
    setView({ xMin: xs[0], xMax: xs[1], yMin: yMin - pad, yMax: yMax + pad });
  };

  const toWorldX = (px: number) => {
    const { w } = size;
    return view.xMin + (px / (w || 1)) * (view.xMax - view.xMin);
  };
  const toWorldY = (py: number) => {
    const { h } = size;
    return view.yMin + (1 - py / (h || 1)) * (view.yMax - view.yMin);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, view };
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setHover({ px, py, x: toWorldX(px), y: toWorldY(py) });
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      const { view: startView } = dragRef.current;
      const { w, h } = size;
      const xRange = startView.xMax - startView.xMin;
      const yRange = startView.yMax - startView.yMin;
      const nx = startView.xMin - (dx / (w || 1)) * xRange;
      const ny = startView.yMin + (dy / (h || 1)) * yRange;
      setView({ xMin: nx, xMax: nx + xRange, yMin: ny, yMax: ny + yRange });
    } else {
      setHover({ px, py, x: toWorldX(px), y: toWorldY(py) });
    }
  };

  const onMouseUp = () => {
    dragRef.current = null;
  };

  const onMouseLeave = () => {
    dragRef.current = null;
    setHover(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <ZoomIn className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">Graph of f(x) = LHS − RHS</span>
        </div>
        <div className="flex items-center gap-1.5 sm:ml-auto">
          <ToolbarBtn onClick={() => zoom(1 / 1.2)} title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => zoom(1.2)} title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={refit} title="Reset view"><RotateCcw className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => setShowGrid((s) => !s)} active={showGrid} title="Toggle grid"><Grid3X3 className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => setShowLabels((s) => !s)} active={showLabels} title="Toggle labels"><Sun className="w-3.5 h-3.5" /></ToolbarBtn>
        </div>
      </div>

      {!("error" in analysis) && analysis.roots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {analysis.roots.map((r, i) => (
            <div key={i} className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-2.5 py-1 text-xs font-mono text-rose-300">
              {analysis.variable} = {fmtCoeff(r)}
            </div>
          ))}
        </div>
      )}

      <div ref={wrapRef} className="relative h-[420px] rounded-2xl border border-border bg-[#0f0f14] overflow-hidden">
        {"error" in analysis ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-amber-400 px-6 text-center">{analysis.error}</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            className="w-full h-full block cursor-grab active:cursor-grabbing"
          />
        )}
        {hover && !("error" in analysis) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 border border-white/10 text-[10px] font-mono text-white/80"
          >
            x = {fmt(hover.x)}, y = {fmt(hover.y)}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({ onClick, title, active, children }: { onClick: () => void; title?: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
        active
          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
          : "bg-white/5 text-white/50 border-border hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
