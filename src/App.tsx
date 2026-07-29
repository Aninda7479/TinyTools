import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar, { type Tool, sidebarCategories } from "./components/Sidebar";
import CategoryPage from "./components/CategoryPage";
import Welcome from "./components/Welcome";
import ImageCompress from "./components/ImageCompress";
import QrGenerator from "./components/QrGenerator";
import ImageProcess from "./components/ImageProcess";
import AiToolsPage from "./components/AiToolsPage";
import PrivacyPage from "./components/PrivacyPage";
import EditingPage from "./components/EditingPage";
import ConversionPage from "./components/ConversionPage";
import BatchPage from "./components/BatchPage";
import PdfToolsPage from "./components/PdfToolsPage";
import PasswordGeneratorPage from "./components/PasswordGeneratorPage";
import EncoderDecoderPage from "./components/EncoderDecoderPage";
import HasherPage from "./components/HasherPage";
import EncryptionPage from "./components/EncryptionPage";
import P2PSendPage from "./components/P2PSendPage";
import P2PReceivePage from "./components/P2PReceivePage";
import VideoToolsPage from "./components/VideoToolsPage";
import ErrorBoundary from "./components/ErrorBoundary";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const catToolIds = new Set(sidebarCategories.map((c) => c.id));

function AppInner() {
  const [activeTool, setActiveTool] = useState<Tool>("welcome");
  const [activeSub, setActiveSub] = useState<string | undefined>(undefined);

  const handleNavigate = (tool: Tool, sub?: string) => {
    setActiveTool(tool);
    setActiveSub(sub);
  };

  const renderTool = () => {
    if (catToolIds.has(activeTool)) {
      const cat = sidebarCategories.find((c) => c.id === activeTool);
      if (cat) {
        return <CategoryPage key={activeTool} category={cat} onNavigate={handleNavigate} />;
      }
    }

    switch (activeTool) {
      case "ai": return <AiToolsPage key="ai" defaultSub={activeSub} />;
      case "privacy": return <PrivacyPage key="privacy" defaultSub={activeSub} />;
      case "editing": return <EditingPage key="editing" defaultSub={activeSub} />;
      case "compress": return <ImageCompress key="compress" />;
      case "conversion": return <ConversionPage key="conversion" defaultSub={activeSub} />;
      case "qr": return <QrGenerator key="qr" />;
      case "process": return <ImageProcess key="process" defaultSub={activeSub} />;
      case "batch": return <BatchPage key="batch" />;
      case "pdf": return <PdfToolsPage key="pdf" defaultSub={activeSub} />;
      case "password": return <PasswordGeneratorPage key="password" />;
      case "encoder": return <EncoderDecoderPage key="encoder" defaultSub={activeSub} />;
      case "hasher": return <HasherPage key="hasher" defaultSub={activeSub} />;
      case "encryption": return <EncryptionPage key="encryption" defaultSub={activeSub} />;
      case "portal-send": return <P2PSendPage key="portal-send" />;
      case "portal-receive": return <P2PReceivePage key="portal-receive" />;
      case "video": return <VideoToolsPage key="video" defaultSub={activeSub} />;
      default: return <Welcome key="welcome" onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex h-screen bg-surface-solid">
      <Sidebar activeTool={activeTool} onToolSelect={handleNavigate} />
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
