import { Component, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, RefreshCw, X, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useCallback } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

function ErrorModal({
  error,
  errorInfo,
  onDismiss,
  onReload,
}: {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onDismiss: () => void;
  onReload: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyError = useCallback(async () => {
    const text = [
      `Error: ${error?.message || "Unknown"}`,
      error?.name ? `Type: ${error.name}` : null,
      errorInfo?.componentStack ? `\nComponent Stack:${errorInfo.componentStack}` : null,
      error?.stack ? `\nStack Trace:\n${error.stack}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [error, errorInfo]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={onDismiss}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={spring}
        className="w-full max-w-lg mx-4 rounded-2xl border border-red-500/20 overflow-hidden"
        style={{ backgroundColor: "#252525" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/90">Something went wrong</h3>
              <p className="text-[11px] text-white/40 mt-0.5">
                {error?.name || "Runtime Error"}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-white/40 hover:text-white/70"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Error message */}
        <div className="px-5 pb-3">
          <div className="px-3 py-2.5 rounded-xl bg-red-500/5 border border-red-500/10">
            <p className="text-xs text-red-300/80 leading-relaxed break-all font-mono">
              {error?.message || "An unexpected error occurred."}
            </p>
          </div>
        </div>

        {/* Stack trace toggle */}
        {(error?.stack || errorInfo?.componentStack) && (
          <div className="px-5 pb-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/50 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {expanded ? "Hide" : "Show"} details
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 max-h-48 overflow-auto rounded-xl bg-black/30 border border-white/5 p-3">
                    {errorInfo?.componentStack && (
                      <div className="mb-3">
                        <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5">Component Stack</p>
                        <pre className="text-[11px] text-white/40 whitespace-pre-wrap break-all leading-relaxed font-mono">
                          {errorInfo.componentStack.trim()}
                        </pre>
                      </div>
                    )}
                    {error?.stack && (
                      <div>
                        <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5">Stack Trace</p>
                        <pre className="text-[11px] text-white/40 whitespace-pre-wrap break-all leading-relaxed font-mono">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 pb-5 pt-1">
          <button
            onClick={copyError}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border text-white/50 hover:text-white/70 hover:bg-white/10 transition-colors text-xs"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <div className="flex-1" />
          <button
            onClick={onDismiss}
            className="px-3 py-2 rounded-xl bg-white/5 border border-border text-white/50 hover:text-white/70 hover:bg-white/10 transition-colors text-xs"
          >
            Dismiss
          </button>
          <button
            onClick={onReload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-colors text-xs font-medium"
          >
            <RefreshCw className="w-3 h-3" />
            Reload
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    return (
      <>
        {this.props.children}
        <AnimatePresence>
          {this.state.hasError && (
            <ErrorModal
              error={this.state.error}
              errorInfo={this.state.errorInfo}
              onDismiss={this.handleDismiss}
              onReload={this.handleReload}
            />
          )}
        </AnimatePresence>
      </>
    );
  }
}
