import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { Tool, Feature, SidebarCategory } from "./Sidebar";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

interface CategoryPageProps {
  category: SidebarCategory;
  onNavigate: (tool: Tool, sub?: string) => void;
}

export default function CategoryPage({ category, onNavigate }: CategoryPageProps) {
  const grouped = category.features.reduce<Record<string, Feature[]>>((acc, f) => {
    (acc[f.tag] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full gap-5">
      <div className="flex items-center gap-3 pt-2">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <category.icon className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{category.label}</h1>
          <p className="text-white/40 text-xs">{category.features.length} tools available</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {Object.entries(grouped).map(([tag, features], gi) => (
          <motion.div
            key={tag}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.05, ...spring }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-white/30 uppercase tracking-wider font-medium">{tag}</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {features.map((feature, fi) => {
                const Icon = feature.icon;
                return (
                  <motion.button
                    key={feature.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: gi * 0.05 + fi * 0.02, ...spring }}
                    onClick={() => onNavigate(feature.tool, feature.sub)}
                    className="group flex items-center gap-2.5 p-3 rounded-xl border border-border bg-surface/50 backdrop-blur-xl hover:border-border-hover hover:bg-surface-hover transition-colors cursor-pointer text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                      <Icon className="w-3.5 h-3.5 text-white/60" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-medium text-white/80 block truncate">{feature.title}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-white/10 group-hover:text-white/30 shrink-0 transition-colors" />
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
