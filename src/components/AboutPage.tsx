import { motion } from "framer-motion";
import { Shield, Cpu, Lock, Github, CheckCircle2, Heart, ExternalLink, Star } from "lucide-react";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: spring },
};

export default function AboutPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-12"
    >
      {/* Header Banner / Hero Section */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shrink-0"
      >
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-xs text-blue-400 font-medium w-fit">
            <Shield className="w-3.5 h-3.5" />
            100% Private & Local
          </div>
          
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2" style={{ color: '#ffffff' }}>
              TinyTools
            </h1>
            <p className="text-sm md:text-base text-white/70 leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              A secure utility workspace built to run entirely on your device.
              Process your images, videos, PDFs, and text locally without sending a single byte online.
            </p>
          </div>
        </div>

        {/* Primary Action: GitHub Repository Link */}
        <div className="relative z-10 w-full md:w-auto shrink-0 flex flex-col gap-2">
          <motion.a
            href="https://github.com/Aninda7479/TinyTools"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-500 text-white font-medium text-sm transition-colors hover:bg-blue-600 shadow-lg shadow-blue-500/10"
          >
            <Github className="w-4 h-4" />
            <span>GitHub Repository</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </motion.a>
          
          <a
            href="https://github.com/Aninda7479/TinyTools"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            <Star className="w-3.5 h-3.5 text-yellow-500/80 fill-yellow-500/20" />
            <span>Star on GitHub</span>
          </a>
        </div>

        {/* Abstract decorative shapes */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-20 top-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
        {/* Left Column: Why We Built It & Mission */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col justify-between p-6 rounded-2xl border border-border bg-white/5 backdrop-blur-xl"
        >
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white" style={{ color: '#ffffff' }}>
              <Lock className="w-5 h-5 text-indigo-400" />
              Why it was built
            </h2>
            <p className="text-sm text-white/70 leading-relaxed mb-4" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Most simple tools today require you to upload your sensitive PDFs, private images, or personal text to remote servers. This introduces tracking, data scraping, and potential security breaches.
            </p>
            <p className="text-sm text-white/70 leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              TinyTools was built to provide a modern, high-performance alternative:
              <strong className="block mt-2 text-white font-medium" style={{ color: '#ffffff' }}>
                To do all your day-to-day small tasks securely without sending your data online, or any tracking.
              </strong>
            </p>
          </div>

          <div className="mt-8 border-t border-white/5 pt-4">
            <div className="flex gap-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-white" style={{ color: '#ffffff' }}>No Cloud Server</h4>
                  <p className="text-[11px] text-white/40" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Zero network requests for processing</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-white" style={{ color: '#ffffff' }}>No Analytics</h4>
                  <p className="text-[11px] text-white/40" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>No tracking cookies or logging</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Who Built It & GitHub */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col justify-between p-6 rounded-2xl border border-border bg-white/5 backdrop-blur-xl animate-fade-in"
        >
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white" style={{ color: '#ffffff' }}>
              <Cpu className="w-5 h-5 text-blue-400" />
              Built By
            </h2>
            
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0">
                A
              </div>
              <div>
                <h3 className="text-base font-semibold text-white" style={{ color: '#ffffff' }}>Aninda</h3>
                <p className="text-xs text-white/50" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Developer & Designer</p>
              </div>
            </div>

            <p className="text-sm text-white/70 leading-relaxed mb-6" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Hi! I'm Aninda. I built TinyTools out of a personal need for privacy-first developer and media utility tools that are lightweight, fast, and gorgeous.
            </p>
          </div>

          <div>
            <motion.a
              href="https://github.com/Aninda7479"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 font-medium text-sm transition-all"
            >
              <Github className="w-4 h-4 text-white/70" />
              <span>Follow @Aninda7479 on GitHub</span>
            </motion.a>
          </div>
        </motion.div>
      </div>

      {/* Trust Pillars */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 shrink-0">
        <div className="p-5 rounded-2xl border border-border bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2" style={{ color: '#ffffff' }}>
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Tauri & Rust Backend
          </h3>
          <p className="text-xs text-white/40 leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
            Leverages Tauri's lightweight shell wrapper and Rust's raw speed for heavy lifting like encryption and processing.
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2" style={{ color: '#ffffff' }}>
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            WebAssembly Execution
          </h3>
          <p className="text-xs text-white/40 leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
            Compiles high-performance logic directly to WASM to run in the sandbox, ensuring safety and extreme speed.
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2" style={{ color: '#ffffff' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Zero-Trust Sandbox
          </h3>
          <p className="text-xs text-white/40 leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
            Native integrations are locked down strictly. TinyTools holds no database, cloud Sync, or telemetry integrations.
          </p>
        </div>
      </motion.div>

      {/* Footer message */}
      <motion.div variants={itemVariants} className="text-center text-[10px] text-white/20 mt-4 flex items-center justify-center gap-1 shrink-0" style={{ color: 'rgba(255, 255, 255, 0.2)' }}>
        Made with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> for security and open web.
      </motion.div>
    </motion.div>
  );
}
