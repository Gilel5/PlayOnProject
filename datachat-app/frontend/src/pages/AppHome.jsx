import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { me, refresh, logout as logoutApi } from "../api/auth";
import { sendChatMessage } from "../api/chat";

import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import RightPanel from "../components/RightPanel";
import SettingsModal from "../components/SettingsModal";

const INITIAL_MESSAGES = [
  { id: 1, role: "bot", text: "Hello! I'm your data chat assistant. How can I help you today?" },
];

export default function AppHome() {
  const nav = useNavigate();

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeChat, setActiveChat] = useState("New Chat");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);

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

  async function sendMessage(text) {
    if (!text.trim()) return;

    const userMessage = { id: Date.now(), role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage(text);
      const botMessage = { id: Date.now() + 1, role: "bot", text: response.reply };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = { id: Date.now() + 1, role: "bot", text: "Sorry, I couldn't process your message. Please try again." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
        sendMessage={sendMessage}
        isLoading={isLoading}
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
