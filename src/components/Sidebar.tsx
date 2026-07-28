import { motion } from "framer-motion";
import { Sparkles, Image, QrCode, Wand2, Brain, Shield, Scissors, RefreshCw, Layers } from "lucide-react";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

export type Tool = "welcome" | "compress" | "qr" | "process" | "ai" | "privacy" | "editing" | "conversion" | "batch";

interface SidebarProps {
  activeTool: Tool;
  onToolSelect: (tool: Tool) => void;
}

const tools: { id: Tool; icon: typeof Image; label: string }[] = [
  { id: "ai", icon: Brain, label: "AI Tools" },
  { id: "privacy", icon: Shield, label: "Privacy" },
  { id: "editing", icon: Scissors, label: "Editing" },
  { id: "compress", icon: Image, label: "Compress" },
  { id: "conversion", icon: RefreshCw, label: "Convert" },
  { id: "qr", icon: QrCode, label: "QR Code" },
  { id: "process", icon: Wand2, label: "Process" },
  { id: "batch", icon: Layers, label: "Batch" },
];

export default function Sidebar({ activeTool, onToolSelect }: SidebarProps) {
  return (
    <aside className="w-16 flex flex-col items-center py-4 gap-1.5 border-r border-border bg-surface/50 backdrop-blur-xl">
      <div className="flex items-center justify-center w-10 h-10 mb-3">
        <Sparkles className="w-5 h-5 text-blue-400" />
      </div>

      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <motion.button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
              isActive ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            title={tool.label}
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

      <div className="mt-auto">
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
      </div>
    </aside>
  );
}
