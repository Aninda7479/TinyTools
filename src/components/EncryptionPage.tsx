import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Lock, Unlock, FileLock, FileDown, Copy, Check, Upload, X, Shield } from "lucide-react";
import * as api from "../lib/tauri";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

type SubTool =
  | "text-aes" | "text-chacha" | "text-classic"
  | "file-aes" | "file-chacha";

const subTools: { id: SubTool; label: string; category: string }[] = [
  { id: "text-aes", label: "AES-256-GCM", category: "Text" },
  { id: "text-chacha", label: "ChaCha20-Poly1305", category: "Text" },
  { id: "text-classic", label: "Classic Ciphers", category: "Text" },
  { id: "file-aes", label: "AES-256-GCM", category: "File" },
  { id: "file-chacha", label: "ChaCha20-Poly1305", category: "File" },
];

type ClassicCipher = "rot13" | "caesar" | "vigenere" | "xor";

export default function EncryptionPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [active, setActive] = useState<SubTool>((defaultSub as SubTool) || "text-aes");
  const [textMode, setTextMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [kdf, setKdf] = useState("argon2");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Classic cipher state
  const [classicMode, setClassicMode] = useState<ClassicCipher>("rot13");
  const [caesarShift, setCaesarShift] = useState(3);
  const [vigenereKey, setVigenereKey] = useState("");
  const [xorKey, setXorKey] = useState("");

  // File encryption state
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileOutputPath, setFileOutputPath] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTextEncrypt = async () => {
    if (!input.trim() || !passphrase.trim()) return;
    setLoading(true);
    setError("");
    try {
      let result = "";
      switch (active) {
        case "text-aes":
          result = textMode === "encrypt"
            ? await api.encryptTextAes(input, passphrase, kdf)
            : await api.decryptTextAes(input, passphrase);
          break;
        case "text-chacha":
          result = textMode === "encrypt"
            ? await api.encryptTextChacha(input, passphrase, kdf)
            : await api.decryptTextChacha(input, passphrase);
          break;
        case "text-classic":
          switch (classicMode) {
            case "rot13": result = await api.encryptRot13(input); break;
            case "caesar": result = await api.encryptCaesar(input, caesarShift); break;
            case "vigenere":
              if (!vigenereKey.trim()) { setError("Enter a key"); setLoading(false); return; }
              result = await api.encryptVigenere(input, vigenereKey);
              break;
            case "xor":
              if (!xorKey.trim()) { setError("Enter a key"); setLoading(false); return; }
              result = await api.encryptXor(input, xorKey);
              break;
          }
          break;
      }
      setOutput(result);
    } catch (e: any) {
      setError(e?.toString() || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileEncrypt = async () => {
    if (!filePath || !passphrase.trim()) return;
    setLoading(true);
    setError("");
    try {
      const outPath = filePath + ".enc";
      let result = "";
      switch (active) {
        case "file-aes":
          result = textMode === "encrypt"
            ? await api.encryptFileAes(filePath, outPath, passphrase, kdf)
            : await api.decryptFileAes(filePath, outPath.replace(".enc", ".dec"), passphrase);
          break;
        case "file-chacha":
          result = textMode === "encrypt"
            ? await api.encryptFileChacha(filePath, outPath, passphrase, kdf)
            : await api.decryptFileChacha(filePath, outPath.replace(".enc", ".dec"), passphrase);
          break;
      }
      setFileOutputPath(result);
    } catch (e: any) {
      setError(e?.toString() || "File operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const swap = () => {
    setInput(output);
    setOutput("");
    setTextMode(m => m === "encrypt" ? "decrypt" : "encrypt");
  };

  const addFiles = useCallback((fileList: FileList) => {
    const f = fileList[0];
    if (f) {
      setFilePath((f as unknown as { path?: string }).path || f.name);
      setFileName(f.name);
      setFileOutputPath("");
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const isTextBased = active.startsWith("text-");

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Encryption / Decryption</h2>
        <p className="text-sm text-white/40 mt-1">Secure text and file encryption with authenticated ciphers and classic algorithms</p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Text Encryption</span>
            <div className="flex gap-1.5">
              {subTools.filter(t => t.category === "Text").map((t) => (
                <button key={t.id} onClick={() => { setActive(t.id); setOutput(""); setError(""); }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] transition-colors ${active === t.id ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                >{t.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">File Encryption</span>
            <div className="flex gap-1.5">
              {subTools.filter(t => t.category === "File").map((t) => (
                <button key={t.id} onClick={() => { setActive(t.id); setOutput(""); setError(""); setFileOutputPath(""); }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] transition-colors ${active === t.id ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {active !== "text-classic" && (
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Passphrase</span>
                <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter encryption passphrase..."
                  className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors"
                />
              </div>
              <div>
                <span className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Key Derivation</span>
                <div className="flex gap-1.5">
                  {([
                    { value: "argon2", label: "Argon2id", note: "Memory-hard" },
                    { value: "pbkdf2", label: "PBKDF2", note: "100K iter" },
                  ]).map((k) => (
                    <button key={k.value} onClick={() => setKdf(k.value)}
                      className={`flex-1 px-2 py-2 rounded-lg text-[11px] transition-colors flex flex-col items-center gap-0.5 ${kdf === k.value ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                    >
                      <span>{k.label}</span>
                      <span className="text-[9px] text-white/20">{k.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {active === "text-classic" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {(["rot13", "caesar", "vigenere", "xor"] as const).map((c) => (
                  <button key={c} onClick={() => { setClassicMode(c); setOutput(""); setError(""); }}
                    className={`px-2 py-1.5 rounded-lg text-[11px] uppercase transition-colors ${classicMode === c ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                  >{c}</button>
                ))}
              </div>
              {classicMode === "caesar" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">Shift</span>
                  <input type="range" min={0} max={25} value={caesarShift} onChange={(e) => setCaesarShift(parseInt(e.target.value))} className="flex-1 accent-blue-400" />
                  <span className="text-xs text-white/50 w-6 text-right">{caesarShift}</span>
                </div>
              )}
              {classicMode === "vigenere" && (
                <input type="text" value={vigenereKey} onChange={(e) => setVigenereKey(e.target.value)}
                  placeholder="Vigenère key (letters only)..." className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors"
                />
              )}
              {classicMode === "xor" && (
                <input type="text" value={xorKey} onChange={(e) => setXorKey(e.target.value)}
                  placeholder="XOR key (any characters)..." className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors font-mono"
                />
              )}
              <p className="text-[9px] text-white/20">Classic ciphers are for obfuscation, not security</p>
            </div>
          )}

          {isTextBased && active !== "text-classic" && (
            <div className="flex gap-2">
              {(["encrypt", "decrypt"] as const).map((m) => (
                <button key={m} onClick={() => { setTextMode(m); setOutput(""); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${textMode === m ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                >{m === "encrypt" ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}{m === "encrypt" ? "Encrypt" : "Decrypt"}</button>
              ))}
            </div>
          )}

          {isTextBased && (
            <button onClick={handleTextEncrypt}
              disabled={loading || !input.trim() || (active !== "text-classic" && !passphrase.trim())}
              className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 text-sm font-medium"
            >{loading ? "Processing..." : textMode === "encrypt" ? "Encrypt" : "Decrypt"}</button>
          )}

          {!isTextBased && (
            <button onClick={handleFileEncrypt}
              disabled={loading || !filePath || !passphrase.trim()}
              className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 text-sm font-medium"
            >{loading ? "Processing..." : textMode === "encrypt" ? "Encrypt File" : "Decrypt File"}</button>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {isTextBased ? (
            <div className="flex-1 flex gap-3 min-h-0">
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                  {textMode === "encrypt" ? "Plaintext" : "Ciphertext"}
                </span>
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder={textMode === "encrypt" ? "Enter text to encrypt..." : "Enter ciphertext to decrypt..."}
                  className="flex-1 resize-none rounded-xl bg-white/5 border border-border p-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors font-mono"
                />
              </div>
              <div className="flex flex-col gap-2 justify-center">
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={swap}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white/70"
                ><ArrowRightLeft className="w-3.5 h-3.5" /></motion.button>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleCopy}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white/70"
                >{copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}</motion.button>
              </div>
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                  {textMode === "encrypt" ? "Ciphertext" : "Plaintext"}
                </span>
                <textarea readOnly value={output}
                  placeholder="Result will appear here..."
                  className="flex-1 resize-none rounded-xl bg-white/5 border border-border p-3 text-sm text-white/90 placeholder:text-white/20 outline-none font-mono"
                />
              </div>
            </div>
          ) : (
            <>
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
                    {textMode === "encrypt" ? <FileLock className="w-5 h-5 text-blue-400" /> : <FileDown className="w-5 h-5 text-blue-400" />}
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

              {fileOutputPath && (
                <div className="px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
                  {fileOutputPath}
                </div>
              )}

              <div className="flex-1 flex flex-col items-center justify-center text-white/20 rounded-xl bg-white/5 border border-border">
                <Shield className="w-10 h-10 mb-3" />
                <p className="text-sm">
                  {textMode === "encrypt"
                    ? "File will be encrypted with AES-256-GCM + Argon2id KDF"
                    : "Provide the .enc file and original passphrase to decrypt"
                  }
                </p>
                <p className="text-[10px] text-white/10 mt-2">Each operation generates a unique random salt and nonce</p>
              </div>
            </>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
            >{error}</motion.div>
          )}

          <div className="text-[10px] text-white/20 text-center">
            {active.startsWith("text-") && active !== "text-classic"
              ? "AEAD encryption (AES-256-GCM / ChaCha20-Poly1305) — tampering is detected automatically"
              : "All operations run locally in Rust — zero network calls"
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowRightLeft({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" />
    </svg>
  );
}
