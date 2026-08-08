import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus, Trash2, Crosshair, ZoomIn, ZoomOut, Move, Sun, Grid3X3, Pipette,
} from "lucide-react";
import { evalExpression, tryEval } from "../lib/calc-engine";
import { parseGraphExpr } from "../lib/calc-solve";

interface GraphFunction {
  id: number;
  expr: string;
  color: string;
}

const PALETTE = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#22d3ee", "#fb7185", "#a3e635"];

interface View {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function niceStep(range: number, targetTicks: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return nice * mag;
}

const snippets: { label: string; value: string }[] = [
  { label: "x²", value: "x^2" },
  { label: "sin", value: "sin(" },
  { label: "cos", value: "cos(" },
  { label: "tan", value: "tan(" },
  { label: "√", value: "sqrt(" },
  { label: "ln", value: "ln(" },
  { label: "log", value: "log(" },
  { label: "|x|", value: "abs(" },
  { label: "eˣ", value: "e^x" },
  { label: "π", value: "pi" },
  { label: "e", value: "e" },
  { label: "x", value: "x" },
];

export default function GraphCalculator() {
  const [functions, setFunctions] = useState<GraphFunction[]>([
    { id: 1, expr: "x^2", color: PALETTE[0] },
    { id: 2, expr: "sin(x)", color: PALETTE[1] },
  ]);
  const [view, setView] = useState<View>({ xMin: -10, xMax: 10, yMin: -6, yMax: 6 });
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const dragRef = useRef<{ x: number; y: number; view: View } | null>(null);
  const nextId = useRef(3);
  const [hover, setHover] = useState<{ px: number; py: number; x: number; y: number } | null>(null);

  const addFunction = () => {
    setFunctions((fns) => [...fns, { id: nextId.current++, expr: "", color: PALETTE[functions.length % PALETTE.length] }]);
  };

  const removeFunction = (id: number) => {
    setFunctions((fns) => fns.filter((f) => f.id !== id));
  };

  const updateFunction = (id: number, patch: Partial<GraphFunction>) => {
    setFunctions((fns) => fns.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const errors = useMemo(() => {
    const map: Record<number, string> = {};
    for (const fn of functions) {
      if (!fn.expr.trim()) continue;
      const parsed = parseGraphExpr(fn.expr);
      const r = tryEval(parsed, { variables: { x: 0 }, degrees: false });
      if (!r.ok) map[fn.id] = r.error;
    }
    return map;
  }, [functions]);

  // Resize observer
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      sizeRef.current = { w: rect.width, h: rect.height };
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

  // Native wheel listener (React attaches wheel as passive, blocking preventDefault)
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
    const { w, h } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

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

    // Axes
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

    // Tick labels
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

    // Functions
    const samples = Math.max(200, Math.min(1200, w * 2));
    for (const fn of functions) {
      if (!fn.expr.trim() || errors[fn.id]) continue;
      const parsed = parseGraphExpr(fn.expr);
      const color = fn.color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let penDown = false;
      let prevY: number | null = null;
      for (let i = 0; i <= samples; i++) {
        const x = xMin + (i / samples) * (xMax - xMin);
        let y: number;
        try {
          y = evalExpression(parsed, { variables: { x }, degrees: false });
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
        if (jump) {
          penDown = false;
        }
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
    }

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
  }, [view, functions, showGrid, showLabels, hover, errors]);

  useEffect(() => {
    draw();
  }, [draw]);

  const resetView = () => {
    setView({ xMin: -10, xMax: 10, yMin: -6, yMax: 6 });
  };

  const zoom = (factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const wpx = sizeRef.current.w || 400;
      const hpx = sizeRef.current.h || 300;
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

  const fitView = () => {
    setView((v) => {
      let yMin = Infinity;
      let yMax = -Infinity;
      for (const fn of functions) {
        if (!fn.expr.trim() || errors[fn.id]) continue;
        const parsed = parseGraphExpr(fn.expr);
        for (let i = 0; i <= 400; i++) {
          const x = v.xMin + (i / 400) * (v.xMax - v.xMin);
          try {
            const y = evalExpression(parsed, { variables: { x }, degrees: false });
            if (Number.isFinite(y) && Math.abs(y) < 1e7) {
              if (y < yMin) yMin = y;
              if (y > yMax) yMax = y;
            }
          } catch { /* skip */ }
        }
      }
      if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return v;
      const pad = (yMax - yMin) * 0.15 || 1;
      return { ...v, yMin: yMin - pad, yMax: yMax + pad };
    });
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

  const toWorldX = (px: number) => {
    const { w } = sizeRef.current;
    return view.xMin + (px / (w || 1)) * (view.xMax - view.xMin);
  };
  const toWorldY = (py: number) => {
    const { h } = sizeRef.current;
    return view.yMin + (1 - py / (h || 1)) * (view.yMax - view.yMin);
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
      const { w, h } = sizeRef.current;
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

  const appendSnippet = (id: number, value: string) => {
    const fn = functions.find((f) => f.id === id);
    if (!fn) return;
    updateFunction(id, { expr: fn.expr + value });
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Graph Calculator</h2>
        <div className="flex items-center gap-1.5">
          <ToolbarBtn onClick={resetView} title="Reset view"><Crosshair className="w-3.5 h-3.5" /> Reset</ToolbarBtn>
          <ToolbarBtn onClick={fitView} title="Fit functions"><Move className="w-3.5 h-3.5" /> Fit</ToolbarBtn>
          <ToolbarBtn onClick={() => zoom(1 / 1.2)} title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => zoom(1.2)} title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => setShowGrid((s) => !s)} active={showGrid} title="Toggle grid"><Grid3X3 className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => setShowLabels((s) => !s)} active={showLabels} title="Toggle labels"><Sun className="w-3.5 h-3.5" /></ToolbarBtn>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: functions */}
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-white/30">Functions</span>
            <button
              onClick={addFunction}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs hover:bg-blue-500/30 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          {functions.map((fn, i) => (
            <motion.div
              key={fn.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-surface/50 backdrop-blur-xl p-2.5"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateFunction(fn.id, { color: PALETTE[(PALETTE.indexOf(fn.color) + 1) % PALETTE.length] })}
                  className="w-5 h-5 rounded-full shrink-0 border border-white/20 flex items-center justify-center hover:scale-110 transition-transform"
                  style={{ backgroundColor: fn.color }}
                  title="Change color"
                >
                  <Pipette className="w-2.5 h-2.5 text-white/80" />
                </button>
                <span className="text-white/40 text-xs font-mono w-6 shrink-0 text-center">f{i + 1}</span>
                <div className="relative flex-1 min-w-0">
                  <input
                    value={fn.expr}
                    onChange={(e) => updateFunction(fn.id, { expr: e.target.value })}
                    placeholder="e.g. x^2 - 3"
                    spellCheck={false}
                    className="w-full bg-white/5 border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-white/90 focus:outline-none focus:border-blue-500/50 placeholder:text-white/20"
                  />
                  {errors[fn.id] && (
                    <div className="absolute -bottom-1.5 left-0 right-0 text-[9px] text-red-400 truncate">{errors[fn.id]}</div>
                  )}
                </div>
                <button
                  onClick={() => removeFunction(fn.id)}
                  disabled={functions.length <= 1}
                  className="text-white/30 hover:text-red-400 disabled:opacity-20 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-1 flex-wrap mt-2">
                {snippets.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => appendSnippet(fn.id, s.value)}
                    className="px-1.5 py-0.5 rounded bg-white/5 border border-border text-[10px] text-white/50 hover:bg-white/10 hover:text-white transition-colors font-mono"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </motion.div>
          ))}

          <div className="rounded-xl border border-border bg-surface/50 backdrop-blur-xl p-3 text-[11px] text-white/40 leading-relaxed">
            <span className="text-white/70 font-medium">Tips</span>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              <li>Use <span className="font-mono text-white/60">x</span> as the variable</li>
              <li>Drag to pan, scroll to zoom</li>
              <li>Hover to trace coordinates</li>
              <li>Operators: <span className="font-mono text-white/60">+ − * / ^</span></li>
              <li>Functions: <span className="font-mono text-white/60">sin cos tan ln log sqrt abs</span></li>
            </ul>
          </div>
        </div>

        {/* Right: canvas */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div ref={wrapRef} className="flex-1 relative rounded-2xl border border-border bg-[#0f0f14] overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
              className="w-full h-full block cursor-grab active:cursor-grabbing"
            />
            {hover && (
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 border border-white/10 text-[10px] font-mono text-white/80">
                x = {fmt(hover.x)}, y = {fmt(hover.y)}
              </div>
            )}
          </div>
        </div>
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

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  if (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-4) return n.toExponential(2);
  return parseFloat(n.toPrecision(6)).toString();
}

function formatTick(n: number): string {
  if (Math.abs(n) >= 1e6 || Math.abs(n) < 1e-4) return n.toExponential(0);
  return parseFloat(n.toPrecision(6)).toString();
}
