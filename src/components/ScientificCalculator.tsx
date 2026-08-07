import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw, History, Copy, Check,
} from "lucide-react";
import { tryEval, formatNumber } from "../lib/calc-engine";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

interface SciKey {
  label: string;
  insert?: string;
  action?: "backspace" | "clear" | "evaluate" | "negate" | "toggle-angle" | "sqrt" | "square" | "cube" | "power" | "inv" | "fact" | "abs" | "tenpow" | "exp" | "percent";
  sub?: string;
  className?: string;
  wide?: boolean;
}

const sciKeys: SciKey[] = [
  { label: "sin", insert: "sin(" },
  { label: "cos", insert: "cos(" },
  { label: "tan", insert: "tan(" },
  { label: "π", insert: "pi" },
  { label: "asin", insert: "asin(", sub: "sin⁻¹" },
  { label: "acos", insert: "acos(", sub: "cos⁻¹" },
  { label: "atan", insert: "atan(", sub: "tan⁻¹" },
  { label: "e", insert: "e" },
  { label: "ln", insert: "ln(" },
  { label: "log", insert: "log(" },
  { label: "log₂", insert: "log2(" },
  { label: "√", action: "sqrt", sub: "√x" },
  { label: "sinh", insert: "sinh(" },
  { label: "cosh", insert: "cosh(" },
  { label: "tanh", insert: "tanh(" },
  { label: "x²", action: "square" },
  { label: "1/x", action: "inv", sub: "x⁻¹" },
  { label: "n!", action: "fact", sub: "x!" },
  { label: "|x|", action: "abs" },
  { label: "x³", action: "cube" },
  { label: "10ˣ", action: "tenpow" },
  { label: "eˣ", action: "exp" },
  { label: "xʸ", action: "power" },
  { label: "xʸ√", insert: "^(1/(", sub: "ʸ√x" },
];

const keypadRows: SciKey[][] = [
  [
    { label: "AC", action: "clear", className: "text-red-400" },
    { label: "(", insert: "(" },
    { label: ")", insert: ")" },
    { label: "⌫", action: "backspace", className: "text-amber-400" },
  ],
  [
    { label: "7", insert: "7" },
    { label: "8", insert: "8" },
    { label: "9", insert: "9" },
    { label: "÷", insert: "/", className: "text-blue-400" },
  ],
  [
    { label: "4", insert: "4" },
    { label: "5", insert: "5" },
    { label: "6", insert: "6" },
    { label: "×", insert: "*", className: "text-blue-400" },
  ],
  [
    { label: "1", insert: "1" },
    { label: "2", insert: "2" },
    { label: "3", insert: "3" },
    { label: "−", insert: "-", className: "text-blue-400" },
  ],
  [
    { label: "±", action: "negate", sub: "+/-" },
    { label: "0", insert: "0", wide: true },
    { label: ".", insert: "." },
    { label: "=", action: "evaluate", className: "bg-blue-500 text-white hover:bg-blue-600 border-transparent" },
  ],
];

interface HistoryEntry {
  expr: string;
  result: string;
}

const isValueEnd = (s: string) => /[0-9)!.eipIx]/.test(s[s.length - 1] || "");

export default function ScientificCalculator() {
  const [expr, setExpr] = useState("");
  const [degrees, setDegrees] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [justEvaluated, setJustEvaluated] = useState(false);

  const result = useMemo(() => {
    if (!expr.trim()) return { ok: true as const, value: 0, raw: "" };
    return tryEval(expr, { degrees });
  }, [expr, degrees]);

  const displayResult = result.ok ? formatNumber(result.value) : null;
  const displayError = result.ok ? null : result.error;

  const insert = useCallback((text: string) => {
    setJustEvaluated(false);
    setExpr((e) => {
      let base = e;
      if (justEvaluated && isValueEnd(e)) {
        base = result.ok ? formatNumber(result.value) : e;
      }
      return base + text;
    });
  }, [justEvaluated, result]);

  const handleKey = (key: SciKey) => {
    if (key.action === "clear") {
      setExpr("");
      setJustEvaluated(false);
      return;
    }
    if (key.action === "backspace") {
      setJustEvaluated(false);
      setExpr((e) => {
        if (!e) return e;
        const ops = ["sin(", "cos(", "tan(", "asin(", "acos(", "atan(", "sinh(", "cosh(", "tanh(", "log2(", "ln(", "log("];
        const match = ops.find((o) => e.endsWith(o));
        if (match) return e.slice(0, -match.length);
        return e.slice(0, -1);
      });
      return;
    }
    if (key.action === "evaluate") {
      if (!result.ok) return;
      const formatted = formatNumber(result.value);
      if (expr.trim()) {
        setHistory((h) => [{ expr: expr.replace(/\s+/g, " "), result: formatted }, ...h].slice(0, 30));
      }
      setExpr(formatted);
      setJustEvaluated(true);
      return;
    }
    if (key.action === "negate") {
      setJustEvaluated(false);
      setExpr((e) => {
        if (!e) return "-";
        if (e.startsWith("-(") && e.endsWith(")")) return e.slice(2, -1);
        return "-(" + e + ")";
      });
      return;
    }
    if (key.action === "toggle-angle") {
      setDegrees((d) => !d);
      return;
    }
    if (key.action === "sqrt") {
      insert("sqrt(");
      return;
    }
    if (key.action === "abs") {
      insert("|");
      return;
    }
    if (key.action === "fact") {
      insert("!");
      return;
    }
    if (key.action === "square") {
      insert("^2");
      return;
    }
    if (key.action === "cube") {
      insert("^3");
      return;
    }
    if (key.action === "inv") {
      insert("^(-1)");
      return;
    }
    if (key.action === "tenpow") {
      insert("10^(");
      return;
    }
    if (key.action === "exp") {
      insert("e^(");
      return;
    }
    if (key.action === "power") {
      insert("^(");
      return;
    }
    if (key.action === "percent") {
      insert("%");
      return;
    }
    if (key.insert !== undefined) {
      insert(key.insert);
    }
  };

  const handleCopyResult = async () => {
    if (!displayResult) return;
    try {
      await navigator.clipboard.writeText(displayResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const recall = (entry: HistoryEntry) => {
    setExpr(entry.expr);
    setJustEvaluated(false);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Scientific Calculator</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDegrees((d) => !d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              degrees ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 text-white/50 border-border"
            }`}
          >
            {degrees ? "DEG" : "RAD"}
          </button>
          <button
            onClick={handleCopyResult}
            disabled={!displayResult}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border bg-white/5 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Scientific functions */}
        <div className="w-[300px] flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-1.5">
            {sciKeys.map((k) => (
              <button
                key={k.label}
                onClick={() => handleKey(k)}
                className="flex flex-col items-center justify-center h-12 rounded-lg bg-white/5 border border-border text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <span className="leading-none">{k.label}</span>
                {k.sub && <span className="text-[8px] text-white/30 mt-0.5 leading-none">{k.sub}</span>}
              </button>
            ))}
          </div>

          {/* History */}
          <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-surface/50 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/30">
                <History className="w-3 h-3" /> History
              </span>
              {history.length > 0 && (
                <button onClick={() => setHistory([])} className="text-white/30 hover:text-white/60">
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {history.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-6">No calculations yet</p>
              ) : (
                <AnimatePresence initial={false}>
                  {history.map((h, i) => (
                    <motion.button
                      key={`${h.expr}-${i}`}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => recall(h)}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="text-[10px] text-white/35 truncate font-mono">{h.expr}</div>
                      <div className="text-sm font-medium text-white/85 font-mono">= {h.result}</div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>

        {/* Right: Display + keypad */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Display */}
          <div className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl px-5 py-4 flex flex-col items-end justify-end min-h-[110px]">
            <div className="text-sm text-white/40 font-mono min-h-[20px] break-all text-right max-w-full">
              {expr || "0"}
            </div>
            <div className="flex items-center gap-2 mt-1 max-w-full">
              <AnimatePresence mode="wait">
                {displayError ? (
                  <motion.span key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-2xl text-red-400 font-mono">
                    {displayError}
                  </motion.span>
                ) : (
                  <motion.span
                    key={displayResult}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={spring}
                    className="text-3xl font-semibold text-white font-mono break-all text-right"
                  >
                    {displayResult ?? "0"}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Keypad */}
          <div className="flex-1 grid grid-rows-5 gap-1.5">
            {keypadRows.map((row, ri) => (
              <div key={ri} className="grid grid-cols-4 gap-1.5">
                {row.map((k) => (
                  <KeyButton key={k.label} k={k} onClick={handleKey} wide={k.wide} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyButton({ k, onClick, wide }: { k: SciKey; onClick: (k: SciKey) => void; wide?: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      transition={spring}
      onClick={() => onClick(k)}
      className={`flex flex-col items-center justify-center rounded-xl bg-white/5 border border-border text-base font-medium text-white/85 hover:bg-white/10 transition-colors ${k.className || ""} ${wide ? "col-span-2" : ""}`}
    >
      <span className={k.label === "AC" ? "text-sm" : "text-base"}>{k.label}</span>
      {k.sub && <span className="text-[8px] text-white/30 leading-none mt-0.5">{k.sub}</span>}
    </motion.button>
  );
}
