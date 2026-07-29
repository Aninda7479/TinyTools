import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { FileText, Upload, Copy, Check, ShieldCheck, X } from "lucide-react";
import { pickFile } from "../lib/tauri";
import * as api from "../lib/tauri";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

type SubTool = "text-hash" | "file-hash" | "multi-hash" | "verify";

const subTools: { id: SubTool; label: string }[] = [
  { id: "text-hash", label: "Text Hash" },
  { id: "file-hash", label: "File Hash" },
  { id: "multi-hash", label: "All Algorithms" },
  { id: "verify", label: "Verify Hash" },
];

const algorithms = [
  { value: "md5", label: "MD5", note: "Legacy" },
  { value: "sha1", label: "SHA-1", note: "Legacy" },
  { value: "sha256", label: "SHA-256", note: "Standard" },
  { value: "sha512", label: "SHA-512", note: "Standard" },
  { value: "blake3", label: "BLAKE3", note: "Fast" },
  { value: "crc32", label: "CRC32", note: "Checksum" },
  { value: "adler32", label: "Adler32", note: "Checksum" },
  { value: "xxh3", label: "XXH3", note: "Fast" },
];

export default function HasherPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [active, setActive] = useState<SubTool>((defaultSub as SubTool) || "text-hash");
  const [algorithm, setAlgorithm] = useState("sha256");
  const [textInput, setTextInput] = useState("");
  const [textHash, setTextHash] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // File hash state
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");

  // Multi-hash state
  const [multiResult, setMultiResult] = useState<api.MultiHashResult | null>(null);

  // Verify state
  const [verifyExpected, setVerifyExpected] = useState("");
  const [verifyResult, setVerifyResult] = useState<api.VerifyResult | null>(null);
  const [verifyTextInput, setVerifyTextInput] = useState("");
  const [multiTextInput, setMultiTextInput] = useState("");

  const handleHashText = async () => {
    if (!textInput.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.hashText(textInput, algorithm);
      setTextHash(result);
    } catch (e: any) {
      setError(e?.toString() || "Hash failed");
    } finally {
      setLoading(false);
    }
  };

  const handleHashFile = async () => {
    if (!filePath) return;
    setLoading(true);
    setError("");
    setMultiResult(null);
    setVerifyResult(null);
    try {
      if (active === "verify") {
        if (!verifyExpected.trim()) { setError("Enter expected hash"); setLoading(false); return; }
        const result = await api.verifyFileHash(filePath, algorithm, verifyExpected);
        setVerifyResult(result);
      } else {
        const result = await api.hashFile(filePath, algorithm);
        setTextHash(result.hash);
      }
    } catch (e: any) {
      setError(e?.toString() || "File hash failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMultiHashText = async () => {
    if (!multiTextInput.trim()) return;
    setLoading(true);
    setError("");
    setMultiResult(null);
    try {
      const result = await api.hashTextAll(multiTextInput);
      setMultiResult(result);
    } catch (e: any) {
      setError(e?.toString() || "Multi-hash failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMultiHashFile = async () => {
    if (!filePath) return;
    setLoading(true);
    setError("");
    setMultiResult(null);
    try {
      const result = await api.hashFileAll(filePath);
      setMultiResult(result);
    } catch (e: any) {
      setError(e?.toString() || "Multi-hash failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMultiHash = async () => {
    if (filePath) {
      await handleMultiHashFile();
    } else {
      await handleMultiHashText();
    }
  };

  const handleVerifyText = async () => {
    if (!verifyTextInput.trim() || !verifyExpected.trim()) return;
    setLoading(true);
    setError("");
    setVerifyResult(null);
    try {
      const result = await api.verifyTextHash(verifyTextInput, algorithm, verifyExpected);
      setVerifyResult(result);
    } catch (e: any) {
      setError(e?.toString() || "Verify failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (filePath) {
      await handleHashFile();
    } else {
      await handleVerifyText();
    }
  };

  const openPicker = useCallback(async () => {
    const picked = await pickFile();
    if (!picked) return;
    setFilePath(picked.path);
    setFileName(picked.name);
    setTextHash("");
    setMultiResult(null);
    setVerifyResult(null);
  }, []);

  const handleCopy = async (text: string) => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
    } catch {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    }
    setTimeout(() => setCopied(false), 1500);
  };

  const isFileBased = active !== "text-hash" && active !== "verify" && active !== "multi-hash";

  const canSubmit = () => {
    if (active === "verify") return (filePath || verifyTextInput.trim()) && verifyExpected.trim();
    if (active === "multi-hash") return filePath || multiTextInput.trim();
    if (isFileBased) return !!filePath;
    return !!textInput.trim();
  };

  const handleSubmit = () => {
    if (active === "verify") { handleVerify(); return; }
    if (active === "multi-hash") { handleMultiHash(); return; }
    if (isFileBased) { handleHashFile(); return; }
    handleHashText();
  };

  const buttonLabel = () => {
    if (loading) return active === "verify" ? "Verifying..." : "Hashing...";
    if (active === "multi-hash") return "Compute All";
    if (active === "verify") return "Verify";
    return "Compute Hash";
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Hasher</h2>
        <p className="text-sm text-white/40 mt-1">Compute cryptographic hashes and checksums for data integrity</p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex gap-1.5">
            {subTools.map((t) => (
              <button key={t.id} onClick={() => { setActive(t.id); setTextHash(""); setMultiResult(null); setVerifyResult(null); setError(""); }}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] transition-colors ${active === t.id ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
              >{t.label}</button>
            ))}
          </div>

          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Algorithm</span>
            <div className="grid grid-cols-2 gap-1.5">
              {algorithms.map((a) => (
                <button key={a.value} onClick={() => setAlgorithm(a.value)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] transition-colors flex items-center justify-between ${algorithm === a.value ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                >
                  <span>{a.label}</span>
                  <span className="text-[9px] text-white/20">{a.note}</span>
                </button>
              ))}
            </div>
          </div>

          {active === "text-hash" && (
            <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text to hash..."
              className="h-32 resize-none rounded-xl bg-white/5 border border-border p-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors font-mono"
            />
          )}

          {active === "multi-hash" && (
            <textarea value={multiTextInput} onChange={(e) => setMultiTextInput(e.target.value)}
              placeholder="Enter text (or pick a file below)..."
              className="h-32 resize-none rounded-xl bg-white/5 border border-border p-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors font-mono"
            />
          )}

          {active === "verify" && (
            <>
              <textarea value={verifyTextInput} onChange={(e) => setVerifyTextInput(e.target.value)}
                placeholder="Or enter text to verify..."
                className="h-28 resize-none rounded-xl bg-white/5 border border-border p-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors font-mono"
              />
              <input type="text" value={verifyExpected} onChange={(e) => setVerifyExpected(e.target.value)}
                placeholder="Enter expected hash to compare..."
                className="rounded-xl bg-white/5 border border-border px-3 py-2 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors font-mono"
              />
            </>
          )}

          <button onClick={handleSubmit}
            disabled={loading || !canSubmit()}
            className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 text-sm font-medium"
          >{buttonLabel()}</button>
        </div>

        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {(isFileBased || active === "multi-hash") && (
            <motion.div
              animate={{
                borderColor: "rgba(255,255,255,0.1)",
                backgroundColor: "rgba(255,255,255,0.02)",
              }}
              transition={spring}
              className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-white/20 transition-colors"
              onClick={openPicker}
            >
              {fileName ? (
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-white/70">{fileName}</span>
                  <button onClick={(e) => { e.stopPropagation(); setFilePath(""); setFileName(""); }}
                    className="text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-white/30" />
                  <p className="text-sm text-white/60">Drop a file here or click to browse</p>
                </>
              )}
            </motion.div>
          )}

          <div className="flex-1 overflow-auto rounded-xl bg-white/5 border border-border p-4">
            {(active === "text-hash" || active === "file-hash") && textHash && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">{algorithm.toUpperCase()} Hash</span>
                  <button onClick={() => handleCopy(textHash)} className="text-white/30 hover:text-white/60">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-sm text-green-400 font-mono break-all leading-relaxed">{textHash}</p>
                {active === "text-hash" && <p className="text-[10px] text-white/20">{textInput.length} characters input</p>}
                {active === "file-hash" && <p className="text-[10px] text-white/20">{fileName}</p>}
              </div>
            )}

            {multiResult && (
              <div className="space-y-3">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">All Hashes — {fileName || `${multiResult.file_size} bytes`}</span>
                <div className="space-y-2">
                  {(["md5", "sha1", "sha256", "sha512", "blake3", "crc32"] as const).map((algo) => (
                    <div key={algo} className="flex items-start gap-2 group">
                      <span className="text-[10px] text-white/30 uppercase w-12 pt-0.5 shrink-0">{algo}</span>
                      <p className="text-xs text-green-400 font-mono break-all flex-1">{(multiResult as any)[algo]}</p>
                      <button onClick={() => handleCopy((multiResult as any)[algo])}
                        className="text-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-white/20 pt-2 border-t border-white/5">
                  {fileName ? `File size: ${(multiResult.file_size / 1024).toFixed(1)} KB` : `Input size: ${multiResult.file_size} bytes`}
                </div>
              </div>
            )}

            {verifyResult && (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${verifyResult.matches ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                  <ShieldCheck className={`w-5 h-5 ${verifyResult.matches ? "text-green-400" : "text-red-400"}`} />
                  <span className={`text-sm font-medium ${verifyResult.matches ? "text-green-400" : "text-red-400"}`}>
                    {verifyResult.matches ? "Hash matches!" : "Hash does NOT match"}
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] text-white/30 uppercase">Computed</span>
                    <p className="text-xs text-green-400 font-mono break-all mt-0.5">{verifyResult.computed}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase">Expected</span>
                    <p className="text-xs text-yellow-400 font-mono break-all mt-0.5">{verifyResult.expected}</p>
                  </div>
                </div>
              </div>
            )}

            {!textHash && !multiResult && !verifyResult && (
              <div className="flex flex-col items-center justify-center h-full text-white/20">
                <FileText className="w-10 h-10 mb-3" />
                <p className="text-sm">{isFileBased ? "Select a file" : active === "verify" ? "Select a file or enter text to verify" : active === "multi-hash" ? "Enter text or pick a file" : "Enter text and compute its hash"}</p>
              </div>
            )}
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
            >{error}</motion.div>
          )}

          <div className="text-[10px] text-white/20 text-center">
            All hashing runs locally in Rust — your data never leaves this device
          </div>
        </div>
      </div>
    </div>
  );
}
