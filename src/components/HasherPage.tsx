import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { FileText, Upload, Copy, Check, ShieldCheck, X } from "lucide-react";
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

export default function HasherPage() {
  const [active, setActive] = useState<SubTool>("text-hash");
  const [algorithm, setAlgorithm] = useState("sha256");
  const [textInput, setTextInput] = useState("");
  const [textHash, setTextHash] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // File hash state
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Multi-hash state
  const [multiResult, setMultiResult] = useState<api.MultiHashResult | null>(null);

  // Verify state
  const [verifyExpected, setVerifyExpected] = useState("");
  const [verifyResult, setVerifyResult] = useState<api.VerifyResult | null>(null);

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
      if (active === "multi-hash") {
        const result = await api.hashFileAll(filePath);
        setMultiResult(result);
      } else if (active === "verify") {
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

  const addFiles = useCallback((fileList: FileList) => {
    const f = fileList[0];
    if (f) {
      setFilePath((f as unknown as { path?: string }).path || f.name);
      setFileName(f.name);
      setTextHash("");
      setMultiResult(null);
      setVerifyResult(null);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isFileBased = active !== "text-hash";

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

          {active === "verify" && (
            <input type="text" value={verifyExpected} onChange={(e) => setVerifyExpected(e.target.value)}
              placeholder="Enter expected hash to compare..."
              className="rounded-xl bg-white/5 border border-border px-3 py-2 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors font-mono"
            />
          )}

          <button onClick={isFileBased ? handleHashFile : handleHashText}
            disabled={loading || (isFileBased ? !filePath : !textInput.trim())}
            className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 text-sm font-medium"
          >{loading ? "Hashing..." : active === "multi-hash" ? "Compute All" : active === "verify" ? "Verify" : "Compute Hash"}</button>
        </div>

        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {isFileBased && (
            <motion.div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              animate={{
                borderColor: isDragging ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.1)",
                backgroundColor: isDragging ? "rgba(96,165,250,0.05)" : "rgba(255,255,255,0.02)",
              }}
              transition={spring}
              className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-white/20 transition-colors"
              onClick={() => inputRef.current?.click()}
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
              <input ref={inputRef} type="file" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
            </motion.div>
          )}

          <div className="flex-1 overflow-auto rounded-xl bg-white/5 border border-border p-4">
            {active === "text-hash" && textHash && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">{algorithm.toUpperCase()} Hash</span>
                  <button onClick={() => handleCopy(textHash)} className="text-white/30 hover:text-white/60">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-sm text-green-400 font-mono break-all leading-relaxed">{textHash}</p>
                <p className="text-[10px] text-white/20">{textInput.length} characters input</p>
              </div>
            )}

            {multiResult && (
              <div className="space-y-3">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">All Hashes — {fileName}</span>
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
                  File size: {(multiResult.file_size / 1024).toFixed(1)} KB
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
                <p className="text-sm">{isFileBased ? "Select a file to compute hashes" : "Enter text and compute its hash"}</p>
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
