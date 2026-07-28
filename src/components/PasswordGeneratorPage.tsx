import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key, RefreshCw, Copy, Check, Download, Trash2, Shield, Hash, Volume2,
  ChevronDown, ChevronUp, FileText, AlertTriangle, Zap, Dice5
} from "lucide-react";
import {
  generatePassword, generateBulkPasswords, exportPasswords,
  type PasswordRequest, type GeneratedPassword, type BulkPasswordResult,
} from "../lib/tauri";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

type PwdMode = "random" | "passphrase" | "pin" | "pronounceable" | "pattern";

interface ModeCard {
  id: PwdMode;
  icon: typeof Key;
  title: string;
  description: string;
}

const modes: ModeCard[] = [
  { id: "random", icon: Key, title: "Random Password", description: "High-security random strings from customizable character sets" },
  { id: "passphrase", icon: Dice5, title: "Memorable Passphrase", description: "Random dictionary words — easy to remember, hard to crack" },
  { id: "pin", icon: Hash, title: "PIN Code", description: "Numeric-only strings for ATMs, devices, or keypads" },
  { id: "pronounceable", icon: Volume2, title: "Pronounceable", description: "Alternating consonants and vowels — easy to speak aloud" },
  { id: "pattern", icon: Zap, title: "Pattern / Template", description: "Custom format strings like AAA-999-aaa-!!!" },
];

const PRESETS: { label: string; length: number }[] = [
  { label: "8", length: 8 }, { label: "16", length: 16 }, { label: "24", length: 24 },
  { label: "32", length: 32 }, { label: "64", length: 64 },
];

function entropyToCrackTime(bits: number): string {
  if (bits < 10) return "Instant";
  const guessesPerSec = 1e10;
  const totalGuesses = Math.pow(2, bits);
  const seconds = totalGuesses / guessesPerSec / 2;
  if (seconds < 1) return "Instant";
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
  const years = seconds / 31536000;
  if (years < 1000) return `${Math.round(years)} years`;
  if (years < 1e6) return `${(years / 1000).toFixed(0)}k years`;
  if (years < 1e9) return `${(years / 1e6).toFixed(0)}M years`;
  if (years < 1e12) return `${(years / 1e9).toFixed(0)}B years`;
  return "Heat death of universe+";
}

function strengthColor(label: string): string {
  switch (label) {
    case "Very Weak": return "bg-red-500";
    case "Weak": return "bg-orange-500";
    case "Fair": return "bg-yellow-500";
    case "Strong": return "bg-emerald-500";
    case "Very Strong": return "bg-blue-500";
    case "Overkill": return "bg-purple-500";
    default: return "bg-white/20";
  }
}

function strengthTextColor(label: string): string {
  switch (label) {
    case "Very Weak": return "text-red-400";
    case "Weak": return "text-orange-400";
    case "Fair": return "text-yellow-400";
    case "Strong": return "text-emerald-400";
    case "Very Strong": return "text-blue-400";
    case "Overkill": return "text-purple-400";
    default: return "text-white/50";
  }
}

export default function PasswordGeneratorPage() {
  const [mode, setMode] = useState<PwdMode | null>(null);
  const [request, setRequest] = useState<PasswordRequest>({
    mode: "random",
    length: 16,
    word_count: 4,
    count: 10,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    exclude_ambiguous: false,
    custom_symbols: "",
    separator: "-",
    pattern: "aaa-999-AAA",
  });
  const [single, setSingle] = useState<GeneratedPassword | null>(null);
  const [bulk, setBulk] = useState<BulkPasswordResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedBulkIdx, setCopiedBulkIdx] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "pin" || (mode === "random" && bulk)) {
        const r = await generateBulkPasswords({ ...request, mode: request.mode || mode });
        setBulk(r);
        setSingle(null);
      } else {
        const r = await generatePassword({ ...request, mode: mode || "random", count: undefined });
        setSingle(r);
        setBulk(null);
      }
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [mode, request]);

  const generateSingle = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await generatePassword({ ...request, mode: mode || "random", count: undefined });
      setSingle(r);
      setBulk(null);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [mode, request]);

  useEffect(() => {
    if (mode) {
      setRequest(r => ({ ...r, mode }));
      setSingle(null);
      setBulk(null);
      setError("");
    }
  }, [mode]);

  const copyPassword = async (text: string, idx?: number) => {
    await navigator.clipboard.writeText(text);
    if (idx !== undefined) { setCopiedBulkIdx(idx); setTimeout(() => setCopiedBulkIdx(null), 2000); }
    else { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const copyAll = async () => {
    const all = bulk?.passwords.map(p => p.password).join("\n") || "";
    await navigator.clipboard.writeText(all);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (fmt: "csv" | "txt") => {
    if (!bulk) return;
    const passwords = bulk.passwords.map(p => p.password);
    const path = `passwords.${fmt}`;
    try {
      const result = await exportPasswords(passwords, fmt, path);
      setBulk(b => b ? { ...b, exported_path: result } : b);
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const clearClipboard = async () => {
    await navigator.clipboard.writeText("");
    setCopied(false);
  };

  // Mode selector
  if (!mode) {
    return (
      <div className="flex flex-col h-full">
        <h2 className="text-xl font-semibold mb-1">Password Generator</h2>
        <p className="text-sm text-white/40 mb-6">Cryptographically secure passwords — 100% offline</p>
        <div className="grid grid-cols-5 gap-3">
          {modes.map(m => {
            const Icon = m.icon;
            return (
              <motion.button key={m.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={spring}
                onClick={() => setMode(m.id)}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-border bg-surface/50 hover:border-border-hover hover:bg-surface-hover transition-colors cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-blue-400" />
                </div>
                <span className="text-sm font-medium text-center">{m.title}</span>
                <span className="text-[10px] text-white/30 text-center leading-relaxed">{m.description}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  const modeCard = modes.find(m => m.id === mode)!;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { setMode(null); setSingle(null); setBulk(null); setError(""); }}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <ChevronDown className="w-4 h-4 text-white/50 rotate-90" />
        </button>
        <div>
          <h2 className="text-lg font-semibold">{modeCard.title}</h2>
          <p className="text-xs text-white/40">{modeCard.description}</p>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Controls */}
        <div className="w-[320px] flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Mode-specific length controls */}
          {(mode === "random" || mode === "pin") && (
            <div className="space-y-2">
              <label className="text-xs text-white/40 flex items-center justify-between">
                Length
                <span className="text-white/70 font-mono">{request.length}</span>
              </label>
              <input type="range" min={mode === "pin" ? 4 : 8} max={128} value={request.length || 16}
                onChange={e => setRequest(r => ({ ...r, length: Number(e.target.value) }))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400" />
              <div className="flex gap-1 flex-wrap">
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => setRequest(r => ({ ...r, length: p.length }))}
                    className={`px-2 py-1 rounded-lg text-[10px] border transition-colors ${
                      request.length === p.length ? "bg-white/10 border-white/20 text-white" : "border-border text-white/40 hover:text-white/70"
                    }`}>{p.label}</button>
                ))}
              </div>
            </div>
          )}

          {mode === "passphrase" && (
            <div className="space-y-2">
              <label className="text-xs text-white/40 flex items-center justify-between">
                Word Count
                <span className="text-white/70 font-mono">{request.word_count}</span>
              </label>
              <input type="range" min={2} max={12} value={request.word_count || 4}
                onChange={e => setRequest(r => ({ ...r, word_count: Number(e.target.value) }))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400" />
              <label className="text-xs text-white/40">Separator</label>
              <div className="flex gap-1">
                {["-", "_", " ", "."].map(s => (
                  <button key={s} onClick={() => setRequest(r => ({ ...r, separator: s }))}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      request.separator === s ? "bg-white/10 border-white/20 text-white" : "border-border text-white/40 hover:text-white/70"
                    }`}>
                    {s === " " ? "space" : s === "-" ? "dash" : s === "_" ? "underscore" : "dot"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "pronounceable" && (
            <div className="space-y-2">
              <label className="text-xs text-white/40 flex items-center justify-between">
                Syllable Groups
                <span className="text-white/70 font-mono">{request.length}</span>
              </label>
              <input type="range" min={1} max={20} value={request.length || 3}
                onChange={e => setRequest(r => ({ ...r, length: Number(e.target.value) }))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400" />
            </div>
          )}

          {mode === "pattern" && (
            <div className="space-y-2">
              <label className="text-xs text-white/40">Pattern</label>
              <input value={request.pattern || ""} onChange={e => setRequest(r => ({ ...r, pattern: e.target.value }))}
                placeholder="aaa-999-AAA-!!!"
                className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 font-mono outline-none focus:border-blue-500/50" />
              <div className="text-[10px] text-white/20 space-y-0.5">
                <p><code>a</code> = lowercase &nbsp; <code>A</code> = uppercase</p>
                <p><code>9</code> = digit &nbsp; <code>!</code> = symbol</p>
                <p>Other characters are literal</p>
              </div>
            </div>
          )}

          {/* Character toggles (random mode only) */}
          {mode === "random" && (
            <>
              <div className="border border-border rounded-xl overflow-hidden">
                <button onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white/5 text-xs font-medium text-white/70 hover:bg-white/8 transition-colors">
                  Character Sets
                  {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showAdvanced && (
                  <div className="px-3 py-2 flex flex-col gap-2">
                    {([
                      ["lowercase", "a-z", request.lowercase],
                      ["uppercase", "A-Z", request.uppercase],
                      ["digits", "0-9", request.digits],
                      ["symbols", "!@#$%^&*", request.symbols],
                    ] as const).map(([key, label, val]) => (
                      <label key={key} className="flex items-center justify-between text-xs text-white/50">
                        {label}
                        <Toggle checked={val ?? true}
                          onChange={v => setRequest(r => ({ ...r, [key]: v }))} />
                      </label>
                    ))}
                    <label className="flex items-center justify-between text-xs text-white/50">
                      Exclude Ambiguous
                      <Toggle checked={request.exclude_ambiguous ?? false}
                        onChange={v => setRequest(r => ({ ...r, exclude_ambiguous: v }))} />
                    </label>
                    <label className="text-xs text-white/40">
                      Custom Symbols
                      <input value={request.custom_symbols || ""} onChange={e => setRequest(r => ({ ...r, custom_symbols: e.target.value }))}
                        placeholder="e.g. @#$%"
                        className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 font-mono outline-none focus:border-blue-500/50" />
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Bulk count */}
          <label className="text-xs text-white/40 flex items-center justify-between">
            Bulk Count
            <span className="text-white/70 font-mono">{request.count}</span>
          </label>
          <input type="range" min={1} max={1000} value={request.count || 10}
            onChange={e => setRequest(r => ({ ...r, count: Number(e.target.value) }))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400" />

          {/* Generate button */}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring}
            disabled={loading} onClick={generate}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50">
            {loading ? <span className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? "Generating..." : "Generate"}
          </motion.button>

          <button onClick={clearClipboard}
            className="flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 border border-border text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors text-xs">
            <Trash2 className="w-3 h-3" /> Clear Clipboard
          </button>
        </div>

        {/* Right: Results */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="text-xs text-red-300/80 whitespace-pre-wrap break-all">{error}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Single result */}
          {single && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}
              className="flex flex-col gap-3">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-border">
                <div className="flex-1 font-mono text-lg text-white/90 break-all select-all leading-relaxed">
                  {single.password}
                </div>
                <button onClick={() => copyPassword(single.password)} className="p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/50" />}
                </button>
              </div>

              {/* Strength meter */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${strengthTextColor(single.strength_label)}`}>
                    <Shield className="w-3 h-3 inline mr-1" />
                    {single.strength_label}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {single.entropy_bits.toFixed(1)} bits · ~{entropyToCrackTime(single.entropy_bits)}
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((single.entropy_bits / 128) * 100, 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${strengthColor(single.strength_label)}`}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-white/20">
                  <span>Pool: {single.charset_size} chars</span>
                  <span>Length: {single.length}</span>
                </div>
              </div>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring}
                onClick={generateSingle}
                className="flex items-center justify-center gap-2 py-2 rounded-xl bg-white/5 border border-border text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors text-xs">
                <RefreshCw className="w-3 h-3" /> Regenerate
              </motion.button>
            </motion.div>
          )}

          {/* Bulk result */}
          {bulk && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}
              className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">{bulk.count} passwords generated</span>
                <div className="flex gap-2">
                  <button onClick={copyAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy All"}
                  </button>
                  <button onClick={() => handleExport("csv")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    <FileText className="w-3 h-3" /> CSV
                  </button>
                  <button onClick={() => handleExport("txt")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                    <Download className="w-3 h-3" /> TXT
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/5 text-white/40">
                      <th className="px-3 py-2 text-left w-10">#</th>
                      <th className="px-3 py-2 text-left">Password</th>
                      <th className="px-3 py-2 text-left w-20">Strength</th>
                      <th className="px-3 py-2 text-left w-16">Bits</th>
                      <th className="px-3 py-2 text-right w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulk.passwords.map((p, i) => (
                      <tr key={i} className="border-t border-border/50 hover:bg-white/3 transition-colors">
                        <td className="px-3 py-1.5 text-white/20 font-mono">{i + 1}</td>
                        <td className="px-3 py-1.5 font-mono text-white/80 break-all">{p.password}</td>
                        <td className={`px-3 py-1.5 ${strengthTextColor(p.strength_label)}`}>{p.strength_label}</td>
                        <td className="px-3 py-1.5 text-white/40 font-mono">{p.entropy_bits.toFixed(0)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button onClick={() => copyPassword(p.password, i)} className="p-1 rounded hover:bg-white/10 transition-colors">
                            {copiedBulkIdx === i ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-white/40" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Empty state */}
          {!single && !bulk && !error && (
            <div className="flex-1 flex flex-col items-center justify-center text-white/20">
              <Key className="w-12 h-12 mb-3" />
              <p className="text-sm">Configure options and click Generate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`w-8 h-4 rounded-full transition-colors relative ${checked ? "bg-blue-500" : "bg-white/10"}`}>
      <div className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform"
        style={{ transform: checked ? "translateX(16px)" : "translateX(2px)" }} />
    </button>
  );
}
