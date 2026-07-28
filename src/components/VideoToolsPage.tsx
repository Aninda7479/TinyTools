import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film, Scissors, ArrowUpDown, RotateCw, Crop, Volume2, VolumeX,
  Image as ImageIcon, Gauge, Stamp, Subtitles, Play, X, ChevronLeft,
  CheckCircle, AlertTriangle, FileVideo, Upload, Merge, RefreshCw
} from "lucide-react";
import {
  pickFile,
  getVideoInfo, compressVideo, resizeVideo, convertAspectRatio,
  trimVideo, mergeVideos, cropVideo, rotateVideo, mirrorVideo,
  convertVideoFormat, extractAudio, muteVideo, replaceAudio,
  videoToGif, gifToVideo, changeSpeed, addVideoWatermark,
  burnSubtitles, extractFrames
} from "../lib/tauri";
import type { ToolResult } from "../lib/tauri";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

type VideoTool =
  | "select" | "info" | "compress" | "resize" | "aspect" | "trim" | "merge"
  | "crop" | "rotate" | "mirror" | "format" | "extract-audio" | "mute"
  | "replace-audio" | "to-gif" | "from-gif" | "speed" | "watermark" | "subtitles" | "frames";

interface ToolCard {
  id: VideoTool;
  icon: typeof Film;
  title: string;
  description: string;
  category: string;
}

const tools: ToolCard[] = [
  { id: "info", icon: FileVideo, title: "Video Info", description: "View codec, bitrate, FPS, duration", category: "Info" },
  { id: "compress", icon: ArrowUpDown, title: "Compress", description: "Target file size or quality slider", category: "Compression" },
  { id: "resize", icon: ArrowUpDown, title: "Resize", description: "Scale to 720p, 480p, or custom", category: "Compression" },
  { id: "aspect", icon: RefreshCw, title: "Aspect Ratio", description: "Convert 16:9 to 9:16, 1:1, 4:5", category: "Compression" },
  { id: "trim", icon: Scissors, title: "Trim / Cut", description: "Lossless precision trimming", category: "Editing" },
  { id: "merge", icon: Merge, title: "Merge", description: "Join multiple clips sequentially", category: "Editing" },
  { id: "crop", icon: Crop, title: "Crop Frame", description: "Remove black bars or unwanted areas", category: "Editing" },
  { id: "rotate", icon: RotateCw, title: "Rotate", description: "Fix sideways phone recordings", category: "Editing" },
  { id: "mirror", icon: RefreshCw, title: "Mirror / Flip", description: "Flip horizontal or vertical", category: "Editing" },
  { id: "format", icon: Film, title: "Convert Format", description: "MP4, MKV, WebM, AVI, MOV, FLV", category: "Audio & Format" },
  { id: "extract-audio", icon: Volume2, title: "Extract Audio", description: "Strip audio to MP3, WAV, AAC, FLAC", category: "Audio & Format" },
  { id: "mute", icon: VolumeX, title: "Mute Video", description: "Remove all audio tracks", category: "Audio & Format" },
  { id: "replace-audio", icon: Volume2, title: "Replace Audio", description: "Swap audio with custom track", category: "Audio & Format" },
  { id: "to-gif", icon: ImageIcon, title: "Video → GIF", description: "High-quality GIF with palette", category: "GIF & Motion" },
  { id: "from-gif", icon: Film, title: "GIF → Video", description: "Convert heavy GIF to MP4", category: "GIF & Motion" },
  { id: "speed", icon: Gauge, title: "Speed Control", description: "Fast-motion or slow-motion", category: "Advanced" },
  { id: "watermark", icon: Stamp, title: "Watermark", description: "Text overlay on video", category: "Advanced" },
  { id: "subtitles", icon: Subtitles, title: "Burn Subtitles", description: "Embed .srt/.vtt into video", category: "Advanced" },
  { id: "frames", icon: ImageIcon, title: "Frame Extract", description: "Export frames as PNG/JPG", category: "Advanced" },
];

const categories = ["Info", "Compression", "Editing", "Audio & Format", "GIF & Motion", "Advanced"];

export default function VideoToolsPage({ defaultSub }: { defaultSub?: string } = {}) {
  const [tool, setTool] = useState<VideoTool>((defaultSub as VideoTool) || "select");
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoInfo, setVideoInfo] = useState<string | null>(null);

  // Options
  const [quality, setQuality] = useState(80);
  const [targetSize, setTargetSize] = useState(0);
  const [useTargetSize, setUseTargetSize] = useState(false);
  const [resizeW, setResizeW] = useState(1280);
  const [resizeH, setResizeH] = useState(720);
  const [aspect, setAspect] = useState("9:16");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(60);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropW, setCropW] = useState(1920);
  const [cropH, setCropH] = useState(1080);
  const [rotateAngle, setRotateAngle] = useState(90);
  const [mirrorDir, setMirrorDir] = useState("horizontal");
  const [outFormat, setOutFormat] = useState("mp4");
  const [audioFormat, setAudioFormat] = useState("mp3");
  const [replaceAudioPath, setReplaceAudioPath] = useState("");
  const [replaceAudioName, setReplaceAudioName] = useState("");
  const [gifFps, setGifFps] = useState(15);
  const [gifWidth, setGifWidth] = useState(480);
  const [speed, setSpeed] = useState(2.0);
  const [wmText, setWmText] = useState("WATERMARK");
  const [wmPos, setWmPos] = useState("bottom-right");
  const [wmSize, setWmSize] = useState(48);
  const [subPath, setSubPath] = useState("");
  const [subName, setSubName] = useState("");
  const [frameTs, setFrameTs] = useState(0);
  const [frameAll, setFrameAll] = useState(false);

  const reset = () => {
    setTool("select");
    setFilePath(""); setFileName("");
    setResult(null); setError(""); setVideoInfo(null);
    setReplaceAudioPath(""); setReplaceAudioName("");
    setSubPath(""); setSubName("");
  };

  const pick = useCallback(async () => {
    const f = await pickFile([{ name: "Video", extensions: ["mp4", "mkv", "mov", "webm", "avi", "flv", "gif", "wmv", "m4v"] }]);
    if (!f) return;
    setFilePath(f.path); setFileName(f.name);
    setResult(null); setError(""); setVideoInfo(null);
  }, []);

  const pickAudio = useCallback(async () => {
    const f = await pickFile([{ name: "Audio", extensions: ["mp3", "wav", "aac", "flac", "ogg", "m4a"] }]);
    if (!f) return;
    setReplaceAudioPath(f.path); setReplaceAudioName(f.name);
  }, []);

  const pickSubtitle = useCallback(async () => {
    const f = await pickFile([{ name: "Subtitles", extensions: ["srt", "vtt", "ass"] }]);
    if (!f) return;
    setSubPath(f.path); setSubName(f.name);
  }, []);

  const run = async (action: () => Promise<ToolResult>) => {
    setLoading(true); setError(""); setResult(null);
    try {
      const r = await action();
      setResult(r);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const doInfo = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const r = await getVideoInfo(filePath);
      setVideoInfo(r.message);
    } catch (e: unknown) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const process = () => {
    if (!filePath) return;
    const dir = filePath.substring(0, filePath.lastIndexOf("\\") !== -1 ? filePath.lastIndexOf("\\") : filePath.lastIndexOf("/"));
    switch (tool) {
      case "info": return doInfo();
      case "compress": return run(() => compressVideo(filePath, quality, useTargetSize ? targetSize : undefined));
      case "resize": return run(() => resizeVideo(filePath, resizeW, resizeH));
      case "aspect": return run(() => convertAspectRatio(filePath, aspect));
      case "trim": return run(() => trimVideo(filePath, trimStart, trimEnd));
      case "crop": return run(() => cropVideo(filePath, cropX, cropY, cropW, cropH));
      case "rotate": return run(() => rotateVideo(filePath, rotateAngle));
      case "mirror": return run(() => mirrorVideo(filePath, mirrorDir));
      case "format": return run(() => convertVideoFormat(filePath, outFormat));
      case "extract-audio": return run(() => extractAudio(filePath, audioFormat));
      case "mute": return run(() => muteVideo(filePath));
      case "replace-audio": return run(() => replaceAudio(filePath, replaceAudioPath));
      case "to-gif": return run(() => videoToGif(filePath, gifFps, gifWidth));
      case "from-gif": return run(() => gifToVideo(filePath));
      case "speed": return run(() => changeSpeed(filePath, speed));
      case "watermark": return run(() => addVideoWatermark(filePath, wmText, wmPos, wmSize));
      case "subtitles": return run(() => burnSubtitles(filePath, subPath));
      case "frames": return run(() => extractFrames(filePath, dir, frameAll ? undefined : frameTs));
      case "merge": return run(() => mergeVideos([filePath], dir));
    }
  };

  const renderPanel = () => {
    switch (tool) {
      case "info": return <p className="text-xs text-white/40">Select a video to view its metadata</p>;
      case "compress": return (
        <>
          <label className="text-xs text-white/40">
            <div className="flex items-center justify-between mb-1">
              <span>Target Size</span>
              <button onClick={() => setUseTargetSize(!useTargetSize)}
                className={`px-2 py-0.5 rounded text-[10px] ${useTargetSize ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/40"}`}>
                {useTargetSize ? "ON" : "OFF"}
              </button>
            </div>
            {useTargetSize ? (
              <input type="number" value={targetSize} onChange={e => setTargetSize(Number(e.target.value))} placeholder="KB"
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            ) : (
              <input type="range" min={10} max={100} value={quality} onChange={e => setQuality(Number(e.target.value))}
                className="w-full accent-blue-400" />
            )}
          </label>
          {!useTargetSize && <p className="text-[10px] text-white/30">Quality: {quality}%</p>}
          {useTargetSize && <p className="text-[10px] text-white/30">Target: {targetSize} KB</p>}
        </>
      );
      case "resize": return (
        <div className="flex flex-col gap-2">
          {[[1920,1080,"1080p"],[1280,720,"720p"],[854,480,"480p"],[640,360,"360p"]].map(([w,h,l]) => (
            <button key={l as string} onClick={() => { setResizeW(w as number); setResizeH(h as number); }}
              className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors ${resizeW===w ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 border-border text-white/50"}`}>
              {l as string} ({w}×{h})
            </button>
          ))}
          <label className="text-xs text-white/40 mt-2">Custom Width
            <input type="number" value={resizeW} onChange={e => setResizeW(Number(e.target.value))}
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
          <label className="text-xs text-white/40">Custom Height
            <input type="number" value={resizeH} onChange={e => setResizeH(Number(e.target.value))}
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
        </div>
      );
      case "aspect": return (
        <div className="flex flex-col gap-2">
          {[["9:16","Vertical (TikTok/Reels)"],["1:1","Square (Instagram)"],["16:9","Landscape"],["4:5","Instagram Feed"]].map(([v,l]) => (
            <button key={v} onClick={() => setAspect(v)}
              className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors ${aspect===v ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 border-border text-white/50"}`}>
              {v} — {l}
            </button>
          ))}
        </div>
      );
      case "trim": return (
        <div className="flex flex-col gap-3">
          <label className="text-xs text-white/40">Start (seconds)
            <input type="number" value={trimStart} onChange={e => setTrimStart(Number(e.target.value))} min={0} step={0.1}
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
          <label className="text-xs text-white/40">End (seconds)
            <input type="number" value={trimEnd} onChange={e => setTrimEnd(Number(e.target.value))} min={0} step={0.1}
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
          <p className="text-[10px] text-white/30">Duration: {(trimEnd - trimStart).toFixed(1)}s — Lossless copy, no re-encode</p>
        </div>
      );
      case "crop": return (
        <div className="flex flex-col gap-2">
          {[
            ["X", cropX, setCropX], ["Y", cropY, setCropY],
            ["Width", cropW, setCropW], ["Height", cropH, setCropH]
          ].map(([l, v, s]) => (
            <label key={l as string} className="text-xs text-white/40">{l as string}
              <input type="number" value={v as number} onChange={e => (s as React.Dispatch<React.SetStateAction<number>>)(Number(e.target.value))} min={0}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
          ))}
        </div>
      );
      case "rotate": return (
        <div className="flex flex-col gap-2">
          {[90, 180, 270].map(a => (
            <button key={a} onClick={() => setRotateAngle(a)}
              className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors ${rotateAngle===a ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 border-border text-white/50"}`}>
              Rotate {a}°
            </button>
          ))}
        </div>
      );
      case "mirror": return (
        <div className="flex flex-col gap-2">
          {["horizontal","vertical"].map(d => (
            <button key={d} onClick={() => setMirrorDir(d)}
              className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors capitalize ${mirrorDir===d ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 border-border text-white/50"}`}>
              Flip {d}
            </button>
          ))}
        </div>
      );
      case "format": return (
        <div className="flex flex-col gap-2">
          {["mp4","mkv","webm","avi","mov","flv"].map(f => (
            <button key={f} onClick={() => setOutFormat(f)}
              className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors uppercase ${outFormat===f ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 border-border text-white/50"}`}>
              {f}
            </button>
          ))}
        </div>
      );
      case "extract-audio": return (
        <div className="flex flex-col gap-2">
          {["mp3","wav","aac","flac","ogg"].map(f => (
            <button key={f} onClick={() => setAudioFormat(f)}
              className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors uppercase ${audioFormat===f ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-white/5 border-border text-white/50"}`}>
              {f}
            </button>
          ))}
        </div>
      );
      case "mute": return <p className="text-xs text-white/40">Strips all audio tracks from the video</p>;
      case "replace-audio": return (
        <div className="flex flex-col gap-3">
          <button onClick={pickAudio}
            className="px-3 py-2 rounded-lg bg-white/5 border border-border text-xs text-white/60 hover:text-white text-left">
            {replaceAudioName || "Select audio file..."}
          </button>
          <p className="text-[10px] text-white/30">Select MP3, WAV, or AAC to replace the original audio</p>
        </div>
      );
      case "to-gif": return (
        <div className="flex flex-col gap-3">
          <label className="text-xs text-white/40">FPS
            <input type="number" value={gifFps} onChange={e => setGifFps(Number(e.target.value))} min={1} max={30}
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
          <label className="text-xs text-white/40">Width (px)
            <input type="number" value={gifWidth} onChange={e => setGifWidth(Number(e.target.value))} min={100} max={1920} step={50}
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
        </div>
      );
      case "from-gif": return <p className="text-xs text-white/40">Converts heavy GIF to lightweight MP4 loop</p>;
      case "speed": return (
        <div className="flex flex-col gap-3">
          <label className="text-xs text-white/40">Speed Multiplier
            <input type="range" min={0.25} max={8} step={0.25} value={speed} onChange={e => setSpeed(Number(e.target.value))}
              className="mt-1 w-full accent-blue-400" />
          </label>
          <div className="flex justify-between text-[10px] text-white/30">
            <span>0.25x (slow)</span>
            <span className="text-white/60">{speed}x</span>
            <span>8x (fast)</span>
          </div>
        </div>
      );
      case "watermark": return (
        <div className="flex flex-col gap-3">
          <label className="text-xs text-white/40">Text
            <input value={wmText} onChange={e => setWmText(e.target.value)}
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
          <label className="text-xs text-white/40">Font Size
            <input type="number" value={wmSize} onChange={e => setWmSize(Number(e.target.value))} min={12} max={200}
              className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
          </label>
          <div className="flex flex-col gap-1">
            {["top-left","top-right","bottom-left","bottom-right","center"].map(p => (
              <button key={p} onClick={() => setWmPos(p)}
                className={`text-left px-2 py-1 rounded text-[10px] transition-colors capitalize ${wmPos===p ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/40"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      );
      case "subtitles": return (
        <div className="flex flex-col gap-3">
          <button onClick={pickSubtitle}
            className="px-3 py-2 rounded-lg bg-white/5 border border-border text-xs text-white/60 hover:text-white text-left">
            {subName || "Select .srt / .vtt file..."}
          </button>
          <p className="text-[10px] text-white/30">Burns subtitle text directly into the video frames</p>
        </div>
      );
      case "frames": return (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-xs text-white/40">
            <input type="checkbox" checked={frameAll} onChange={e => setFrameAll(e.target.checked)} className="accent-blue-400" />
            Extract all frames (1fps)
          </label>
          {!frameAll && (
            <label className="text-xs text-white/40">Timestamp (seconds)
              <input type="number" value={frameTs} onChange={e => setFrameTs(Number(e.target.value))} min={0} step={0.1}
                className="mt-1 w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-xs text-white/80 outline-none" />
            </label>
          )}
        </div>
      );
      default: return null;
    }
  };

  const toolCard = tools.find(t => t.id === tool);

  if (tool === "select") {
    return (
      <div className="flex flex-col h-full">
        <h2 className="text-xl font-semibold mb-1">Video Tools</h2>
        <p className="text-sm text-white/40 mb-6">Full video processing suite — powered by FFmpeg (must be installed)</p>
        {categories.map(cat => (
          <div key={cat} className="mb-4">
            <h3 className="text-[10px] uppercase tracking-widest text-white/20 mb-2">{cat}</h3>
            <div className="grid grid-cols-5 gap-2">
              {tools.filter(t => t.category === cat).map(t => {
                const Icon = t.icon;
                return (
                  <motion.button key={t.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    transition={spring}
                    onClick={() => { setTool(t.id); setFilePath(""); setFileName(""); setResult(null); setError(""); setVideoInfo(null); }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-surface/50 hover:border-border-hover hover:bg-surface-hover transition-colors cursor-pointer">
                    <Icon className="w-5 h-5 text-white/60" />
                    <span className="text-[10px] font-medium text-center">{t.title}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <button onClick={reset} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <ChevronLeft className="w-4 h-4 text-white/50" />
        </button>
        <div>
          <h2 className="text-lg font-semibold">{toolCard?.title}</h2>
          <p className="text-xs text-white/40">{toolCard?.description}</p>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[300px] flex flex-col gap-3 overflow-y-auto pr-1">
          {renderPanel()}
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <motion.div
            animate={{ borderColor: filePath ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)" }}
            className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-white/20 transition-colors min-h-[120px]"
            onClick={pick}
          >
            {fileName ? (
              <div className="flex items-center gap-2">
                <FileVideo className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-white/70">{fileName}</span>
                <button onClick={e => { e.stopPropagation(); setFilePath(""); setFileName(""); setResult(null); setError(""); setVideoInfo(null); }}
                  className="text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-white/30" />
                <p className="text-xs text-white/50">Click to select a video file</p>
              </>
            )}
          </motion.div>

          {filePath && tool !== "merge" && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring}
              disabled={loading}
              onClick={process}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50">
              {loading ? <span className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" /> : <Play className="w-4 h-4" />}
              {loading ? "Processing..." : toolCard?.title || "Process"}
            </motion.button>
          )}

          <AnimatePresence>
            {videoInfo && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="p-3 rounded-xl bg-white/5 border border-border">
                <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono">{videoInfo}</pre>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-xs text-emerald-300/80 whitespace-pre-wrap break-all">{result.message}</div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="text-xs text-red-300/80 whitespace-pre-wrap break-all">{error}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
