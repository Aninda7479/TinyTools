import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { MonitorDown, Upload, X, Play } from "lucide-react";
import { isTauri, pickFiles } from "../lib/tauri";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

interface FileItem {
  name: string;
  path: string;
  size: number;
}

export default function ToolPage({
  title,
  description,
  children,
  onProcess,
  processLabel,
  multiFile = false,
  renderPreview,
  allowWeb = false,
  onFilesChange,
  previewNode,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onProcess: (files: FileItem[]) => void;
  processLabel?: string;
  multiFile?: boolean;
  renderPreview?: (file: FileItem) => React.ReactNode;
  allowWeb?: boolean;
  onFilesChange?: (files: FileItem[]) => void;
  previewNode?: React.ReactNode;
}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(async () => {
    try {
      if ((window as any).__TAURI_INTERNALS__) {
        const filters = [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic"] }];
        const picked = await pickFiles(filters);
        if (picked.length === 0) return;
        const newFiles = picked.map((f) => ({ name: f.name, path: f.path, size: f.size }));
        const updated = multiFile ? [...files, ...newFiles] : newFiles.slice(0, 1);
        setFiles(updated);
        onFilesChange?.(updated);
      } else {
        fileInputRef.current?.click();
      }
    } catch {
      fileInputRef.current?.click();
    }
  }, [multiFile, files, onFilesChange]);

  const handleWebFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const picked = Array.from(e.target.files);
    if (picked.length === 0) return;
    const newFiles = picked.map(f => ({
      name: f.name,
      path: URL.createObjectURL(f), // Use ObjectURL as path for web
      size: f.size
    }));
    const updated = multiFile ? [...files, ...newFiles] : newFiles.slice(0, 1);
    setFiles(updated);
    onFilesChange?.(updated);
    e.target.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      openPicker();
    },
    [openPicker]
  );

  const webBlocked = !isTauri() && !allowWeb;

  return (
    <div className="relative h-full flex flex-col">
      {!isTauri() && !allowWeb && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-2xl border border-red-500/20 p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <MonitorDown className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Desktop App Required</h2>
          <p className="text-sm text-white/60 max-w-md">
            This tool requires the TinyTools native Rust backend to process files securely and efficiently. Please use the Desktop app to access this feature.
          </p>
        </div>
      )}

      <div className={`flex flex-col h-full gap-4 ${!isTauri() && !allowWeb ? "opacity-20 pointer-events-none select-none" : ""}`}>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-white/40 mt-1">{description}</p>
        </div>

      {webBlocked && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-2xl border border-red-500/20 p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <MonitorDown className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Desktop App Required</h2>
          <p className="text-sm text-white/60 max-w-md">
            This tool requires the TinyTools native Rust backend to process files securely and efficiently. Please use the Desktop app to access this feature.
          </p>
        </div>
      )}

      <div className={`flex gap-4 flex-1 min-h-0 ${webBlocked ? "opacity-20 pointer-events-none select-none" : ""}`}>
        {/* Left: Options */}
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">{children}</div>

        {/* Right: File + Preview */}
        <div className="flex-1 flex flex-col gap-4">
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            animate={{
              borderColor: isDragging ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.1)",
              backgroundColor: isDragging ? "rgba(96,165,250,0.05)" : "rgba(255,255,255,0.02)",
            }}
            transition={spring}
            className="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-white/20 transition-colors min-h-[200px]"
            onClick={openPicker}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple={multiFile}
              accept="image/*"
              onChange={handleWebFileSelect}
            />
            {files.length > 0 ? (
              previewNode ? previewNode : (
                <div className={`flex gap-3 flex-wrap w-full ${multiFile ? "" : ""}`}>
                  {files.map((f, i) => (
                    <div key={i} className={`relative group flex flex-col items-center ${renderPreview ? 'w-full h-full' : ''}`}>
                      {renderPreview ? (
                        renderPreview(f)
                      ) : (
                        <div className="w-24 h-24 rounded-xl bg-white/5 flex items-center justify-center text-[10px] text-white/40 text-center p-2 break-all">
                          {f.name}
                        </div>
                      )}
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setFiles((p) => {
                            const updated = p.filter((_, j) => j !== i);
                            onFilesChange?.(updated);
                            return updated;
                          }); 
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 z-10 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {!renderPreview && <p className="text-[10px] text-white/40 mt-1 truncate w-24 text-center">{f.name}</p>}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                <Upload className="w-8 h-8 text-white/30" />
                <p className="text-sm text-white/60">
                  Drop {multiFile ? "images" : "an image"} here or click to browse
                </p>
              </>
            )}
          </motion.div>

          {previewNode}

          {files.length > 0 && (
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
                onClick={() => onProcess(files)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
              >
                <Play className="w-4 h-4" />
                {processLabel || `Process ${files.length} file${files.length > 1 ? "s" : ""}`}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
                onClick={() => { setFiles([]); onFilesChange?.([]); }}
                className="px-6 flex items-center justify-center py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                title="Reset Image"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

export function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-white/40 whitespace-nowrap">{label}</span>
      {children}
    </div>
  );
}

export function OptionSlider({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-28 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
      />
      <span className="text-xs text-white/40 w-8 text-right">
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
    </div>
  );
}

export function OptionSelect({ value, options, onChange }: {
  value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="bg-white/5 border border-border rounded-lg px-2 py-1 text-xs text-white/70"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function OptionToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`w-8 h-4 rounded-full transition-colors relative ${checked ? "bg-blue-500" : "bg-white/10"}`}
    >
      <div className="w-3 h-3 rounded-full bg-white absolute top-0.5"
        style={{ transform: checked ? "translateX(16px)" : "translateX(2px)" }}
      />
    </button>
  );
}
