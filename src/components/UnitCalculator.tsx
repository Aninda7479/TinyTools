import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Ruler, Weight, Thermometer, Square, Box, Clock, Gauge, HardDrive,
  CircleDot, Zap, Waves, Activity, Scale, ArrowLeftRight,
} from "lucide-react";
import { unitCategories, convertValue, formatUnitValue, type UnitCategory } from "../lib/calc-units";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const categoryIcons: Record<string, typeof Ruler> = {
  length: Ruler,
  weight: Weight,
  temperature: Thermometer,
  area: Square,
  volume: Box,
  time: Clock,
  speed: Gauge,
  data: HardDrive,
  angle: CircleDot,
  energy: Zap,
  power: Waves,
  pressure: Activity,
  frequency: Scale,
};

export default function UnitCalculator() {
  const [categoryId, setCategoryId] = useState("length");
  const [value, setValue] = useState("1");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("ft");

  const category = useMemo<UnitCategory>(() => {
    const cat = unitCategories.find((c) => c.id === categoryId)!;
    return cat;
  }, [categoryId]);

  const selectCategory = (id: string) => {
    const cat = unitCategories.find((c) => c.id === id)!;
    setCategoryId(id);
    setFromUnit(cat.units[0].id);
    setToUnit(cat.units[1]?.id || cat.units[0].id);
  };

  const num = parseFloat(value);
  const result = useMemo(() => {
    if (Number.isNaN(num)) return null;
    return convertValue(category, num, fromUnit, toUnit);
  }, [category, num, fromUnit, toUnit]);

  const allResults = useMemo(() => {
    if (Number.isNaN(num)) return [];
    return category.units.map((u) => ({ unit: u, result: convertValue(category, num, fromUnit, u.id) }));
  }, [category, num, fromUnit]);

  const fromDef = category.units.find((u) => u.id === fromUnit);
  const toDef = category.units.find((u) => u.id === toUnit);

  return (
    <div className="flex flex-col h-full gap-4">
      <h2 className="text-xl font-semibold">Unit Calculator</h2>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {unitCategories.map((cat) => {
          const Icon = categoryIcons[cat.id] || Ruler;
          const active = cat.id === categoryId;
          return (
            <button
              key={cat.id}
              onClick={() => selectCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : "border-border text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {cat.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        {/* Converter */}
        <motion.div
          key={category.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1.5">From</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode="decimal"
                  className="flex-1 bg-white/5 border border-border rounded-xl px-3 py-2.5 text-lg text-white/90 font-mono focus:outline-none focus:border-blue-500/50"
                />
                <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}
                  className="w-44 bg-white/5 border border-border rounded-xl px-2 py-2.5 text-sm text-white/70 focus:outline-none">
                  {category.units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => { setFromUnit(toUnit); setToUnit(fromUnit); }}
              className="w-11 h-11 rounded-xl bg-white/5 border border-border flex items-center justify-center text-white/50 hover:text-blue-400 hover:border-blue-500/30 transition-colors self-end mb-0.5"
              title="Swap units"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>

            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-widest text-white/30 mb-1.5">To</div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center rounded-xl bg-blue-500/10 border border-blue-500/25 px-3 py-2 min-w-0">
                  <span className="text-lg font-semibold text-blue-400 font-mono truncate">
                    {result !== null ? formatUnitValue(result) : "—"}
                  </span>
                </div>
                <select value={toUnit} onChange={(e) => setToUnit(e.target.value)}
                  className="w-44 bg-white/5 border border-border rounded-xl px-2 py-2.5 text-sm text-white/70 focus:outline-none">
                  {category.units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center mt-4 text-xs text-white/30">
            {fromDef && toDef && (
              <span>
                1 {fromDef.symbol} = {formatUnitValue(convertValue(category, 1, fromDef.id, toDef.id))} {toDef.symbol}
              </span>
            )}
          </div>
        </motion.div>

        {/* All units table */}
        <motion.div
          key={`${category.id}-table`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="rounded-2xl border border-border bg-surface/50 backdrop-blur-xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-white/30">
              {value} {fromDef?.symbol || ""} in all {category.label} units
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {allResults.map(({ unit, result }, i) => (
              <motion.div
                key={unit.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02, ...spring }}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <span className="text-xs text-white/50">{unit.name} <span className="text-white/25">({unit.symbol})</span></span>
                <span className="text-sm font-mono text-white/90">{formatUnitValue(result)}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
