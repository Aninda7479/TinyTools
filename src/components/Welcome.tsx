import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Brain, Shield, Scissors, Image, RefreshCw, QrCode, Wand2, Layers, FileText, Key, Binary, Hash, Lock } from "lucide-react";
import type { Tool } from "./Sidebar";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const features: { icon: typeof Brain; title: string; description: string; tool: Tool; keywords: string }[] = [
  { icon: Brain, title: "AI & Smart Tools", description: "Background removal, upscaling, colorization, face enhance, depth blur", tool: "ai", keywords: "ai artificial intelligence remove background upscale colorize face blur depth" },
  { icon: Shield, title: "Privacy & Metadata", description: "EXIF stripper, redactor, invisible watermarks", tool: "privacy", keywords: "privacy metadata exif strip redact watermark protect sensitive" },
  { icon: Scissors, title: "Editing & Layout", description: "Smart crop, canvas expand, image splitter, stitcher", tool: "editing", keywords: "edit crop resize canvas split stitch layout combine" },
  { icon: Image, title: "Image Compress", description: "Reduce file sizes with adjustable quality", tool: "compress", keywords: "compress reduce size quality jpeg jpg optimize small" },
  { icon: RefreshCw, title: "Compression & Conversion", description: "Format converter, HEIC, vectorize, smart compress", tool: "conversion", keywords: "convert format heic svg vectorize compress transform change" },
  { icon: QrCode, title: "QR Code Generator", description: "Custom dots, gradients, logos, frames, export SVG/PNG/WebP", tool: "qr", keywords: "qr code generator barcode scan custom gradient logo frame" },
  { icon: Key, title: "Password Generator", description: "CSPRNG passwords, passphrases, PINs, pronounceable, bulk export", tool: "password", keywords: "password generator random passphrase pin diceware secure crypto csprng bulk" },
  { icon: Wand2, title: "Image Process", description: "Resize, grayscale, rotate, flip, blur, sharpen", tool: "process", keywords: "process resize grayscale rotate flip blur sharpen filter adjust" },
  { icon: Layers, title: "Batch Engine", description: "Process 100+ files in parallel with Rust multi-threading", tool: "batch", keywords: "batch bulk parallel multiple files process speed rust" },
  { icon: FileText, title: "PDF Tools", description: "Merge, split, crop, rotate, encrypt, watermark, compress PDFs", tool: "pdf", keywords: "pdf merge split crop rotate encrypt watermark compress text extract pages document" },
  { icon: Binary, title: "Encoder / Decoder", description: "Base64, Base32, Base58, Hex, URL, HTML, Unicode, JWT, Morse, Binary", tool: "encoder", keywords: "encode decode base64 base32 base58 hex url html unicode jwt morse binary octal" },
  { icon: Hash, title: "Hasher", description: "MD5, SHA-256, SHA-512, BLAKE3, CRC32, XXH3, file integrity", tool: "hasher", keywords: "hash checksum md5 sha blake3 crc32 xxh3 file integrity verify" },
  { icon: Lock, title: "Encryption", description: "AES-256-GCM, ChaCha20, ROT13, Caesar, Vigenère, file encryption", tool: "encryption", keywords: "encrypt decrypt aes chacha20 rot13 caesar vigenere xor cipher file password" },
];

export default function Welcome({ onNavigate }: { onNavigate: (tool: Tool) => void }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return features;
    const q = query.toLowerCase();
    return features.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.keywords.includes(q)
    );
  }, [query]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring}
        className="flex items-center gap-3"
      >
        <Sparkles className="w-8 h-8 text-blue-400" />
        <h1 className="text-3xl font-semibold tracking-tight">TinyTools</h1>
      </motion.div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, ...spring }}
        className="text-white/50 text-sm"
      >
        Lightweight tools for everyday tasks — 100% offline
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, ...spring }}
        className="relative w-full max-w-xs"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Search tools..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-surface/50 backdrop-blur-xl text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-border-hover transition-colors"
        />
      </motion.div>

      <div className="grid grid-cols-4 gap-3 mt-4 max-w-3xl">
        {filtered.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.button
              key={feature.title}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: query ? 0 : 0.15 + i * 0.05, ...spring }}
              onClick={() => onNavigate(feature.tool)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-surface/50 backdrop-blur-xl hover:border-border-hover hover:bg-surface-hover transition-colors cursor-pointer text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                <Icon className="w-4 h-4 text-white/70" />
              </div>
              <span className="text-xs font-medium text-center">{feature.title}</span>
              <span className="text-[10px] text-white/30 text-center leading-relaxed">
                {feature.description}
              </span>
            </motion.button>
          );
        })}
      </div>

      {query && filtered.length === 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-white/30 mt-4">
          No tools match "{query}"
        </motion.p>
      )}
    </div>
  );
}
