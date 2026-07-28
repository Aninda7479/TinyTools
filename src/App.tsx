import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar, { type Tool } from "./components/Sidebar";
import Welcome from "./components/Welcome";
import ImageCompress from "./components/ImageCompress";
import QrGenerator from "./components/QrGenerator";
import ImageProcess from "./components/ImageProcess";
import AiToolsPage from "./components/AiToolsPage";
import PrivacyPage from "./components/PrivacyPage";
import EditingPage from "./components/EditingPage";
import ConversionPage from "./components/ConversionPage";
import BatchPage from "./components/BatchPage";
import ErrorBoundary from "./components/ErrorBoundary";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

function AppInner() {
  const [activeTool, setActiveTool] = useState<Tool>("welcome");

  const renderTool = () => {
    switch (activeTool) {
      case "ai": return <AiToolsPage key="ai" />;
      case "privacy": return <PrivacyPage key="privacy" />;
      case "editing": return <EditingPage key="editing" />;
      case "compress": return <ImageCompress key="compress" />;
      case "conversion": return <ConversionPage key="conversion" />;
      case "qr": return <QrGenerator key="qr" />;
      case "process": return <ImageProcess key="process" />;
      case "batch": return <BatchPage key="batch" />;
      default: return <Welcome key="welcome" onNavigate={setActiveTool} />;
    }
  };

  return (
    <div className="flex h-screen bg-surface-solid">
      <Sidebar activeTool={activeTool} onToolSelect={setActiveTool} />
      <main className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTool} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={spring} className="h-full"
          >
            {renderTool()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
