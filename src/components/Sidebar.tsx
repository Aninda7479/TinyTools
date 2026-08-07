import { motion } from "framer-motion";
import {
  Sparkles, Brain, Shield, Scissors, Image, Image as ImageIcon, RefreshCw, QrCode,
  Wand2, Layers, FileText, Key, Binary, Hash, Lock, Radio,
  Paintbrush, Minimize, FileUp, Stamp, ArrowUpDown, RotateCw, Crop,
  Trash2, ImagePlus, Unlock, Minimize2, Info, Eye,
  Gauge, Zap, SplitSquareHorizontal, Combine, Palette,
  ShieldCheck, FileLock, Film, Merge, Volume2, Download, Globe,
  Calculator, Activity, Clock, Ruler, Sigma,
} from "lucide-react";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

export type Tool =
  | "welcome" | "about"
  | "ai" | "editing" | "compress" | "conversion" | "process" | "batch"
  | "qr" | "pdf"
  | "privacy" | "password" | "encryption"
  | "encoder" | "hasher"
  | "portal-send" | "portal-receive" | "video"
  | "global-share" | "global-receive"
  | "calc-sci" | "calc-graph" | "calc-time" | "calc-unit" | "calc-equation"
  | "cat-image" | "cat-qr" | "cat-pdf" | "cat-security" | "cat-encode" | "cat-hash" | "cat-share" | "cat-video" | "cat-calculator";

export interface Feature {
  icon: typeof Brain;
  title: string;
  tag: string;
  tool: Tool;
  sub?: string;
}

export interface SidebarCategory {
  id: Tool;
  icon: typeof Image;
  label: string;
  features: Feature[];
}

export const sidebarCategories: SidebarCategory[] = [
  {
    id: "cat-image",
    icon: Image,
    label: "Image",
    features: [
      { icon: Brain, title: "BG Remove", tag: "AI", tool: "ai", sub: "bg-remove" },
      { icon: Zap, title: "Upscale", tag: "AI", tool: "ai", sub: "upscale" },
      { icon: Paintbrush, title: "Inpaint", tag: "AI", tool: "ai", sub: "inpaint" },
      { icon: Palette, title: "Sepia Tone", tag: "AI", tool: "ai", sub: "sepia" },
      { icon: Gauge, title: "Smart Sharpen", tag: "AI", tool: "ai", sub: "smart-sharpen" },
      { icon: Eye, title: "Depth Blur", tag: "AI", tool: "ai", sub: "depth-blur" },
      { icon: Shield, title: "Strip Metadata", tag: "Privacy", tool: "privacy", sub: "strip-metadata" },
      { icon: FileLock, title: "Redact Regions", tag: "Privacy", tool: "privacy", sub: "redact" },
      { icon: Stamp, title: "Watermark", tag: "Privacy", tool: "privacy", sub: "watermark" },
      { icon: Scissors, title: "Smart Crop", tag: "Edit", tool: "editing", sub: "crop" },
      { icon: SplitSquareHorizontal, title: "Expand Canvas", tag: "Edit", tool: "editing", sub: "expand" },
      { icon: Combine, title: "Split Image", tag: "Edit", tool: "editing", sub: "split" },
      { icon: Layers, title: "Stitch Images", tag: "Edit", tool: "editing", sub: "stitch" },
      { icon: Minimize, title: "Compress", tag: "Convert", tool: "compress" },
      { icon: RefreshCw, title: "Format Convert", tag: "Convert", tool: "conversion", sub: "convert" },
      { icon: FileUp, title: "HEIC Convert", tag: "Convert", tool: "conversion", sub: "heic" },
      { icon: Wand2, title: "Smart Compress", tag: "Convert", tool: "conversion", sub: "compress" },
      { icon: Paintbrush, title: "Raster to SVG", tag: "Convert", tool: "conversion", sub: "vectorize" },
      { icon: Wand2, title: "Resize", tag: "Process", tool: "process", sub: "resize" },
      { icon: Palette, title: "Grayscale", tag: "Process", tool: "process", sub: "grayscale" },
      { icon: RotateCw, title: "Rotate", tag: "Process", tool: "process", sub: "rotate" },
      { icon: Scissors, title: "Flip", tag: "Process", tool: "process", sub: "flip" },
      { icon: Eye, title: "Blur", tag: "Process", tool: "process", sub: "blur" },
      { icon: Gauge, title: "Sharpen", tag: "Process", tool: "process", sub: "sharpen" },
      { icon: Layers, title: "Batch Process", tag: "Batch", tool: "batch" },
    ],
  },
  {
    id: "cat-video",
    icon: Film,
    label: "Video",
    features: [
      { icon: Info, title: "Video Info", tag: "Info", tool: "video", sub: "info" },
      { icon: ArrowUpDown, title: "Compress", tag: "Compress", tool: "video", sub: "compress" },
      { icon: ArrowUpDown, title: "Resize", tag: "Compress", tool: "video", sub: "resize" },
      { icon: RefreshCw, title: "Aspect Ratio", tag: "Compress", tool: "video", sub: "aspect" },
      { icon: Scissors, title: "Trim / Cut", tag: "Edit", tool: "video", sub: "trim" },
      { icon: Merge, title: "Merge Clips", tag: "Edit", tool: "video", sub: "merge" },
      { icon: Crop, title: "Crop Frame", tag: "Edit", tool: "video", sub: "crop" },
      { icon: RotateCw, title: "Rotate", tag: "Edit", tool: "video", sub: "rotate" },
      { icon: RefreshCw, title: "Mirror / Flip", tag: "Edit", tool: "video", sub: "mirror" },
      { icon: Film, title: "Convert Format", tag: "Format", tool: "video", sub: "format" },
      { icon: Volume2, title: "Extract Audio", tag: "Audio", tool: "video", sub: "extract-audio" },
      { icon: Volume2, title: "Mute Video", tag: "Audio", tool: "video", sub: "mute" },
      { icon: Volume2, title: "Replace Audio", tag: "Audio", tool: "video", sub: "replace-audio" },
      { icon: ImageIcon, title: "Video → GIF", tag: "GIF", tool: "video", sub: "to-gif" },
      { icon: Film, title: "GIF → Video", tag: "GIF", tool: "video", sub: "from-gif" },
      { icon: Gauge, title: "Speed Control", tag: "Advanced", tool: "video", sub: "speed" },
      { icon: Stamp, title: "Watermark", tag: "Advanced", tool: "video", sub: "watermark" },
      { icon: Scissors, title: "Burn Subtitles", tag: "Advanced", tool: "video", sub: "subtitles" },
      { icon: ImageIcon, title: "Frame Extract", tag: "Advanced", tool: "video", sub: "frames" },
    ],
  },
  {
    id: "cat-qr",
    icon: QrCode,
    label: "QR Code",
    features: [
      { icon: QrCode, title: "QR Generator", tag: "Create", tool: "qr" },
    ],
  },
  {
    id: "cat-pdf",
    icon: FileText,
    label: "PDF",
    features: [
      { icon: Info, title: "PDF Info", tag: "Info", tool: "pdf", sub: "info" },
      { icon: Layers, title: "Merge PDFs", tag: "Pages", tool: "pdf", sub: "merge" },
      { icon: Scissors, title: "Split & Extract", tag: "Pages", tool: "pdf", sub: "split" },
      { icon: ArrowUpDown, title: "Reorder Pages", tag: "Pages", tool: "pdf", sub: "reorder" },
      { icon: RotateCw, title: "Rotate Pages", tag: "Pages", tool: "pdf", sub: "rotate" },
      { icon: Crop, title: "Crop Pages", tag: "Pages", tool: "pdf", sub: "crop" },
      { icon: Trash2, title: "Delete Pages", tag: "Pages", tool: "pdf", sub: "delete" },
      { icon: ImagePlus, title: "Images to PDF", tag: "Convert", tool: "pdf", sub: "img2pdf" },
      { icon: FileText, title: "Extract Text", tag: "Convert", tool: "pdf", sub: "text" },
      { icon: Lock, title: "Encrypt PDF", tag: "Security", tool: "pdf", sub: "encrypt" },
      { icon: Unlock, title: "Decrypt PDF", tag: "Security", tool: "pdf", sub: "decrypt" },
      { icon: Minimize2, title: "Compress PDF", tag: "Enhance", tool: "pdf", sub: "compress" },
      { icon: Minimize2, title: "Flatten PDF", tag: "Enhance", tool: "pdf", sub: "flatten" },
      { icon: Stamp, title: "Add Watermark", tag: "Enhance", tool: "pdf", sub: "watermark" },
      { icon: Hash, title: "Page Numbers", tag: "Enhance", tool: "pdf", sub: "pagenum" },
    ],
  },
  {
    id: "cat-security",
    icon: Lock,
    label: "Security",
    features: [
      { icon: Key, title: "Password Generator", tag: "Generate", tool: "password" },
      { icon: Lock, title: "AES-256-GCM", tag: "Text", tool: "encryption", sub: "text-aes" },
      { icon: Lock, title: "ChaCha20-Poly1305", tag: "Text", tool: "encryption", sub: "text-chacha" },
      { icon: Hash, title: "Classic Ciphers", tag: "Text", tool: "encryption", sub: "text-classic" },
      { icon: FileLock, title: "File AES Encrypt", tag: "File", tool: "encryption", sub: "file-aes" },
      { icon: FileLock, title: "File ChaCha Encrypt", tag: "File", tool: "encryption", sub: "file-chacha" },
    ],
  },
  {
    id: "cat-encode",
    icon: Binary,
    label: "Encode / Decode",
    features: [
      { icon: Binary, title: "Base64", tag: "Encode", tool: "encoder", sub: "base64" },
      { icon: Binary, title: "Base64URL", tag: "Encode", tool: "encoder", sub: "base64url" },
      { icon: Binary, title: "Base32", tag: "Encode", tool: "encoder", sub: "base32" },
      { icon: Binary, title: "Base58", tag: "Encode", tool: "encoder", sub: "base58" },
      { icon: Binary, title: "Hex", tag: "Encode", tool: "encoder", sub: "hex" },
      { icon: Binary, title: "URL Encode", tag: "Encode", tool: "encoder", sub: "url" },
      { icon: Binary, title: "HTML Entities", tag: "Encode", tool: "encoder", sub: "html" },
      { icon: Binary, title: "Unicode Escape", tag: "Encode", tool: "encoder", sub: "unicode" },
      { icon: Binary, title: "JWT Decoder", tag: "Encode", tool: "encoder", sub: "jwt" },
      { icon: Binary, title: "Morse Code", tag: "Encode", tool: "encoder", sub: "morse" },
      { icon: Binary, title: "Binary", tag: "Encode", tool: "encoder", sub: "binary" },
      { icon: Binary, title: "Octal", tag: "Encode", tool: "encoder", sub: "octal" },
    ],
  },
  {
    id: "cat-hash",
    icon: Hash,
    label: "Hash",
    features: [
      { icon: Hash, title: "Text Hash", tag: "Hash", tool: "hasher", sub: "text-hash" },
      { icon: Hash, title: "File Hash", tag: "Hash", tool: "hasher", sub: "file-hash" },
      { icon: Hash, title: "All Algorithms", tag: "Hash", tool: "hasher", sub: "multi-hash" },
      { icon: ShieldCheck, title: "Verify Hash", tag: "Hash", tool: "hasher", sub: "verify" },
    ],
  },
  {
    id: "cat-share",
    icon: Radio,
    label: "Share",
    features: [
      { icon: Globe, title: "Global Share", tag: "P2P", tool: "global-share" },
      { icon: Download, title: "Global Receive", tag: "P2P", tool: "global-receive" },
      { icon: QrCode, title: "Local Web Portal Send", tag: "Network", tool: "portal-send" },
      { icon: Download, title: "Local Web Portal Receive", tag: "Network", tool: "portal-receive" },
    ],
  },
  {
    id: "cat-calculator",
    icon: Calculator,
    label: "Calculator",
    features: [
      { icon: Calculator, title: "Scientific Calculator", tag: "Math", tool: "calc-sci" },
      { icon: Activity, title: "Graph Calculator", tag: "Math", tool: "calc-graph" },
      { icon: Clock, title: "Time Calculator", tag: "Math", tool: "calc-time" },
      { icon: Ruler, title: "Unit Calculator", tag: "Math", tool: "calc-unit" },
      { icon: Sigma, title: "Equation Calculator", tag: "Math", tool: "calc-equation" },
    ],
  },
];

interface SidebarProps {
  activeTool: Tool;
  onToolSelect: (tool: Tool, sub?: string) => void;
}

const categoryIds = new Set(sidebarCategories.map((c) => c.id));

export default function Sidebar({ activeTool, onToolSelect }: SidebarProps) {
  return (
    <aside className="w-16 flex flex-col items-center py-4 gap-1.5 border-r border-border bg-surface/50 backdrop-blur-xl">
      {/* <div className="flex items-center justify-center w-10 h-10 mb-3">
        <Sparkles className="w-5 h-5 text-blue-400" />
      </div> */}

      {sidebarCategories.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeTool === cat.id || (categoryIds.has(activeTool) && activeTool === cat.id);
        return (
          <motion.button
            key={cat.id}
            onClick={() => onToolSelect(cat.id)}
            className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
              isActive ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            title={cat.label}
          >
            {isActive && (
              <motion.div layoutId="sidebar-indicator"
                className="absolute inset-0 rounded-xl bg-white/10 border border-white/10"
                transition={spring}
              />
            )}
            <Icon className="w-4 h-4 relative z-10" />
          </motion.button>
        );
      })}

      <div className="mt-auto flex flex-col gap-1.5">
        <motion.button
          onClick={() => onToolSelect("welcome")}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
            activeTool === "welcome" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={spring}
          title="Home"
        >
          <Sparkles className="w-5 h-5" />
        </motion.button>

        <motion.button
          onClick={() => onToolSelect("about")}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
            activeTool === "about" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={spring}
          title="About TinyTools"
        >
          <Info className="w-5 h-5" />
        </motion.button>
      </div>
    </aside>
  );
}
