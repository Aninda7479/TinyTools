import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FileText, X, Copy, Trash2, Minimize2, FolderOpen, FileWarning, CheckCircle, Shield, FileSearch, Lock, Unlock, ChevronLeft } from "lucide-react";
import { getPdfInfo, pickFiles, stripMetadata, compressPdf } from "../lib/tauri";
import { revealInFolder } from "../lib/p2p-api";

interface PdfInfoData {
  page_count: number;
  file_size: number;
  file_size_str: string;
  version: string;
  version_label: string;
  title: string | null;
  author: string | null;
  subject: string | null;
  keywords: string | null;
  creator: string | null;
  producer: string | null;
  creation_date: string | null;
  modification_date: string | null;
  page_width: number;
  page_height: number;
  page_size_label: string;
  orientation: string;
  encrypted: boolean;
  has_acroform: boolean;
  printing_allowed: boolean;
  copying_allowed: boolean;
  modification_allowed: boolean;
  file_path: string;
}

interface Props {
  onBack: () => void;
}

export default function PdfInfoPage({ onBack }: Props) {
  const [files, setFiles] = useState<{ name: string; path: string }[]>([]);
  const [info, setInfo] = useState<PdfInfoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const openPicker = useCallback(async () => {
    const picked = await pickFiles([{ name: "PDFs", extensions: ["pdf"] }]);
    if (picked.length === 0) return;
    setFiles(picked.map(f => ({ name: f.name, path: f.path })));
    setInfo(null);
    setError("");
  }, []);

  useEffect(() => {
    if (files.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    getPdfInfo(files[0].path).then(r => {
      if (!cancelled) {
        if (r.success) {
          setInfo(JSON.parse(r.message));
        } else {
          setError(r.message);
        }
        setLoading(false);
      }
    }).catch((e: unknown) => {
      if (!cancelled) { setError(String(e)); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [files]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    openPicker();
  };

  const copyJson = async () => {
    if (!info) return;
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStripMetadata = async () => {
    if (!info) return;
    const outPath = info.file_path.replace(/\.pdf$/i, "-stripped.pdf");
    try {
      const r = await stripMetadata(info.file_path, outPath);
      if (r.success) {
        await revealInFolder(outPath);
      } else {
        setError(r.message);
      }
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const handleCompress = async () => {
    if (!info) return;
    const outPath = info.file_path.replace(/\.pdf$/i, "-compressed.pdf");
    try {
      const r = await compressPdf(info.file_path, outPath);
      if (r.success) {
        await revealInFolder(outPath);
      } else {
        setError(r.message);
      }
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const showInExplorer = () => revealInFolder(info!.file_path);

  const propRow = (label: string, value: string | null | undefined, icon?: React.ReactNode) => (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white/[0.02]">
      <span className="text-[11px] text-white/40 flex items-center gap-1.5">
        {icon}{label}
      </span>
      <span className="text-[11px] text-white/70 font-medium truncate max-w-[60%] text-right">{value || "—"}</span>
    </div>
  );

  if (files.length === 0 || !info) {
    return (
      <div className="flex flex-col h-full gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-4 h-4 text-white/50" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">PDF Info</h2>
            <p className="text-xs text-white/40">View page count, size, version, and metadata</p>
          </div>
        </div>
        <motion.div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          animate={{ borderColor: loading ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)" }}
          className="flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-white/20 transition-colors"
          onClick={openPicker}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <span className="animate-spin w-6 h-6 border-2 border-white/30 border-t-white/60 rounded-full" />
              <p className="text-xs text-white/40">Inspecting PDF...</p>
            </div>
          ) : (
            <>
              <FileSearch className="w-8 h-8 text-white/20" />
              <p className="text-sm text-white/40">Drop a PDF to inspect</p>
              <p className="text-xs text-white/20">or click to browse</p>
            </>
          )}
        </motion.div>
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <FileWarning className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="text-xs text-red-300/80">{error}</div>
          </div>
        )}
      </div>
    );
  }

  const fn = files[0].name;
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => { setFiles([]); setInfo(null); setError(""); }} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <X className="w-4 h-4 text-white/50" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-white/5 shrink-0">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{fn}</h2>
            <p className="text-[10px] text-white/40">PDF Document</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={copyJson}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors" title="Copy as JSON">
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={showInExplorer}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors" title="Show in Explorer">
            <FolderOpen className="w-3.5 h-3.5 text-white/40" />
          </motion.button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Quick Info + Actions */}
        <div className="w-[240px] flex flex-col gap-3 shrink-0">
          {/* Thumbnail / Skeleton */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 flex flex-col items-center gap-2">
            <div className="w-16 h-20 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center border border-white/5">
              <FileText className="w-7 h-7 text-blue-400/60" />
            </div>
            <span className="text-[10px] text-white/30">{info.version_label}</span>
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Pages</span>
              <span className="text-xs font-semibold text-white/80">{info.page_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Size</span>
              <span className="text-xs font-semibold text-white/80">{info.file_size_str}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Page</span>
              <span className="text-[10px] text-white/60 text-right max-w-[140px] truncate">{info.page_size_label}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2 space-y-1">
            <p className="text-[9px] uppercase tracking-widest text-white/20 px-2 pb-1">Actions</p>
            <ActionButton icon={Copy} label="Copy Metadata" onClick={copyJson} />
            <ActionButton icon={Trash2} label="Strip Metadata" onClick={handleStripMetadata} />
            <ActionButton icon={Minimize2} label="Compress PDF" onClick={handleCompress} />
            <ActionButton icon={FolderOpen} label="Show in Explorer" onClick={showInExplorer} />
          </div>
        </div>

        {/* Right: Property Cards */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* Document Properties */}
          <PropertyCard title="Document Properties" icon={FileText}>
            {propRow("Title", info.title)}
            {propRow("Author", info.author)}
            {propRow("Subject", info.subject)}
            {propRow("Keywords", info.keywords)}
            {propRow("Creator", info.creator)}
            {propRow("Producer", info.producer)}
            {propRow("Created", info.creation_date)}
            {propRow("Modified", info.modification_date)}
          </PropertyCard>

          {/* Page Info */}
          <PropertyCard title="Page Info" icon={FileSearch}>
            {propRow("Size", info.page_size_label)}
            {propRow("Width", `${info.page_width.toFixed(1)} pt`)}
            {propRow("Height", `${info.page_height.toFixed(1)} pt`)}
            {propRow("Orientation", info.orientation)}
            {propRow("Pages", `${info.page_count}`)}
          </PropertyCard>

          {/* Security */}
          <PropertyCard title="Security" icon={Shield}>
            {propRow("Encrypted", info.encrypted ? "Yes" : "No", info.encrypted ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3 text-emerald-400" />)}
            {propRow("AcroForm", info.has_acroform ? "Present" : "None")}
            {propRow("Printing", info.printing_allowed ? "Allowed" : "Restricted")}
            {propRow("Copying", info.copying_allowed ? "Allowed" : "Restricted")}
            {propRow("Modification", info.modification_allowed ? "Allowed" : "Restricted")}
          </PropertyCard>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <FileWarning className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div className="text-xs text-red-300/80">{error}</div>
        </div>
      )}
    </div>
  );
}

function PropertyCard({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06]">
        <Icon className="w-3.5 h-3.5 text-white/30" />
        <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof Copy; label: string; onClick: () => void }) {
  return (
    <motion.button whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-white/50 hover:text-white/80 transition-colors">
      <Icon className="w-3 h-3 shrink-0" />
      {label}
    </motion.button>
  );
}
