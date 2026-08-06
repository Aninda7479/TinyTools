import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, Copy, Check, Upload, X, Shield, Eye, EyeOff, Download, Hash, ArrowRightLeft } from "lucide-react";
import * as api from "../lib/tauri";
import { pickFile, saveFile } from "../lib/tauri";
import { revealInFolder } from "../lib/p2p-api";
import { writeTextFile } from "@tauri-apps/plugin-fs";

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
type EncodingFormat = "base64" | "base64url" | "hex";
type XorEncoding = "raw" | "hex" | "base64";

function encodeBlob(base64: string, fmt: EncodingFormat): string {
  if (fmt === "base64") return base64;
  const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  if (fmt === "base64url") {
    return btoa(String.fromCharCode(...binary)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Array.from(binary).map(b => b.toString(16).padStart(2, "0")).join("");
}

function decodeToBase64(input: string, fmt: EncodingFormat): string {
  if (fmt === "base64") return input;
  let binary: Uint8Array;
  if (fmt === "base64url") {
    const normal = input.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (2 - input.length * 3 % 4) % 4);
    binary = Uint8Array.from(atob(normal), c => c.charCodeAt(0));
  } else {
    const clean = input.replace(/\s/g, "");
    if (!/^[0-9a-fA-F]+$/.test(clean)) throw new Error("Invalid hex input");
    binary = new Uint8Array(clean.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  }
  return btoa(String.fromCharCode(...binary));
}

function parseBlobMeta(base64: string): { salt: number; nonce: number; tag: number; payload: number; kdf: string } | null {
  try {
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    if (binary.length < 10) return null;
    const kdf = binary[0] === 0 ? "Argon2id" : binary[0] === 1 ? "PBKDF2" : "Unknown";
    let pos = 1;
    const saltLen = new DataView(binary.buffer, pos, 4).getUint32(0, true); pos += 4;
    if (pos + saltLen > binary.length) return null;
    pos += saltLen;
    const nonceLen = new DataView(binary.buffer, pos, 4).getUint32(0, true); pos += 4;
    if (pos + nonceLen > binary.length) return null;
    pos += nonceLen;
    const payload = binary.length - pos;
    return { salt: saltLen, nonce: nonceLen, tag: 16, payload, kdf };
  } catch { return null; }
}

function passphraseStrength(passphrase: string): { label: string; bits: number; pct: number } | null {
  if (!passphrase) return null;
  let pool = 0;
  if (/[a-z]/.test(passphrase)) pool += 26;
  if (/[A-Z]/.test(passphrase)) pool += 26;
  if (/\d/.test(passphrase)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(passphrase)) pool += 33;
  if (pool === 0) pool = 95;
  const bits = passphrase.length * Math.log2(pool);
  const pct = Math.min(bits / 128 * 100, 100);
  const label = bits < 28 ? "Very Weak" : bits < 36 ? "Weak" : bits < 60 ? "Fair" : bits < 80 ? "Strong" : bits < 128 ? "Very Strong" : "Overkill";
  return { label, bits, pct };
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

export default function EncryptionPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [active, setActive] = useState<SubTool>((defaultSub as SubTool) || "text-aes");
  const [textMode, setTextMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [kdf, setKdf] = useState("argon2");
  const [encoding, setEncoding] = useState<EncodingFormat>("base64");
  const [xorEncoding, setXorEncoding] = useState<XorEncoding>("raw");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  const [classicMode, setClassicMode] = useState<ClassicCipher>("rot13");
  const [caesarShift, setCaesarShift] = useState(3);
  const [vigenereKey, setVigenereKey] = useState("");
  const [xorKey, setXorKey] = useState("");

  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [fileOutputPath, setFileOutputPath] = useState("");
  const [outputFilePath, setOutputFilePath] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [rawBase64, setRawBase64] = useState("");
  const fileDropRef = useRef<HTMLDivElement>(null);

  const isTextBased = active.startsWith("text-");
  const needsPassphrase = active !== "text-classic";
  const isClassic = active === "text-classic";
  const isFileMode = !isTextBased;

  const doEncrypt = useCallback(async (inp: string, pwd: string, k: string, enc: EncodingFormat) => {
    setLoading(true);
    setError("");
    try {
      if (isClassic) {
        let result = "";
        switch (classicMode) {
          case "rot13": result = await api.encryptRot13(inp); break;
          case "caesar": result = await api.encryptCaesar(inp, caesarShift); break;
          case "vigenere": if (!vigenereKey.trim()) { setError("Enter a key"); setLoading(false); return; } result = await api.encryptVigenere(inp, vigenereKey); break;
          case "xor": if (!xorKey.trim()) { setError("Enter a key"); setLoading(false); return; } result = await api.encryptXor(inp, xorKey, xorEncoding); break;
        }
        setOutput(result);
        setRawBase64("");
        return;
      }
      let raw = "";
      if (active === "text-aes") {
        raw = textMode === "encrypt" ? await api.encryptTextAes(inp, pwd, k) : await api.decryptTextAes(inp, pwd);
      } else {
        raw = textMode === "encrypt" ? await api.encryptTextChacha(inp, pwd, k) : await api.decryptTextChacha(inp, pwd);
      }
      if (textMode === "encrypt") {
        setRawBase64(raw);
        setOutput(encodeBlob(raw, enc));
      } else {
        setOutput(raw);
        setRawBase64("");
      }
    } catch (e: any) {
      setError(e?.toString() || "Operation failed");
    } finally {
      setLoading(false);
    }
  }, [active, textMode, classicMode, caesarShift, vigenereKey, xorKey, xorEncoding, isClassic]);

  const triggerProcess = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!input.trim()) { setOutput(""); setRawBase64(""); setError(""); return; }
      if (isClassic && classicMode === "xor" && !xorKey.trim()) { setOutput(""); return; }
      if (isClassic && classicMode === "vigenere" && !vigenereKey.trim()) { setOutput(""); return; }
      if (isClassic) {
        if (classicMode === "xor" && textMode !== "encrypt") {
          if (!xorKey.trim()) return;
          setLoading(true); setError("");
          try {
            setOutput(await api.decryptXor(input, xorKey, xorEncoding));
          } catch (e: any) { setError(e?.toString()); } finally { setLoading(false); }
        } else {
          await doEncrypt(input, passphrase, kdf, encoding);
        }
        return;
      }
      if (needsPassphrase && !passphrase.trim()) { setOutput(""); setRawBase64(""); return; }
      if (textMode === "encrypt") {
        await doEncrypt(input, passphrase, kdf, encoding);
      } else {
        setLoading(true); setError("");
        try {
          const base64 = decodeToBase64(input, encoding);
          const raw = active === "text-aes" ? await api.decryptTextAes(base64, passphrase) : await api.decryptTextChacha(base64, passphrase);
          setOutput(raw); setRawBase64("");
        } catch (e: any) { setError(e?.toString() || "Decryption failed"); } finally { setLoading(false); }
      }
    }, 300);
  }, [input, passphrase, kdf, encoding, xorEncoding, textMode, active, classicMode, doEncrypt, needsPassphrase, xorKey, vigenereKey]);

  useEffect(() => { triggerProcess(); return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, [triggerProcess]);

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = async () => {
    if (!output) return;
    const path = await saveFile(
      textMode === "encrypt" ? "ciphertext.txt" : "plaintext.txt",
      [{ name: "Text Files", extensions: ["txt"] }]
    );
    if (!path) return;
    await writeTextFile(path, output);
  };

  const handleClear = () => { setInput(""); setOutput(""); setRawBase64(""); setError(""); };

  const swap = () => {
    setInput(output);
    setOutput("");
    setRawBase64("");
    if (!isClassic) setTextMode(m => m === "encrypt" ? "decrypt" : "encrypt");
  };

  const openPicker = useCallback(async () => {
    const picked = await pickFile();
    if (!picked) return;
    setFilePath(picked.path);
    setFileName(picked.name);
    setFileSize(picked.size);
    setFileOutputPath("");
  }, []);

  const handleFileEncrypt = async () => {
    if (!filePath || !passphrase.trim()) return;
    setLoading(true);
    setError("");
    try {
      const outPath = textMode === "encrypt"
        ? filePath + ".enc"
        : filePath.replace(/\.enc$/, "") + ".dec";
      let msg = "";
      switch (active) {
        case "file-aes":
          msg = textMode === "encrypt" ? await api.encryptFileAes(filePath, outPath, passphrase, kdf) : await api.decryptFileAes(filePath, outPath, passphrase);
          break;
        case "file-chacha":
          msg = textMode === "encrypt" ? await api.encryptFileChacha(filePath, outPath, passphrase, kdf) : await api.decryptFileChacha(filePath, outPath, passphrase);
          break;
      }
      setFileOutputPath(msg);
      setOutputFilePath(outPath);
    } catch (e: any) {
      setError(e?.toString() || "File operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileDownload = async () => {
    if (!outputFilePath) return;
    await revealInFolder(outputFilePath);
  };

  const meta = !isClassic && rawBase64 ? parseBlobMeta(rawBase64) : null;

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
                <button key={t.id} onClick={() => { setActive(t.id); setOutput(""); setRawBase64(""); setError(""); setFileOutputPath(""); setOutputFilePath(""); }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] transition-colors ${active === t.id ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                >{t.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">File Encryption</span>
            <div className="flex gap-1.5">
              {subTools.filter(t => t.category === "File").map((t) => (
                <button key={t.id} onClick={() => { setActive(t.id); setOutput(""); setRawBase64(""); setError(""); setFileOutputPath(""); setOutputFilePath(""); setFilePath(""); setFileName(""); }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] transition-colors ${active === t.id ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {needsPassphrase && (
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Passphrase</span>
                <div className="relative">
                  <input type={showPassphrase ? "text" : "password"} value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter encryption passphrase..."
                    className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 pr-9 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors"
                  />
                  <button onClick={() => setShowPassphrase(!showPassphrase)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passphrase && (
                  <div className="mt-1.5 space-y-1">
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      {(() => { const s = passphraseStrength(passphrase); return s ? <motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.3 }} className={`h-full rounded-full ${strengthColor(s.label)}`} /> : null; })()}
                    </div>
                    {(() => { const s = passphraseStrength(passphrase); return s ? <div className="flex justify-between text-[9px]"><span className={strengthColor(s.label).replace("bg-", "text-")}>{s.label}</span><span className="text-white/30">{s.bits.toFixed(0)} bits</span></div> : null; })()}
                  </div>
                )}
              </div>
              {!isClassic && (
                <div>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Key Derivation</span>
                  <div className="flex gap-1.5">
                    {([
                      { value: "argon2", label: "Argon2id", note: "Memory-hard (default)" },
                      { value: "pbkdf2", label: "PBKDF2", note: "600K iter" },
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
              )}
              {!isClassic && textMode === "encrypt" && (
                <div>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Encoding</span>
                  <div className="flex gap-1.5">
                    {(["base64", "base64url", "hex"] as const).map((f) => (
                      <button key={f} onClick={() => { setEncoding(f); if (rawBase64) setOutput(encodeBlob(rawBase64, f)); }}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] transition-colors ${encoding === f ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                      >{f === "base64" ? "Base64" : f === "base64url" ? "Base64URL" : "Hex"}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isClassic && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {(["rot13", "caesar", "vigenere", "xor"] as const).map((c) => (
                  <button key={c} onClick={() => { setClassicMode(c); setOutput(""); setRawBase64(""); }}
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
                <div className="space-y-2">
                  <input type="text" value={xorKey} onChange={(e) => setXorKey(e.target.value)}
                    placeholder="XOR key (any characters)..." className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors font-mono"
                  />
                  <div className="flex gap-1.5">
                    {(["raw", "hex", "base64"] as const).map((f) => (
                      <button key={f} onClick={() => setXorEncoding(f)}
                        className={`flex-1 px-2 py-1 rounded-lg text-[9px] transition-colors ${xorEncoding === f ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                      >{f === "raw" ? "Raw" : f === "hex" ? "Hex" : "Base64"}</button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[9px] text-white/20">Classic ciphers are for obfuscation, not security</p>
            </div>
          )}

          {!isClassic && (
            <div className="flex gap-2">
              {(["encrypt", "decrypt"] as const).map((m) => (
                <button key={m} onClick={() => { setTextMode(m); setOutput(""); setRawBase64(""); setFileOutputPath(""); setOutputFilePath(""); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${textMode === m ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                >{m === "encrypt" ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}{m === "encrypt" ? "Encrypt" : "Decrypt"}</button>
              ))}
            </div>
          )}

          {isFileMode && (
            <div className="flex flex-col gap-2">
              <button onClick={openPicker}
                className="w-full py-3 rounded-xl bg-white/5 border border-dashed border-white/20 hover:bg-white/10 transition-colors text-xs font-medium flex items-center justify-center gap-2"
              ><Upload className="w-4 h-4" />{fileName ? `File: ${fileName}` : "Pick File"}</button>
              <button onClick={handleFileEncrypt}
                disabled={loading || !filePath || !passphrase.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 text-sm font-medium"
              >{loading ? "Processing..." : textMode === "encrypt" ? "Encrypt File" : "Decrypt File"}</button>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {isTextBased ? (
            <div className="flex-1 flex gap-3 min-h-0">
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">
                    {isClassic ? "Input" : textMode === "encrypt" ? "Plaintext" : "Ciphertext"}
                  </span>
                  <div className="flex items-center gap-1">
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={swap}
                      className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-white/30 hover:text-white/60"
                      title="Swap input with output"
                    ><ArrowRightLeft className="w-3 h-3" /></motion.button>
                    <button onClick={handleClear} className="text-white/20 hover:text-white/50"><X className="w-3 h-3" /></button>
                  </div>
                </div>
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder={isClassic ? "Enter input..." : textMode === "encrypt" ? "Enter text to encrypt..." : "Paste ciphertext to decrypt..."}
                  className="flex-1 resize-none rounded-xl bg-white/5 border border-border p-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors font-mono"
                />
              </div>
              <div className="flex flex-col gap-2 justify-center">
                <div className="w-6 h-6" />
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">
                    {isClassic ? "Output" : textMode === "encrypt" ? "Ciphertext" : "Plaintext"}
                  </span>
                  <div className="flex items-center gap-1">
                    {meta && (
                      <span className="text-[9px] text-white/20 bg-white/5 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Hash className="w-2.5 h-2.5" />
                        S:{meta.salt} N:{meta.nonce} T:{meta.tag} P:{meta.payload} | {meta.kdf}
                      </span>
                    )}
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleCopy}
                      className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-white/30 hover:text-white/60"
                      title="Copy to clipboard"
                    >{copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}</motion.button>
                    {output && (
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleDownload}
                        className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-white/30 hover:text-white/60"
                        title="Download as file"
                      ><Download className="w-3 h-3" /></motion.button>
                    )}
                  </div>
                </div>
                <textarea readOnly value={output}
                  placeholder={loading ? "Processing..." : "Result will appear here..."}
                  className="flex-1 resize-none rounded-xl bg-white/5 border border-border p-3 text-sm text-white/90 placeholder:text-white/20 outline-none font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex gap-3 min-h-0">
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Input File</span>
                <div ref={fileDropRef} onClick={openPicker}
                  className="flex-1 flex flex-col items-center justify-center rounded-xl bg-white/5 border-2 border-dashed border-white/10 hover:border-white/30 hover:bg-white/[0.07] transition-all cursor-pointer gap-3"
                >
                  {fileName ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        {textMode === "encrypt" ? <Lock className="w-5 h-5 text-blue-400" /> : <Unlock className="w-5 h-5 text-blue-400" />}
                      </div>
                      <div>
                        <p className="text-sm text-white/80 font-medium">{fileName}</p>
                        <p className="text-[10px] text-white/30">{(fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setFilePath(""); setFileName(""); setFileOutputPath(""); setOutputFilePath(""); }}
                        className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-white/20" />
                      <div className="text-center">
                        <p className="text-sm text-white/50">Click to select a file</p>
                        <p className="text-[10px] text-white/20 mt-1">or drag & drop here</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 justify-center">
                <div className="w-6 h-6" />
              </div>
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Output</span>
                <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-white/5 border border-border gap-3">
                  {fileOutputPath ? (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-green-400" />
                      </div>
                      <p className="text-xs text-green-400/80 text-center px-4 break-all">{fileOutputPath}</p>
                      <button onClick={handleFileDownload}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors text-xs font-medium"
                      ><Download className="w-3.5 h-3.5" />Open in Folder</button>
                    </>
                  ) : (
                    <>
                      <Shield className="w-10 h-10 text-white/20" />
                      <div className="text-center px-4">
                        <p className="text-sm text-white/40">
                          {textMode === "encrypt" ? "File will be encrypted with AES-256-GCM + Argon2id KDF" : "Provide the .enc file and original passphrase to decrypt"}
                        </p>
                        <p className="text-[10px] text-white/10 mt-2">Each operation generates a unique random salt and nonce</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
              >{error}</motion.div>
            )}
          </AnimatePresence>

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
