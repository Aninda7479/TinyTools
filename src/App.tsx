import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./components/Sidebar";
import ImageCompress from "./components/ImageCompress";
import QrGenerator from "./components/QrGenerator";
import ImageProcess from "./components/ImageProcess";
import Welcome from "./components/Welcome";

type Tool = "welcome" | "compress" | "qr" | "process";

const springTransition = { type: "spring", stiffness: 300, damping: 30 };

export default function App() {
  const [activeTool, setActiveTool] = useState<Tool>("welcome");

  const renderTool = () => {
    switch (activeTool) {
      case "compress":
        return <ImageCompress key="compress" />;
      case "qr":
        return <QrGenerator key="qr" />;
      case "process":
        return <ImageProcess key="process" />;
      default:
        return <Welcome key="welcome" onNavigate={setActiveTool} />;
    }
  };

  return (
    <div className="flex h-screen bg-surface-solid">
      <Sidebar activeTool={activeTool} onToolSelect={setActiveTool} />
      <main className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTool}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={springTransition}
            className="h-full"
          >
            {renderTool()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
