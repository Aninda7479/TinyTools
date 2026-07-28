import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, X, ArrowDown } from "lucide-react";

const springTransition = { type: "spring", stiffness: 300, damping: 30 };

interface FileInfo {
  name: string;
  path: string;
  size: number;
  preview?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function ImageCompress() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [quality, setQuality] = useState(80);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );

    const newFiles: FileInfo[] = droppedFiles.map((file) => ({
      name: file.name,
      path: (file as unknown as { path?: string }).path || "",
      size: file.size,
      preview: URL.createObjectURL(file),
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div>
        <h2 className="text-xl font-semibold">Image Compress</h2>
        <p className="text-sm text-white/40 mt-1">
          Reduce image file sizes with adjustable quality
        </p>
      </div>

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        animate={{
          borderColor: isDragging ? "rgba(96, 165, 250, 0.5)" : "rgba(255,255,255,0.1)",
          backgroundColor: isDragging ? "rgba(96, 165, 250, 0.05)" : "rgba(255,255,255,0.02)",
        }}
        transition={springTransition}
        className="border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-white/20 transition-colors"
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <Upload className="w-8 h-8 text-white/30" />
        <div className="text-center">
          <p className="text-sm text-white/60">
            Drop images here or click to browse
          </p>
          <p className="text-xs text-white/30 mt-1">
            Supports JPG, PNG, WebP
          </p>
        </div>
        <input
          id="file-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const selected = Array.from(e.target.files || []);
            const newFiles: FileInfo[] = selected.map((file) => ({
              name: file.name,
              path: (file as unknown as { path?: string }).path || "",
              size: file.size,
              preview: URL.createObjectURL(file),
            }));
            setFiles((prev) => [...prev, ...newFiles]);
          }}
        />
      </motion.div>

      {files.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springTransition}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-4">
            <label className="text-sm text-white/60">Quality</label>
            <input
              type="range"
              min="10"
              max="100"
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
            />
            <span className="text-sm text-white/40 w-8 text-right">
              {quality}%
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {files.map((file, i) => (
              <motion.div
                key={`${file.name}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={springTransition}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-border"
              >
                {file.preview && (
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{file.name}</p>
                  <p className="text-xs text-white/40">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={springTransition}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
          >
            <ArrowDown className="w-4 h-4" />
            Compress {files.length} image{files.length > 1 ? "s" : ""}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
