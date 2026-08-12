import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2, Play, Pause, Square, Download, Search, RotateCcw, FileText, Upload, Check, Copy, Trash2
} from "lucide-react";
import { isTauri, saveFile, generateTtsAudio } from "../lib/tauri";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const PRESETS = [
  "Welcome to TinyTools! Your local speech synthesis tool is configured and running fully offline.",
  "This is a quick speech preview. You can adjust the speed, pitch, and volume using the sliders on the left.",
  "The quick brown fox jumps over the lazy dog.",
  "Local speech generation ensures your data remains completely private and secure."
];

export default function TtsPage() {
  const [text, setText] = useState(PRESETS[0]);
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize and load system voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const allVoices = window.speechSynthesis.getVoices();
        setVoices(allVoices);
        
        if (allVoices.length > 0 && !selectedVoice) {
          // Select default or first English voice
          const defaultVoice = 
            allVoices.find(v => v.default) || 
            allVoices.find(v => v.lang.startsWith("en")) || 
            allVoices[0];
          setSelectedVoice(defaultVoice);
        }
      }
    };

    updateVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      }
    };
  }, [selectedVoice]);

  // Handle live text playback
  const handleSpeak = useCallback(() => {
    if (!text.trim()) return;
    
    const synth = window.speechSynthesis;
    if (!synth) return;
    
    synth.cancel(); // Stop any current synthesis

    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      currentUtteranceRef.current = null;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      currentUtteranceRef.current = null;
    };
    utterance.onpause = () => setIsPaused(true);
    utterance.onresume = () => setIsPaused(false);

    currentUtteranceRef.current = utterance;
    synth.speak(utterance);
  }, [text, selectedVoice, rate, pitch, volume]);

  const handlePlayPause = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (isSpeaking) {
      if (isPaused) {
        synth.resume();
        setIsPaused(false);
      } else {
        synth.pause();
        setIsPaused(true);
      }
    } else {
      handleSpeak();
    }
  };

  const handleStop = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    currentUtteranceRef.current = null;
  };

  const handleResetSettings = () => {
    setRate(1.0);
    setPitch(1.0);
    setVolume(1.0);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportTextFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setText(content);
        showStatus("Text file imported successfully!", "success");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

  const showStatus = (msg: string, type: "info" | "success" | "error" = "info") => {
    setStatus(msg);
    setStatusType(type);
    if (type === "success" || type === "info") {
      setTimeout(() => setStatus(""), 4000);
    }
  };

  const handleExport = async () => {
    if (!text.trim()) {
      showStatus("Please enter some text to export.", "error");
      return;
    }

    showStatus("Selecting output location...", "info");
    try {
      const filters = [{ name: "WAV Audio", extensions: ["wav"] }];
      const path = await saveFile("speech.wav", filters);

      if (!path) {
        showStatus("Export cancelled.", "info");
        return;
      }

      showStatus("Synthesizing audio file offline...", "info");
      const result = await generateTtsAudio(
        text,
        path,
        rate,
        selectedVoice?.name || undefined
      );

      if (result.success) {
        showStatus(`Audio successfully saved to: ${path}`, "success");
      } else {
        showStatus(`Failed to generate audio: ${result.message}`, "error");
      }
    } catch (err) {
      showStatus(`Export failed: ${err}`, "error");
    }
  };

  // Filter and sort voices
  const filteredVoices = voices.filter(v => {
    const query = searchQuery.toLowerCase();
    return v.name.toLowerCase().includes(query) || v.lang.toLowerCase().includes(query);
  });

  const sortedVoices = [...filteredVoices].sort((a, b) => {
    if (a.lang !== b.lang) return a.lang.localeCompare(b.lang);
    return a.name.localeCompare(b.name);
  });

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estSpeakingTime = Math.ceil(wordCount / (150 * rate) * 60);

  const waveBars = Array.from({ length: 14 });

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <style>{`
        @keyframes tts-bounce {
          0%, 100% { transform: scaleY(0.25); }
          50% { transform: scaleY(1.0); }
        }
      `}</style>

      <div>
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold">Local Text to Speech</h2>
        </div>
        <p className="text-sm text-white/40 mt-1">
          Synthesize and play speech locally, adjust parameters, and export to WAV audio files.
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left Panel: Settings */}
        <div className="w-[340px] flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Voice Selection */}
          <div className="p-4 rounded-2xl bg-white/5 border border-border flex flex-col gap-3">
            <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">System Voices</p>
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Search voices by name/lang..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="max-h-48 overflow-y-auto border border-border rounded-xl bg-black/10">
              {sortedVoices.length > 0 ? (
                sortedVoices.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedVoice(v)}
                    className={`w-full text-left px-3 py-2 text-xs border-b border-border/5 last:border-b-0 transition-colors ${
                      selectedVoice?.name === v.name
                        ? "bg-blue-500/10 text-blue-400 font-medium"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="truncate">{v.name}</div>
                    <div className="text-[10px] text-white/30 font-mono mt-0.5">{v.lang} {v.localService ? "(Local)" : ""}</div>
                  </button>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-white/30">No voices found</div>
              )}
            </div>
          </div>

          {/* Voice Tuning Parameters */}
          <div className="p-4 rounded-2xl bg-white/5 border border-border flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Voice Tuning</p>
              <button
                onClick={handleResetSettings}
                className="text-white/40 hover:text-white/80 p-1 rounded-lg transition-colors"
                title="Reset sliders to defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Speed (Rate) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Speed (Rate)</span>
                <span className="text-blue-400 font-mono font-medium">{rate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={rate}
                onChange={e => setRate(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
              />
              <div className="flex justify-between text-[9px] text-white/20 px-1 font-mono">
                <span>Slow (0.5)</span>
                <span>Normal (1.0)</span>
                <span>Fast (2.0)</span>
              </div>
            </div>

            {/* Pitch */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Pitch</span>
                <span className="text-blue-400 font-mono font-medium">{pitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={pitch}
                onChange={e => setPitch(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
              />
              <div className="flex justify-between text-[9px] text-white/20 px-1 font-mono">
                <span>Low (0.5)</span>
                <span>Normal (1.0)</span>
                <span>High (1.5)</span>
              </div>
            </div>

            {/* Volume */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Volume</span>
                <span className="text-blue-400 font-mono font-medium">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="p-4 rounded-2xl bg-white/5 border border-border flex flex-col gap-2">
            <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Test Presets</p>
            <div className="flex flex-col gap-1.5">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setText(p)}
                  className="text-left px-3 py-2 rounded-xl border border-border bg-white/5 text-[11px] text-white/60 hover:text-white hover:border-white/20 transition-all truncate"
                  title={p}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Text Input & Output Controls */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative flex-1 flex flex-col">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type or paste your text here..."
              className="w-full flex-1 bg-white/5 border border-border rounded-2xl p-4 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none shadow-inner min-h-[250px]"
            />
            
            {/* Overlay Toolbar */}
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportTextFile}
                accept=".txt,.md,.rtf"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl bg-black/40 border border-white/5 hover:border-white/20 text-white/60 hover:text-white transition-all"
                title="Import Text File (.txt, .md)"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopyText}
                className="p-2 rounded-xl bg-black/40 border border-white/5 hover:border-white/20 text-white/60 hover:text-white transition-all"
                title="Copy Text"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setText("")}
                className="p-2 rounded-xl bg-black/40 border border-white/5 hover:border-white/20 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Clear Text"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            {/* Stats Bar */}
            <div className="absolute left-4 bottom-3 flex items-center gap-4 text-[10px] text-white/30 font-mono select-none">
              <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {charCount} chars</span>
              <span>{wordCount} words</span>
              <span>Est. Playback: {estSpeakingTime}s</span>
            </div>
          </div>

          {/* Real-time playback status & Wave animation */}
          <div className="p-4 rounded-2xl bg-white/5 border border-border flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Live Monitor</span>
              <span className="text-xs text-white/70 mt-0.5">
                {isSpeaking
                  ? isPaused
                    ? "Playback paused"
                    : `Speaking with ${selectedVoice?.name || "default voice"}`
                  : "Synthesizer Idle"}
              </span>
            </div>

            {/* Bouncing Audio Wave Visualizer */}
            <div className="flex items-end gap-[3px] h-6 px-2">
              {waveBars.map((_, i) => {
                const isActive = isSpeaking && !isPaused;
                return (
                  <div
                    key={i}
                    className={`w-0.5 rounded-full ${isActive ? "bg-blue-400 animate-[tts-bounce_1.2s_infinite_ease-in-out]" : "bg-white/20"}`}
                    style={{
                      animationDelay: `${i * 0.08}s`,
                      height: isActive ? "100%" : "30%",
                      transformOrigin: "bottom",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Action Control Panel */}
          <div className="flex gap-3">
            {/* Live Synthesis Controls */}
            <div className="flex-1 flex gap-2 rounded-2xl bg-white/5 border border-border p-2">
              <button
                onClick={handlePlayPause}
                disabled={!text.trim()}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                  isSpeaking && !isPaused
                    ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-30 disabled:pointer-events-none"
                }`}
              >
                {isSpeaking && !isPaused ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isPaused ? "Resume" : "Speak"}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleStop}
                disabled={!isSpeaking}
                className="px-6 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-30 disabled:pointer-events-none"
                title="Stop speech"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            </div>

            {/* Offline File Export */}
            {isTauri() && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring}
                onClick={handleExport}
                disabled={!text.trim()}
                className="px-6 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <Download className="w-4 h-4" />
                <span>Export Audio File</span>
              </motion.button>
            )}
          </div>

          {/* Status Message Overlay */}
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={spring}
                className={`p-3 rounded-2xl border text-xs ${
                  statusType === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : statusType === "error"
                    ? "bg-red-500/10 border-red-500/20 text-red-300"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-300"
                }`}
              >
                {status}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
