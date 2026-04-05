import { useEffect, useRef, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { DarkModeContext } from "../components/DarkModeContext";
import { me, refresh, logout as logoutApi, updateDisplayName, changePassword } from "../api/auth";
import { sendChatMessage } from "../api/chat";
import {
  createChatSession,
  getUserSessions,
  getSessionMessages,
  pinSession,
  deleteSession,
  renameSession,
  archiveSession,
  restoreSession,
  clearSessionMessages,
} from "../api/chatSessions";

import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import RightPanel from "../components/RightPanel";
import SettingsModal from "../components/SettingsModal";
import { uploadCsv } from "../api/upload";


export default function AppHome() {
  const nav = useNavigate();

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeChat, setActiveChat] = useState("New Chat");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [messagesMap, setMessagesMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const abortControllerRef = useRef(null);

  const WELCOME_MESSAGE = {id: 0, role: "bot", text: "Hello! I'm your data chat assistant. How can I help you today?"};

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
        const userSessions = await getUserSessions(u.id);
        setSessions(userSessions);
        if (userSessions.length > 0) {
          setActiveChatId(userSessions[0].id);
        }
      } catch {
        nav("/login");
      }
    })();
  }, [nav]);

  useEffect(() => {
    if (!activeChatId) return;
    if (messagesMap[activeChatId]) return;

    (async () => {
      try {
        const dbMessages = await getSessionMessages(activeChatId);
        if (dbMessages.length > 0) {
          const mapped = dbMessages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
          }));
          setMessagesMap((prev) => ({ ...prev, [activeChatId]: [WELCOME_MESSAGE, ...mapped] }));
        }
      } catch (err) {
        console.error("Failed to load messages", err);
      }
    })();
  }, [activeChatId]);

  async function onLogout() {
    try { await logoutApi(); } finally {
      sessionStorage.removeItem("access_token");
      nav("/login");
    }
  }

  async function OnDelete() {
    
  }

  async function handleChangeName(newName) {
    const token = await getAccessToken();
    const updatedUser = await updateDisplayName(token, newName);
    setUser(updatedUser);
    return updatedUser;
  }

  async function handleChangePassword(currentPassword, newPassword) {
    const token = await getAccessToken();
    await changePassword(token, currentPassword, newPassword);
  }

  function removeFile(label) {
    setFiles((prev) => prev.filter((t) => t !== label));
  }

  async function sendMessage(text) {
    if (!text.trim() || !activeChatId) return;

    // Add the user's message to the active chat immediately (optimistic update)
    const userMessage = { id: Date.now(), role: "user", text };
    setMessagesMap((prev) => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || [WELCOME_MESSAGE]), userMessage],
    }));
    setInput("");
    setIsLoading(true);

    try {
      // Send the message to the backend along with the session ID
      const response = await sendChatMessage(text, activeChatId);
      const botMessage = { id: Date.now() + 1, role: "bot", text: response.reply };

      // Append the bot's reply to the active chat's message history
      setMessagesMap((prev) => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] || []), botMessage],
      }));

      // Refresh the sessions list so the sidebar reflects the updated last_message_at order
      if (user?.id) {
        const fresh = await getUserSessions(user.id);
        setSessions(fresh);
      }
    } catch {
      // Show an error message in the chat if the request fails
      const errorMessage = { id: Date.now() + 1, role: "bot", text: "Sorry, I couldn't process your message. Please try again." };
      setMessagesMap((prev) => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] || []), errorMessage],
      }));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateChat() {
    if (!user) return;
    try {
      const newSession = await createChatSession(user.id);
      setSessions((prev) => [newSession, ...prev]);
      setActiveChatId(newSession.id);
    } catch (error) {
      console.error("Failed to create chat", error);
    }
  }

  async function handleUploadCsv(file) {
    abortControllerRef.current = new AbortController();
    setUploadStatus("uploading");
    try {
      const result = await uploadCsv(file, () => {}, abortControllerRef.current.signal);
      setUploadStatus(result);
      setTimeout(() => setUploadStatus(null), 6000);
    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
        setUploadStatus({ error: "Upload cancelled." });
      } else {
        const detail = err.response?.data?.detail ?? "Upload failed. Please try again.";
        setUploadStatus({ error: detail });
      }
      setTimeout(() => setUploadStatus(null), 8000);
    }
  }

  function handleCancelUpload() {
    abortControllerRef.current?.abort();
  }

  async function handleTogglePin(sessionId) {
    // Optimistic update so the UI responds instantly.
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId ? { ...session, is_pinned: !session.is_pinned } : session
      )
    );

    try {
      await pinSession(sessionId);
      if (user?.id) {
        const freshSessions = await getUserSessions(user.id);
        setSessions(freshSessions);
      }
    } catch (error) {
      // Revert optimistic state if backend update fails.
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId ? { ...session, is_pinned: !session.is_pinned } : session
        )
      );
      console.error("Failed to toggle pin", error);
    }
  }

  async function handleDeleteChat(sessionId) {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => {
        const next = prev.filter((session) => session.id !== sessionId);
        if (activeChatId === sessionId) {
          setActiveChatId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    } catch (error) {
      console.error("Failed to delete chat", error);
    }
  }

  async function handleRenameChat(sessionId, newTitle) {
    if (!newTitle.trim()) return;
    try {
      // Update the title in the DB
      await renameSession(sessionId, newTitle);
      // Update the sessions list in state so the sidebar reflects the new name
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId ? { ...session, chat_title: newTitle } : session
        )
      );
    } catch (error) {
      console.error("Failed to rename chat", error);
    }
  }

  async function handleArchiveChat(sessionId) {
    try {
      await archiveSession(sessionId);
      setSessions((prev) => {
        const next = prev.filter((session) => session.id !== sessionId);
        if (activeChatId === sessionId) {
          setActiveChatId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    } catch (error) {
      console.error("Failed to archive chat", error);
    }
  }

  async function handleRestoreChat(sessionId) {
    try {
      await restoreSession(sessionId);
      // Refresh the sessions list to include the restored chat
      if (user?.id) {
        const freshSessions = await getUserSessions(user.id);
        setSessions(freshSessions);
      }
    } catch (error) {
      console.error("Failed to restore chat", error);
    }
  }

  async function handleClearChat() {
    if (!activeChatId) return;
    try {
      await clearSessionMessages(activeChatId);
      setMessagesMap(prev => ({
        ...prev,
        [activeChatId]: [WELCOME_MESSAGE]
      }));
    } catch (e) {
      console.error("Failed to clear chat", e);
    }
  }

  const messages = activeChatId ? (messagesMap[activeChatId] || [WELCOME_MESSAGE]) : [WELCOME_MESSAGE];
  const activeSession = sessions.find((s) => s.id === activeChatId);
  const { darkMode } = useContext(DarkModeContext);

  if (!user) {
    return (
      <div className={`flex h-screen items-center justify-center ${darkMode ? "bg-slate-950" : "bg-gray-50"}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#5BC5D0] border-t-transparent rounded-full animate-spin" />
          <p className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-500"}`}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${darkMode ? "bg-black text-white" : "bg-gray-50 text-gray-900"} font-sans overflow-hidden`}>

      {sidebarOpen && (
        <Sidebar
          user={user}
          sessions={sessions}
          activeChatId={activeChatId}
          onSelectChat={setActiveChatId}
          onCreateChat={handleCreateChat}
          onTogglePin={handleTogglePin}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
          onArchiveChat={handleArchiveChat}
          onClose={() => setSidebarOpen(false)}
          onSettingsOpen={() => setShowSettings(true)}
        />
      )}

      <ChatArea
        messages={messages}
        activeChatTitle={sessions.find((s) => s.id === activeChatId)?.chat_title || "Chat"}
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
        onUploadCsv={handleUploadCsv}
        uploadStatus={uploadStatus}
        onCancelUpload={handleCancelUpload}
        onClearChat={handleClearChat}
      />

      {rightPanelOpen && (
        <RightPanel
          onClose={() => setRightPanelOpen(false)}
          summary={activeSession?.chat_summary}
        />
      )}


      {showSettings && (
        <SettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
          onRestoreChat={handleRestoreChat}
          changeName={handleChangeName}
          changePassword={handleChangePassword}
        />
      )}
    </div>
  );
}
