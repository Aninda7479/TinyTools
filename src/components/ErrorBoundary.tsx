import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-surface-solid text-white/70 gap-6 p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-white/90">Something went wrong</h2>
            <p className="text-sm text-white/40 max-w-md leading-relaxed">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors text-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
