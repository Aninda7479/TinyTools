import { motion } from "framer-motion";
import { Sparkles, Image, QrCode, Wand2 } from "lucide-react";

const springTransition = { type: "spring", stiffness: 300, damping: 30 };

const features: { icon: typeof Image; title: string; description: string; tool: Tool }[] = [
  {
    icon: Image,
    title: "Image Compress",
    description: "Reduce file sizes while maintaining quality",
    tool: "compress",
  },
  {
    icon: QrCode,
    title: "QR Generator",
    description: "Generate QR codes from any text or URL",
    tool: "qr",
  },
  {
    icon: Wand2,
    title: "Image Process",
    description: "Resize, crop, filter and transform images",
    tool: "process",
  },
];

type Tool = "welcome" | "compress" | "qr" | "process";

export default function Welcome({ onNavigate }: { onNavigate: (tool: Tool) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springTransition}
        className="flex items-center gap-3"
      >
        <Sparkles className="w-8 h-8 text-blue-400" />
        <h1 className="text-3xl font-semibold tracking-tight">TinyTools</h1>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, ...springTransition }}
        className="text-white/50 text-sm"
      >
        Lightweight tools for everyday tasks
      </motion.p>

      <div className="grid grid-cols-3 gap-4 mt-4">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.button
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, ...springTransition }}
              onClick={() => onNavigate(feature.tool)}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-border bg-surface/50 backdrop-blur-xl w-48 hover:border-border-hover hover:bg-surface-hover transition-colors cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Icon className="w-5 h-5 text-white/70" />
              </div>
              <span className="text-sm font-medium">{feature.title}</span>
              <span className="text-xs text-white/40 text-center leading-relaxed">
                {feature.description}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
