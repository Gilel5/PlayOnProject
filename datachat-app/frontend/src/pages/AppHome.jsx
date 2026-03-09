import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { me, refresh, logout as logoutApi } from "../api/auth";

import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import RightPanel from "../components/RightPanel";
import SettingsModal from "../components/SettingsModal";

const DEMO_MESSAGES = [
  { id: 1, role: "user", text: "Can you show me subscription data for January?" },
  {
    id: 2,
    role: "bot",
    text: "Sure. Here is a pdf comparing financial reports from January 2026 and January 2025",
    attachment: "Jan 2026 vs Jan 2025 Report.pdf",
  },
];

export default function AppHome() {
  const nav = useNavigate();

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeChat, setActiveChat] = useState("Subscriptions Jan 2026 vs Jan 2025");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState(["Jan 2026", "Jan 2025"]);
  const [messages] = useState(DEMO_MESSAGES);

  async function getAccessToken() {
    const existing = sessionStorage.getItem("access_token");
    if (existing) return existing;
    const data = await refresh();
    sessionStorage.setItem("access_token", data.access_token);
    return data.access_token;
  }

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        const u = await me(token);
        setUser(u);
      } catch {
        nav("/login");
      }
    })();
  }, [nav]);

  async function onLogout() {
    try { await logoutApi(); } finally {
      sessionStorage.removeItem("access_token");
      nav("/login");
    }
  }

  function removeFile(label) {
    setFiles((prev) => prev.filter((t) => t !== label));
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      {sidebarOpen && (
        <Sidebar
          user={user}
          activeChat={activeChat}
          setActiveChat={setActiveChat}
          onClose={() => setSidebarOpen(false)}
          onSettingsOpen={() => setShowSettings(true)}
        />
      )}

      <ChatArea
        messages={messages}
        input={input}
        setInput={setInput}
        files={files}
        removeFile={removeFile}
        sidebarOpen={sidebarOpen}
        onSidebarOpen={() => setSidebarOpen(true)}
        rightPanelOpen={rightPanelOpen}
        onRightPanelToggle={() => setRightPanelOpen((prev) => !prev)}
      />

      {rightPanelOpen && <RightPanel />}

      {showSettings && (
        <SettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
        />
      )}
    </div>
  );
}
