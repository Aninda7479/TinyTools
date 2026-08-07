import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock, ArrowLeftRight, Plus, Minus, CalendarClock, Timer, ArrowRight } from "lucide-react";
import { convertValue, formatUnitValue, unitCategories } from "../lib/calc-units";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

type Mode = "duration" | "addsub" | "convert";

const timeCategory = unitCategories.find((c) => c.id === "time")!;

function clampInt(s: string, max: number): number {
  const v = parseInt(s, 10);
  if (Number.isNaN(v)) return 0;
  return Math.min(Math.max(v, 0), max);
}

function parseTime(h: string, m: string, s: string): { seconds: number; valid: boolean } {
  const H = clampInt(h, 23);
  const M = clampInt(m, 59);
  const S = clampInt(s, 59);
  if (h.trim() === "" || m.trim() === "" || s.trim() === "") return { seconds: 0, valid: false };
  return { seconds: H * 3600 + M * 60 + S, valid: true };
}

function breakdown(totalSeconds: number) {
  const total = Math.max(0, Math.round(totalSeconds));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ms = total * 1000;
  return { d, h, m, s, ms, total, totalMinutes: total / 60, totalHours: total / 3600, totalDays: total / 86400 };
}

function formatHMS(d: number, h: number, m: number, s: number): string {
  return `${d > 0 ? `${d}d ` : ""}${h}h ${m}m ${s}s`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function TimeCalculator() {
  const [mode, setMode] = useState<Mode>("duration");

  // Duration mode
  const [startH, setStartH] = useState("09");
  const [startM, setStartM] = useState("00");
  const [startS, setStartS] = useState("00");
  const [endH, setEndH] = useState("17");
  const [endM, setEndM] = useState("30");
  const [endS, setEndS] = useState("00");

  // Add/Subtract mode
  const [baseH, setBaseH] = useState("10");
  const [baseM, setBaseM] = useState("00");
  const [baseS, setBaseS] = useState("00");
  const [operation, setOperation] = useState<"add" | "subtract">("add");
  const [amtH, setAmtH] = useState("2");
  const [amtM, setAmtM] = useState("30");
  const [amtS, setAmtS] = useState("0");

  // Convert mode
  const [value, setValue] = useState("1");
  const [fromUnit, setFromUnit] = useState("h");
  const [toUnit, setToUnit] = useState("min");

  const durationResult = useMemo(() => {
    const start = parseTime(startH, startM, startS);
    const end = parseTime(endH, endM, endS);
    if (!start.valid || !end.valid) return null;
    let diff = end.seconds - start.seconds;
    if (diff < 0) diff += 86400;
    return breakdown(diff);
  }, [startH, startM, startS, endH, endM, endS]);

  const addSubResult = useMemo(() => {
    const base = parseTime(baseH, baseM, baseS);
    if (!base.valid) return null;
    const amount = amtH.trim() !== "" ? clampInt(amtH, 9999) * 3600 + clampInt(amtM, 59) * 60 + clampInt(amtS, 59) : 0;
    const baseSeconds = base.seconds;
    let resultSeconds = operation === "add" ? baseSeconds + amount : baseSeconds - amount;
    let daysWrapped = 0;
    while (resultSeconds >= 86400) { resultSeconds -= 86400; daysWrapped++; }
    while (resultSeconds < 0) { resultSeconds += 86400; daysWrapped--; }
    const hh = Math.floor(resultSeconds / 3600);
    const mm = Math.floor((resultSeconds % 3600) / 60);
    const ss = resultSeconds % 60;
    return { hh, mm, ss, daysWrapped, resultSeconds, total: operation === "add" ? baseSeconds + amount : baseSeconds - amount };
  }, [baseH, baseM, baseS, amtH, amtM, amtS, operation]);

  const convertResult = useMemo(() => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return null;
    return convertValue(timeCategory, num, fromUnit, toUnit);
  }, [value, fromUnit, toUnit]);

  const allConversions = useMemo(() => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return [];
    return timeCategory.units.map((u) => ({ unit: u, result: convertValue(timeCategory, num, fromUnit, u.id) }));
  }, [value, fromUnit]);

  const modeTabs: { id: Mode; label: string; icon: typeof Clock }[] = [
    { id: "duration", label: "Duration", icon: Timer },
    { id: "addsub", label: "Add / Subtract", icon: ArrowLeftRight },
    { id: "convert", label: "Convert", icon: CalendarClock },
  ];

  return (
    <div className="flex flex-col h-full gap-4">
      <h2 className="text-xl font-semibold">Time Calculator</h2>

      <div className="flex gap-1">
        {modeTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                mode === t.id ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "border-border text-white/50 hover:text-white/80"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {mode === "duration" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Panel title="Start Time">
                <TimeRow label="Start" h={startH} m={startM} s={startS} onH={setStartH} onM={setStartM} onS={setStartS} />
              </Panel>
              <Panel title="End Time">
                <TimeRow label="End" h={endH} m={endM} s={endS} onH={setEndH} onM={setEndM} onS={setEndS} />
              </Panel>
            </div>

            {durationResult ? (
              <>
                <Panel title="Duration Result">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-white/50">{pad2(clampInt(startH, 23))}:{pad2(clampInt(startM, 59))}:{pad2(clampInt(startS, 59))}</span>
                    <ArrowRight className="w-4 h-4 text-white/30" />
                    <span className="text-sm text-white/50">{pad2(clampInt(endH, 23))}:{pad2(clampInt(endM, 59))}:{pad2(clampInt(endS, 59))}</span>
                    <ArrowRight className="w-4 h-4 text-white/30" />
                    <span className="text-2xl font-semibold text-white font-mono">
                      {formatHMS(durationResult.d, durationResult.h, durationResult.m, durationResult.s)}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <Stat label="Days" value={durationResult.d} />
                    <Stat label="Hours" value={durationResult.h} />
                    <Stat label="Minutes" value={durationResult.m} />
                    <Stat label="Seconds" value={durationResult.s} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Stat label="Total seconds" value={formatNumber(durationResult.total)} />
                    <Stat label="Total milliseconds" value={formatNumber(durationResult.ms)} />
                    <Stat label="Total minutes" value={formatNumber(durationResult.totalMinutes)} />
                    <Stat label="Total hours" value={formatNumber(durationResult.totalHours)} />
                  </div>
                </Panel>
                <p className="text-[11px] text-white/30">Overnight periods (end before start) are counted as spanning to the next day.</p>
              </>
            ) : (
              <p className="text-sm text-white/30">Enter both start and end times.</p>
            )}
          </div>
        )}

        {mode === "addsub" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel title="Base Time">
                <TimeRow label="Base" h={baseH} m={baseM} s={baseS} onH={setBaseH} onM={setBaseM} onS={setBaseS} />
              </Panel>
              <Panel title="Amount">
                <div className="flex items-center gap-1.5 mb-2">
                  <button
                    onClick={() => setOperation("add")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      operation === "add" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "border-border text-white/50"
                    }`}
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                  <button
                    onClick={() => setOperation("subtract")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      operation === "subtract" ? "bg-red-500/20 text-red-400 border-red-500/30" : "border-border text-white/50"
                    }`}
                  >
                    <Minus className="w-3 h-3" /> Subtract
                  </button>
                </div>
                <TimeRow label="Amount" h={amtH} m={amtM} s={amtS} onH={setAmtH} onM={setAmtM} onS={setAmtS} />
              </Panel>
            </div>

            {addSubResult && (
              <Panel title="Result">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-white/50 font-mono">{pad2(clampInt(baseH, 23))}:{pad2(clampInt(baseM, 59))}:{pad2(clampInt(baseS, 59))}</span>
                  <span className="text-sm text-white/30">{operation === "add" ? "+" : "−"}</span>
                  <span className="text-sm text-white/50 font-mono">{pad2(clampInt(amtH, 99))}:{pad2(clampInt(amtM, 59))}:{pad2(clampInt(amtS, 59))}</span>
                  <span className="text-sm text-white/30">=</span>
                  <span className="text-2xl font-semibold text-white font-mono">
                    {pad2(addSubResult.hh)}:{pad2(addSubResult.mm)}:{pad2(addSubResult.ss)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <Stat label="Clock time" value={`${pad2(addSubResult.hh)}:${pad2(addSubResult.mm)}:${pad2(addSubResult.ss)}`} />
                  <Stat label="Day offset" value={addSubResult.daysWrapped > 0 ? `+${addSubResult.daysWrapped}` : addSubResult.daysWrapped < 0 ? `${addSubResult.daysWrapped}` : "0"} />
                  <Stat label="Total seconds" value={formatNumber(addSubResult.total)} />
                </div>
              </Panel>
            )}
          </div>
        )}

        {mode === "convert" && (
          <div className="flex flex-col gap-4">
            <Panel title="Convert Time">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode="decimal"
                  className="w-32 bg-white/5 border border-border rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-blue-500/50"
                />
                <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}
                  className="bg-white/5 border border-border rounded-lg px-2 py-2 text-sm text-white/70">
                  {timeCategory.units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                  ))}
                </select>
                <button
                  onClick={() => { setFromUnit(toUnit); setToUnit(fromUnit); }}
                  className="w-9 h-9 rounded-lg bg-white/5 border border-border flex items-center justify-center text-white/50 hover:text-white transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
                <select value={toUnit} onChange={(e) => setToUnit(e.target.value)}
                  className="bg-white/5 border border-border rounded-lg px-2 py-2 text-sm text-white/70">
                  {timeCategory.units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                  ))}
                </select>
              </div>
            </Panel>

            {convertResult !== null && (
              <>
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 flex items-center justify-between">
                  <span className="text-sm text-white/60">
                    {value} {timeCategory.units.find((u) => u.id === fromUnit)?.symbol} equals
                  </span>
                  <span className="text-3xl font-semibold text-blue-400 font-mono">{formatUnitValue(convertResult)}</span>
                  <span className="text-sm text-white/60">{timeCategory.units.find((u) => u.id === toUnit)?.name} ({timeCategory.units.find((u) => u.id === toUnit)?.symbol})</span>
                </div>

                <Panel title="All Units">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allConversions.map(({ unit, result }) => (
                      <div key={unit.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                        <span className="text-xs text-white/50">{unit.name} <span className="text-white/25">({unit.symbol})</span></span>
                        <span className="text-sm font-mono text-white/90">{formatUnitValue(result)}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeRow({ label, h, m, s, onH, onM, onS }: {
  label: string; h: string; m: string; s: string; onH: (v: string) => void; onM: (v: string) => void; onS: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40 w-14 shrink-0">{label}</span>
      <TimeField value={h} onChange={onH} max={99} />
      <span className="text-white/40">:</span>
      <TimeField value={m} onChange={onM} max={59} />
      <span className="text-white/40">:</span>
      <TimeField value={s} onChange={onS} max={59} />
    </div>
  );
}

function TimeField({ value, onChange, max }: { value: string; onChange: (v: string) => void; max: number }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={focused ? value : (value === "" ? "" : pad2(clampInt(value, max)))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
        onChange(digits);
      }}
      className="w-14 bg-white/5 border border-border rounded-lg px-2 py-1.5 text-center text-sm font-mono text-white/90 focus:outline-none focus:border-blue-500/50"
    />
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-4"
    >
      <span className="text-[10px] uppercase tracking-widest text-white/30">{title}</span>
      <div className="mt-2.5">{children}</div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-widest text-white/30">{label}</div>
      <div className="text-lg font-semibold text-white/90 font-mono mt-0.5">{value}</div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1e9) return n.toExponential(3);
  return parseFloat(n.toFixed(4)).toString();
}
