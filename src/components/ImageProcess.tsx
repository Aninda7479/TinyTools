import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Wand2, X } from "lucide-react";

const springTransition = { type: "spring", stiffness: 300, damping: 30 };

const operations = [
  { id: "resize", label: "Resize", description: "Scale to 800x800" },
  { id: "grayscale", label: "Grayscale", description: "Convert to grayscale" },
  { id: "rotate", label: "Rotate 90°", description: "Rotate clockwise" },
  { id: "flip", label: "Flip Horizontal", description: "Mirror horizontally" },
  { id: "blur", label: "Blur", description: "Apply gaussian blur" },
  { id: "sharpen", label: "Sharpen", description: "Enhance sharpness" },
];

interface SelectedFile {
  name: string;
  preview: string;
  size: number;
}

export default function ImageProcess() {
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [selectedOp, setSelectedOp] = useState("resize");
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("image/")
    );

    if (droppedFile) {
      setFile({
        name: droppedFile.name,
        preview: URL.createObjectURL(droppedFile),
        size: droppedFile.size,
      });
    }
  }, []);

  return (
    <div className="flex flex-col h-full gap-6">
      <div>
        <h2 className="text-xl font-semibold">Image Process</h2>
        <p className="text-sm text-white/40 mt-1">
          Apply transformations to your images
        </p>
      </div>

      <div className="flex gap-6 flex-1">
        <div className="flex-1 flex flex-col gap-4">
          <motion.div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            animate={{
              borderColor: isDragging
                ? "rgba(96, 165, 250, 0.5)"
                : "rgba(255,255,255,0.1)",
              backgroundColor: isDragging
                ? "rgba(96, 165, 250, 0.05)"
                : "rgba(255,255,255,0.02)",
            }}
            transition={springTransition}
            className="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-white/20 transition-colors"
            onClick={() => document.getElementById("process-file-input")?.click()}
          >
            {file ? (
              <img
                src={file.preview}
                alt={file.name}
                className="max-h-40 rounded-xl object-contain"
              />
            ) : (
              <>
                <Upload className="w-8 h-8 text-white/30" />
                <p className="text-sm text-white/60">
                  Drop an image here or click to browse
                </p>
              </>
            )}
            <input
              id="process-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) {
                  setFile({
                    name: selected.name,
                    preview: URL.createObjectURL(selected),
                    size: selected.size,
                  });
                }
              }}
            />
          </motion.div>

          {file && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-border"
            >
              <img
                src={file.preview}
                alt={file.name}
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{file.name}</p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </div>

        <div className="w-56 flex flex-col gap-3">
          <p className="text-xs text-white/40 uppercase tracking-wider">
            Operation
          </p>
          {operations.map((op) => (
            <motion.button
              key={op.id}
              onClick={() => setSelectedOp(op.id)}
              className={`text-left p-3 rounded-xl border transition-colors ${
                selectedOp === op.id
                  ? "bg-white/10 border-white/20"
                  : "bg-white/5 border-border hover:border-border-hover"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
            >
              <p className="text-sm font-medium">{op.label}</p>
              <p className="text-xs text-white/40">{op.description}</p>
            </motion.button>
          ))}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={springTransition}
            disabled={!file}
            className="mt-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Wand2 className="w-4 h-4" />
            Apply
          </motion.button>
        </div>
      </div>
    </div>
  );
}
