import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, Copy, Check, FileUp, Save } from "lucide-react";
import * as api from "../lib/tauri";

type SubTool =
  | "base64" | "base64url" | "base32" | "base58" | "hex"
  | "url" | "html" | "unicode" | "jwt" | "morse" | "binary" | "octal";

const FILE_SUBTOOLS: SubTool[] = ["base64", "base64url", "base32", "base58", "hex", "binary", "octal"];

const subTools: { id: SubTool; label: string; keywords: string }[] = [
  { id: "base64", label: "Base64", keywords: "base64 standard encode decode" },
  { id: "base64url", label: "Base64URL", keywords: "base64url url-safe encode decode" },
  { id: "base32", label: "Base32", keywords: "base32 encode decode" },
  { id: "base58", label: "Base58", keywords: "base58 bitcoin crypto encode decode" },
  { id: "hex", label: "Hex", keywords: "hexadecimal base16 encode decode" },
  { id: "url", label: "URL Encode", keywords: "url percent encoding uri" },
  { id: "html", label: "HTML Entities", keywords: "html entities amp lt gt special characters" },
  { id: "unicode", label: "Unicode Escape", keywords: "unicode utf-8 escape sequences uxxxx" },
  { id: "jwt", label: "JWT Decoder", keywords: "jwt json web token header payload" },
  { id: "morse", label: "Morse Code", keywords: "morse code dots dashes translate" },
  { id: "binary", label: "Binary", keywords: "binary base2 01 text converter" },
  { id: "octal", label: "Octal", keywords: "octal base8 text converter" },
];

const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text);
};

export default function EncoderDecoderPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [active, setActive] = useState<SubTool>((defaultSub as SubTool) || "base64");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [direction, setDirection] = useState<"encode" | "decode">("encode");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [jwtResult, setJwtResult] = useState<api.JwtParts | null>(null);
  const [fileMode, setFileMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<api.FileInfo | null>(null);
  const [saveMsg, setSaveMsg] = useState("");

  const supportsFile = FILE_SUBTOOLS.includes(active);
  const isFileEncode = fileMode && direction === "encode";
  const isFileDecode = fileMode && direction === "decode";

  const run = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setOutput("");
    setSaveMsg("");
    setJwtResult(null);
    try {
      let result = "";
      switch (active) {
        case "base64": result = direction === "encode" ? await api.encodeBase64(input) : await api.decodeBase64(input); break;
        case "base64url": result = direction === "encode" ? await api.encodeBase64Url(input) : await api.decodeBase64Url(input); break;
        case "base32": result = direction === "encode" ? await api.encodeBase32(input) : await api.decodeBase32(input); break;
        case "base58": result = direction === "encode" ? await api.encodeBase58(input) : await api.decodeBase58(input); break;
        case "hex": result = direction === "encode" ? await api.encodeHex(input) : await api.decodeHex(input); break;
        case "url": result = direction === "encode" ? await api.encodeUrl(input) : await api.decodeUrl(input); break;
        case "html": result = direction === "encode" ? await api.encodeHtml(input) : await api.decodeHtml(input); break;
        case "unicode": result = direction === "encode" ? await api.encodeUnicode(input) : await api.decodeUnicode(input); break;
        case "jwt": {
          const jwt = await api.decodeJwt(input);
          setJwtResult(jwt);
          result = JSON.stringify({ header: JSON.parse(jwt.header), payload: JSON.parse(jwt.payload) }, null, 2);
          break;
        }
        case "morse": result = direction === "encode" ? await api.textToMorse(input) : await api.morseToText(input); break;
        case "binary": result = direction === "encode" ? await api.textToBinary(input) : await api.binaryToText(input); break;
        case "octal": result = direction === "encode" ? await api.textToOctal(input) : await api.octalToText(input); break;
      }
      setOutput(result);
    } catch (e: any) {
      setError(e?.toString() || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await copyToClipboard(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const swap = () => {
    setInput(output);
    setOutput("");
    setSaveMsg("");
    setDirection(d => d === "encode" ? "decode" : "encode");
  };

  const handleEncodeFile = async () => {
    const file = await api.pickFile();
    if (!file) return;
    setSelectedFile(file);
    setLoading(true);
    setError("");
    setOutput("");
    setSaveMsg("");
    try {
      const result = await api.encodeFile(file.path, active);
      setOutput(result);
    } catch (e: any) {
      setError(e?.toString() || "Encode failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDecodeTextToFile = async () => {
    if (!input.trim()) return;
    const outPath = await api.saveFile("decoded.bin");
    if (!outPath) return;
    setLoading(true);
    setError("");
    setSaveMsg("");
    try {
      const path = await api.decodeTextToFile(input, outPath, active);
      setSaveMsg(`Decoded to: ${path}`);
    } catch (e: any) {
      setError(e?.toString() || "Decode failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDecodeFileToFile = async () => {
    if (!selectedFile) return;
    const outPath = await api.saveFile(`decoded`);
    if (!outPath) return;
    setLoading(true);
    setError("");
    setSaveMsg("");
    try {
      const path = await api.decodeFile(selectedFile.path, outPath, active);
      setSaveMsg(`Decoded to: ${path}`);
    } catch (e: any) {
      setError(e?.toString() || "Decode failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOutput = async () => {
    if (!output) return;
    const outPath = await api.saveFile("output.txt");
    if (!outPath) return;
    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(outPath, output);
      setSaveMsg(`Saved to: ${outPath}`);
    } catch (e: any) {
      setError(e?.toString() || "Save failed");
    }
  };

  const needsDirection = !["jwt"].includes(active);

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <h2 className="text-xl font-semibold">Encoder / Decoder</h2>
        <p className="text-sm text-white/40 mt-1">Encode and decode data in standard formats</p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-3 gap-1.5">
            {subTools.map((t) => (
              <button key={t.id} onClick={() => { setActive(t.id); setOutput(""); setJwtResult(null); setError(""); setSaveMsg(""); setFileMode(false); setSelectedFile(null); }}
                className={`px-2 py-1.5 rounded-lg text-[11px] transition-colors ${active === t.id ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
              >{t.label}</button>
            ))}
          </div>

          {needsDirection && (
            <div className="flex gap-2">
              {(["encode", "decode"] as const).map((d) => (
                <button key={d} onClick={() => { setDirection(d); setOutput(""); setSaveMsg(""); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${direction === d ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                >{d === "encode" ? "Encode" : "Decode"}</button>
              ))}
              {supportsFile && (
                <button onClick={() => { setFileMode(!fileMode); setOutput(""); setSaveMsg(""); setSelectedFile(null); }}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-colors ${fileMode ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-white/50 border border-transparent hover:bg-white/10"}`}
                >File</button>
              )}
            </div>
          )}

          {active === "jwt" && (
            <div className="p-3 rounded-xl bg-white/5 border border-border">
              <p className="text-xs text-white/40 mb-2">Paste a JWT token to decode its header, payload, and signature offline.</p>
              {jwtResult && (
                <div className="space-y-2 mt-3">
                  <div>
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Header</span>
                    <pre className="text-[11px] text-green-400 bg-black/30 rounded-lg p-2 mt-1 overflow-auto max-h-24">{jwtResult.header}</pre>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Payload</span>
                    <pre className="text-[11px] text-blue-400 bg-black/30 rounded-lg p-2 mt-1 overflow-auto max-h-40">{jwtResult.payload}</pre>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Signature</span>
                    <p className="text-[11px] text-yellow-400 bg-black/30 rounded-lg p-2 mt-1 break-all">{jwtResult.signature}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {isFileEncode ? (
            <button onClick={handleEncodeFile} disabled={loading}
              className="w-full py-3 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            ><FileUp className="w-4 h-4" />{loading ? "Encoding..." : "Pick File to Encode"}</button>
          ) : isFileDecode ? (
            <div className="flex flex-col gap-2">
              <button onClick={() => { api.pickFile().then(f => f && setSelectedFile(f)); }}
                className="w-full py-2.5 rounded-xl bg-white/5 text-white/60 border border-dashed border-white/20 hover:bg-white/10 transition-colors text-xs font-medium flex items-center justify-center gap-2"
              ><FileUp className="w-3.5 h-3.5" />{selectedFile ? selectedFile.name : "Pick Encoded File"}</button>
              {selectedFile && (
                <button onClick={handleDecodeFileToFile} disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                ><Save className="w-4 h-4" />{loading ? "Decoding..." : "Decode & Save As..."}</button>
              )}
            </div>
          ) : (
            <button onClick={run} disabled={loading || !input.trim()}
              className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-40 text-sm font-medium"
            >{loading ? "Processing..." : direction === "encode" ? "Encode" : "Decode"}</button>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex-1 flex gap-3 min-h-0">
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">
                  {isFileEncode ? `Input File${selectedFile ? `: ${selectedFile.name}` : ""}` : "Input"}
                </span>
                {isFileDecode && (
                  <button onClick={handleDecodeTextToFile} disabled={loading || !input.trim()}
                    className="text-[10px] text-purple-400/60 hover:text-purple-400 flex items-center gap-1"
                  ><Save className="w-3 h-3" /> Save Decoded to File</button>
                )}
              </div>
              {isFileEncode ? (
                <div className="flex-1 flex items-center justify-center rounded-xl bg-white/5 border border-dashed border-white/20 p-6">
                  {selectedFile ? (
                    <div className="text-center">
                      <p className="text-sm text-white/70">{selectedFile.name}</p>
                      <p className="text-[11px] text-white/30 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <p className="text-xs text-white/30">Click "Pick File to Encode"</p>
                  )}
                </div>
              ) : (
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder={isFileDecode ? "Paste encoded text, or pick a file..." : "Enter text to encode/decode..."}
                  className="flex-1 resize-none rounded-xl bg-white/5 border border-border p-3 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover transition-colors font-mono"
                />
              )}
            </div>
            <div className="flex flex-col gap-2 justify-center">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={swap} disabled={fileMode}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white/70 disabled:opacity-20"
              ><ArrowRightLeft className="w-3.5 h-3.5" /></motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleCopy}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white/70"
              >{copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}</motion.button>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Output</span>
                {((isFileEncode && output) || (!fileMode && output)) && (
                  <button onClick={handleSaveOutput}
                    className="text-[10px] text-purple-400/60 hover:text-purple-400 flex items-center gap-1"
                  ><Save className="w-3 h-3" /> Save to File</button>
                )}
              </div>
              <textarea readOnly value={output || saveMsg}
                placeholder="Result will appear here..."
                className="flex-1 resize-none rounded-xl bg-white/5 border border-border p-3 text-sm text-white/90 placeholder:text-white/20 outline-none font-mono"
              />
            </div>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
            >{error}</motion.div>
          )}

          <div className="text-[10px] text-white/20 text-center">
            {active === "jwt" ? "JWT tokens are decoded locally — no data leaves your device" : "All transformations happen locally in Rust"}
          </div>
        </div>
      </div>
    </div>
  );
}
