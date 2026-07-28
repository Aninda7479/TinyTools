import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search, Brain, Shield, Scissors, Image, RefreshCw, QrCode,
  Wand2, Layers, FileText, Key, Binary, Hash, Lock, Radio,
  Paintbrush, Minimize, FileUp, Stamp, ArrowUpDown, RotateCw, Crop,
  Trash2, ImagePlus, Unlock, Minimize2, Info, Eye,
  Gauge, Zap, SplitSquareHorizontal, Combine, ChevronRight, Palette,
  ShieldCheck, FileLock, Film, Merge, VolumeX, Volume2,
  Image as ImageIcon, Subtitles,
} from "lucide-react";
import type { Tool } from "./Sidebar";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

interface Feature {
  icon: typeof Brain;
  title: string;
  tag: string;
  tool: Tool;
  sub?: string;
  keywords: string;
}

const sections: { label: string; icon: typeof Brain; features: Feature[] }[] = [
  {
    label: "Image",
    icon: Image,
    features: [
      { icon: Brain, title: "BG Remove", tag: "AI", tool: "ai", sub: "bg-remove", keywords: "background remove transparent cutout" },
      { icon: Zap, title: "Upscale", tag: "AI", tool: "ai", sub: "upscale", keywords: "upscale enhance resolution 2x 4x" },
      { icon: Paintbrush, title: "Inpaint", tag: "AI", tool: "ai", sub: "inpaint", keywords: "inpaint fill remove object repair" },
      { icon: Palette, title: "Sepia Tone", tag: "AI", tool: "ai", sub: "sepia", keywords: "sepia vintage tone warm filter" },
      { icon: Gauge, title: "Smart Sharpen", tag: "AI", tool: "ai", sub: "smart-sharpen", keywords: "sharpen edge enhance detail" },
      { icon: Eye, title: "Depth Blur", tag: "AI", tool: "ai", sub: "depth-blur", keywords: "depth blur bokeh portrait" },
      { icon: Shield, title: "Strip Metadata", tag: "Privacy", tool: "privacy", sub: "strip-metadata", keywords: "exif metadata strip remove gps" },
      { icon: FileLock, title: "Redact Regions", tag: "Privacy", tool: "privacy", sub: "redact", keywords: "redact blur pixelate hide sensitive" },
      { icon: Stamp, title: "Watermark", tag: "Privacy", tool: "privacy", sub: "watermark", keywords: "watermark text overlay copyright" },
      { icon: Scissors, title: "Smart Crop", tag: "Edit", tool: "editing", sub: "crop", keywords: "crop resize smart focus point" },
      { icon: SplitSquareHorizontal, title: "Expand Canvas", tag: "Edit", tool: "editing", sub: "expand", keywords: "expand canvas pad border padding" },
      { icon: Combine, title: "Split Image", tag: "Edit", tool: "editing", sub: "split", keywords: "split divide grid cut tiles" },
      { icon: Layers, title: "Stitch Images", tag: "Edit", tool: "editing", sub: "stitch", keywords: "stitch combine merge join" },
      { icon: Minimize, title: "Compress", tag: "Convert", tool: "compress", keywords: "compress reduce size optimize quality" },
      { icon: RefreshCw, title: "Format Convert", tag: "Convert", tool: "conversion", sub: "convert", keywords: "convert format png jpg webp" },
      { icon: FileUp, title: "HEIC Convert", tag: "Convert", tool: "conversion", sub: "heic", keywords: "heic heif convert apple iphone" },
      { icon: Wand2, title: "Smart Compress", tag: "Convert", tool: "conversion", sub: "compress", keywords: "smart compress target size quality" },
      { icon: Paintbrush, title: "Raster to SVG", tag: "Convert", tool: "conversion", sub: "vectorize", keywords: "vectorize svg trace raster" },
      { icon: Wand2, title: "Resize", tag: "Process", tool: "process", sub: "resize", keywords: "resize scale dimensions pixels" },
      { icon: Palette, title: "Grayscale", tag: "Process", tool: "process", sub: "grayscale", keywords: "grayscale black white monochrome" },
      { icon: RotateCw, title: "Rotate", tag: "Process", tool: "process", sub: "rotate", keywords: "rotate turn 90 180 270 degrees" },
      { icon: Scissors, title: "Flip", tag: "Process", tool: "process", sub: "flip", keywords: "flip mirror horizontal vertical" },
      { icon: Eye, title: "Blur", tag: "Process", tool: "process", sub: "blur", keywords: "blur gaussian soft focus" },
      { icon: Gauge, title: "Sharpen", tag: "Process", tool: "process", sub: "sharpen", keywords: "sharpen enhance edge detail" },
      { icon: Layers, title: "Batch Process", tag: "Batch", tool: "batch", keywords: "batch bulk parallel multiple files" },
    ],
  },
  {
    label: "Video",
    icon: Film,
    features: [
      { icon: Info, title: "Video Info", tag: "Info", tool: "video", sub: "info", keywords: "video info metadata codec bitrate fps" },
      { icon: ArrowUpDown, title: "Compress", tag: "Compress", tool: "video", sub: "compress", keywords: "video compress reduce size quality" },
      { icon: ArrowUpDown, title: "Resize", tag: "Compress", tool: "video", sub: "resize", keywords: "video resize 1080p 720p 480p scale" },
      { icon: RefreshCw, title: "Aspect Ratio", tag: "Compress", tool: "video", sub: "aspect", keywords: "aspect ratio 16:9 9:16 1:1 vertical horizontal" },
      { icon: Scissors, title: "Trim / Cut", tag: "Edit", tool: "video", sub: "trim", keywords: "video trim cut lossless precision" },
      { icon: Merge, title: "Merge Clips", tag: "Edit", tool: "video", sub: "merge", keywords: "video merge join combine clips" },
      { icon: Crop, title: "Crop Frame", tag: "Edit", tool: "video", sub: "crop", keywords: "video crop frame remove black bars" },
      { icon: RotateCw, title: "Rotate", tag: "Edit", tool: "video", sub: "rotate", keywords: "video rotate 90 180 270 fix sideways" },
      { icon: RefreshCw, title: "Mirror / Flip", tag: "Edit", tool: "video", sub: "mirror", keywords: "video mirror flip horizontal vertical" },
      { icon: Film, title: "Convert Format", tag: "Format", tool: "video", sub: "format", keywords: "video convert mp4 mkv webm avi mov" },
      { icon: Volume2, title: "Extract Audio", tag: "Audio", tool: "video", sub: "extract-audio", keywords: "extract audio strip mp3 wav aac" },
      { icon: VolumeX, title: "Mute Video", tag: "Audio", tool: "video", sub: "mute", keywords: "mute video remove audio silent" },
      { icon: Volume2, title: "Replace Audio", tag: "Audio", tool: "video", sub: "replace-audio", keywords: "replace audio swap custom track" },
      { icon: ImageIcon, title: "Video → GIF", tag: "GIF", tool: "video", sub: "to-gif", keywords: "video to gif high quality palette" },
      { icon: Film, title: "GIF → Video", tag: "GIF", tool: "video", sub: "from-gif", keywords: "gif to video mp4 convert lightweight" },
      { icon: Gauge, title: "Speed Control", tag: "Advanced", tool: "video", sub: "speed", keywords: "video speed slow motion fast forward" },
      { icon: Stamp, title: "Watermark", tag: "Advanced", tool: "video", sub: "watermark", keywords: "video watermark text overlay" },
      { icon: Subtitles, title: "Burn Subtitles", tag: "Advanced", tool: "video", sub: "subtitles", keywords: "burn subtitles srt vtt embed" },
      { icon: ImageIcon, title: "Frame Extract", tag: "Advanced", tool: "video", sub: "frames", keywords: "extract frames png jpg snapshot" },
    ],
  },
  {
    label: "QR Code",
    icon: QrCode,
    features: [
      { icon: QrCode, title: "QR Generator", tag: "Create", tool: "qr", keywords: "qr code generate custom logo gradient" },
    ],
  },
  {
    label: "PDF",
    icon: FileText,
    features: [
      { icon: Info, title: "PDF Info", tag: "Info", tool: "pdf", sub: "info", keywords: "pdf info metadata pages size version" },
      { icon: Layers, title: "Merge PDFs", tag: "Pages", tool: "pdf", sub: "merge", keywords: "merge combine join pdf files" },
      { icon: Scissors, title: "Split & Extract", tag: "Pages", tool: "pdf", sub: "split", keywords: "split extract separate pages" },
      { icon: ArrowUpDown, title: "Reorder Pages", tag: "Pages", tool: "pdf", sub: "reorder", keywords: "reorder rearrange sort pages" },
      { icon: RotateCw, title: "Rotate Pages", tag: "Pages", tool: "pdf", sub: "rotate", keywords: "rotate pages 90 180 270" },
      { icon: Crop, title: "Crop Pages", tag: "Pages", tool: "pdf", sub: "crop", keywords: "crop trim margins pages" },
      { icon: Trash2, title: "Delete Pages", tag: "Pages", tool: "pdf", sub: "delete", keywords: "delete remove pages" },
      { icon: ImagePlus, title: "Images to PDF", tag: "Convert", tool: "pdf", sub: "img2pdf", keywords: "images photos to pdf convert" },
      { icon: FileText, title: "Extract Text", tag: "Convert", tool: "pdf", sub: "text", keywords: "extract text content copy" },
      { icon: Lock, title: "Encrypt PDF", tag: "Security", tool: "pdf", sub: "encrypt", keywords: "encrypt password protect lock" },
      { icon: Unlock, title: "Decrypt PDF", tag: "Security", tool: "pdf", sub: "decrypt", keywords: "decrypt unlock remove password" },
      { icon: Minimize2, title: "Compress PDF", tag: "Enhance", tool: "pdf", sub: "compress", keywords: "compress reduce size optimize" },
      { icon: Minimize2, title: "Flatten PDF", tag: "Enhance", tool: "pdf", sub: "flatten", keywords: "flatten form fields" },
      { icon: Stamp, title: "Add Watermark", tag: "Enhance", tool: "pdf", sub: "watermark", keywords: "watermark text overlay" },
      { icon: Hash, title: "Page Numbers", tag: "Enhance", tool: "pdf", sub: "pagenum", keywords: "page numbers stamp header footer" },
    ],
  },
  {
    label: "Security",
    icon: Lock,
    features: [
      { icon: Key, title: "Password Generator", tag: "Generate", tool: "password", keywords: "password generator random secure passphrase pin" },
      { icon: Lock, title: "AES-256-GCM", tag: "Text", tool: "encryption", sub: "text-aes", keywords: "aes encrypt decrypt text strong" },
      { icon: Lock, title: "ChaCha20-Poly1305", tag: "Text", tool: "encryption", sub: "text-chacha", keywords: "chacha20 encrypt decrypt text modern" },
      { icon: Hash, title: "Classic Ciphers", tag: "Text", tool: "encryption", sub: "text-classic", keywords: "rot13 caesar vigenere xor cipher" },
      { icon: FileLock, title: "File AES Encrypt", tag: "File", tool: "encryption", sub: "file-aes", keywords: "aes file encrypt decrypt password" },
      { icon: FileLock, title: "File ChaCha Encrypt", tag: "File", tool: "encryption", sub: "file-chacha", keywords: "chacha file encrypt decrypt" },
    ],
  },
  {
    label: "Encode / Decode",
    icon: Binary,
    features: [
      { icon: Binary, title: "Base64", tag: "Encode", tool: "encoder", sub: "base64", keywords: "base64 encode decode standard" },
      { icon: Binary, title: "Base64URL", tag: "Encode", tool: "encoder", sub: "base64url", keywords: "base64url url-safe encode decode" },
      { icon: Binary, title: "Base32", tag: "Encode", tool: "encoder", sub: "base32", keywords: "base32 encode decode" },
      { icon: Binary, title: "Base58", tag: "Encode", tool: "encoder", sub: "base58", keywords: "base58 bitcoin crypto encode decode" },
      { icon: Binary, title: "Hex", tag: "Encode", tool: "encoder", sub: "hex", keywords: "hexadecimal base16 encode decode" },
      { icon: Binary, title: "URL Encode", tag: "Encode", tool: "encoder", sub: "url", keywords: "url percent encoding uri" },
      { icon: Binary, title: "HTML Entities", tag: "Encode", tool: "encoder", sub: "html", keywords: "html entities special characters" },
      { icon: Binary, title: "Unicode Escape", tag: "Encode", tool: "encoder", sub: "unicode", keywords: "unicode utf-8 escape sequences" },
      { icon: Binary, title: "JWT Decoder", tag: "Encode", tool: "encoder", sub: "jwt", keywords: "jwt json web token decode" },
      { icon: Binary, title: "Morse Code", tag: "Encode", tool: "encoder", sub: "morse", keywords: "morse code dots dashes translate" },
      { icon: Binary, title: "Binary", tag: "Encode", tool: "encoder", sub: "binary", keywords: "binary base2 01 text converter" },
      { icon: Binary, title: "Octal", tag: "Encode", tool: "encoder", sub: "octal", keywords: "octal base8 text converter" },
    ],
  },
  {
    label: "Hash",
    icon: Hash,
    features: [
      { icon: Hash, title: "Text Hash", tag: "Hash", tool: "hasher", sub: "text-hash", keywords: "hash text md5 sha256 blake3" },
      { icon: Hash, title: "File Hash", tag: "Hash", tool: "hasher", sub: "file-hash", keywords: "hash file integrity checksum" },
      { icon: Hash, title: "All Algorithms", tag: "Hash", tool: "hasher", sub: "multi-hash", keywords: "multi hash all algorithms md5 sha blake3" },
      { icon: ShieldCheck, title: "Verify Hash", tag: "Hash", tool: "hasher", sub: "verify", keywords: "verify hash integrity check match" },
    ],
  },
  {
    label: "Share",
    icon: Radio,
    features: [
      { icon: Radio, title: "P2P Send", tag: "Network", tool: "p2p", keywords: "p2p send file nearby device local network" },
      { icon: QrCode, title: "Web Portal", tag: "Network", tool: "p2p", keywords: "web portal qr code download browser" },
      { icon: Lock, title: "Encrypted Transfer", tag: "Network", tool: "p2p", keywords: "encrypted transfer password protected secure" },
    ],
  },
];

export default function Welcome({ onNavigate }: { onNavigate: (tool: Tool, sub?: string) => void }) {
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!query.trim()) return sections;
    const q = query.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        features: section.features.filter(
          (f) =>
            f.title.toLowerCase().includes(q) ||
            f.tag.toLowerCase().includes(q) ||
            f.keywords.includes(q)
        ),
      }))
      .filter((section) => section.features.length > 0);
  }, [query]);

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex w-full max-w-sm mx-auto pb-2">
        <Search className="absolute ml-3 mt-3 w-4 h-4 text-white/90 pointer-events-none z-10" />
        <input
          type="text"
          placeholder="Search all tools..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-surface/50 backdrop-blur-xl text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-border-hover transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-5">
        {filteredSections.map((section, si) => {
          const SectionIcon = section.icon;
          return (
            <motion.div
              key={section.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: query ? 0 : 0.05 + si * 0.04, ...spring }}
            >
              <div className="flex items-center gap-2 mb-2">
                <SectionIcon className="w-3.5 h-3.5 text-white/30" />
                <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                  {section.label}
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {section.features.map((feature, fi) => {
                  const Icon = feature.icon;
                  return (
                    <motion.button
                      key={feature.title}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: query ? 0 : fi * 0.02, ...spring }}
                      onClick={() => onNavigate(feature.tool, feature.sub)}
                      className="group flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-surface/50 backdrop-blur-xl hover:border-border-hover hover:bg-surface-hover transition-colors cursor-pointer text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                        <Icon className="w-3.5 h-3.5 text-white/60" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-white/80 truncate">
                            {feature.title}
                          </span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-white/30 shrink-0">
                            {feature.tag}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-white/10 group-hover:text-white/30 shrink-0 transition-colors" />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}

        {query && filteredSections.length === 0 && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-white/30 pt-8 text-center">
            No tools match "{query}"
          </motion.p>
        )}
      </div>
    </div>
  );
}
