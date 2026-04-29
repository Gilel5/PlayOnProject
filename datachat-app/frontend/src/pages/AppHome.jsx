import { useEffect, useRef, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { DarkModeContext } from "../components/DarkModeContext";
import { me, refresh, logout as logoutApi, updateDisplayName, changePassword, deleteMyAccount } from "../api/auth";
import { sendChatMessage, getDatasource } from "../api/chat";
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

import Sidebar from "../components/layout/Sidebar";
import ChatArea from "../components/chat/ChatArea";
import SettingsModal from "../components/modals/SettingsModal";
import { Sparkles, X } from "lucide-react";
import { uploadCsv } from "../api/upload";


export default function AppHome() {
  const nav = useNavigate();

  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [summarySessionId, setSummarySessionId] = useState(null);
  const [activeChat, setActiveChat] = useState("New Chat");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [messagesMap, setMessagesMap] = useState({});
  const [loadingChats, setLoadingChats] = useState({});
  const [sessions, setSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [uploadStatus, setUploadStatus] = useState([]);
  const [datasource, setDatasource] = useState(null);
  const abortControllerRef = useRef({});

  /** 
   * Initial greeting injected into new or empty chat sessions.
   * Not saved to the database; it's a client-side display convenience.
   */
  const WELCOME_MESSAGE = {id: 0, role: "bot", text: "Hello! I'm your data chat assistant. How can I help you today?"};


  /**
   * Return the current access token from session storage, or fetch a new one
   * if it's missing (e.g. on hard refresh) by exchanging the HttpOnly refresh cookie.
   */
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
        } else {
          const newSession = await createChatSession(u.id);
          setSessions([newSession]);
          setActiveChatId(newSession.id);
        }
        getDatasource().then((d) => setDatasource(d.table)).catch(() => {});
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
            chart_data: m.chart_data || null,
            followUpQuestions: m.followUpQuestions || m.follow_up_questions || null,
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

    const currentChatId = activeChatId;
    
    // Add the user's message to the active chat immediately (optimistic update)
    setMessagesMap((prev) => {
      const oldMessages = prev[currentChatId] || [WELCOME_MESSAGE];
      const cleanedMessages = oldMessages.map((msg) =>
        msg.role === "bot" && msg.followUpQuestions ? { ...msg, followUpQuestions: undefined } : msg
      );
      const userMessage = { id: Date.now(), role: "user", text };
      return {
        ...prev,
        [currentChatId]: [...cleanedMessages, userMessage],
      };
    });

    setInput("");
    setLoadingChats((prev) => ({ ...prev, [currentChatId]: true }));

    try {
      // Send the message to the backend along with the session ID
      const response = await sendChatMessage(text, currentChatId);
      const followUpQuestions = response.follow_up_questions || null;
      const botMessage = {
        id: Date.now() + 1,
        role: "bot",
        text: response.reply,
        chart_data: response.chart_data || null,
        followUpQuestions,
      };

      // Append the bot's reply to the active chat's message history
      setMessagesMap((prev) => ({
        ...prev,
        [currentChatId]: [...(prev[currentChatId] || []), botMessage],
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
        [currentChatId]: [...(prev[currentChatId] || []), errorMessage],
      }));
    } finally {
      setLoadingChats((prev) => ({ ...prev, [currentChatId]: false }));
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

  function handleUploadCsv(files) {
    const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024; // 1 GB
    const genId = () => crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Enforce 3-file limit
    if (files.length > 3) {
      const errId = genId();
      setUploadStatus((prev) => [
        ...prev,
        { uploadId: errId, filename: null, error: "Please select up to 3 files at a time." },
      ]);
      setTimeout(() => setUploadStatus((prev) => prev.filter((s) => s.uploadId !== errId)), 5000);
      return;
    }

    // Deduplicate by filename within the batch (keep first occurrence)
    const seen = new Set();
    const deduped = files.filter((f) => {
      if (seen.has(f.name)) return false;
      seen.add(f.name);
      return true;
    });

    deduped.forEach((file) => {
      if (file.size > MAX_UPLOAD_SIZE) {
        const uploadId = genId();
        setUploadStatus((prev) => [...prev, { uploadId, filename: file.name, error: "File is too large. Maximum size is 1 GB." }]);
        setTimeout(() => setUploadStatus((prev) => prev.filter((s) => s.uploadId !== uploadId)), 8000);
        return;
      }

      // Abort any in-progress upload for this filename before starting a new one
      abortControllerRef.current[file.name]?.abort();

      const uploadId = genId();
      const controller = new AbortController();
      abortControllerRef.current[file.name] = controller;
      const startedAt = Date.now();
      const total = file.size;
      let uploadDone = false;
      const processingStartedAt = { current: null };

      // Replace any existing entry for this filename with the new upload
      setUploadStatus((prev) => [
        ...prev.filter((s) => s.filename !== file.name),
        { uploadId, filename: file.name, phase: "uploading", percent: 0, loaded: 0, total, startedAt },
      ]);

      uploadCsv(
        file,
        (percent, loaded) => {
          if (percent >= 100) {
            uploadDone = true;
          } else {
            setUploadStatus((prev) =>
              prev.map((s) => s.uploadId === uploadId ? { ...s, percent, loaded } : s)
            );
          }
        },
        (serverProgress) => {
          if (!uploadDone) return;
          const { phase, rows_processed = 0, total_rows = 0 } = serverProgress;
          if (phase === "unknown" || phase === "done") return;
          if (!processingStartedAt.current) processingStartedAt.current = Date.now();
          setUploadStatus((prev) =>
            prev.map((s) =>
              s.uploadId === uploadId
                ? { ...s, phase: "processing", serverPhase: phase, rows_processed, total_rows, startedAt: processingStartedAt.current }
                : s
            )
          );
        },
        controller.signal,
      )
        .then((result) => {
          setUploadStatus((prev) =>
            prev.map((s) => s.uploadId === uploadId ? { uploadId, filename: file.name, ...result } : s)
          );
          // Use uploadId so this timeout only removes this specific upload attempt
          setTimeout(() => setUploadStatus((prev) => prev.filter((s) => s.uploadId !== uploadId)), 6000);
        })
        .catch((err) => {
          const error =
            err.name === "CanceledError" || err.code === "ERR_CANCELED"
              ? "Upload cancelled."
              : err.response?.data?.detail ?? "Upload failed. Please try again.";
          setUploadStatus((prev) =>
            prev.map((s) => s.uploadId === uploadId ? { uploadId, filename: file.name, error } : s)
          );
          setTimeout(() => setUploadStatus((prev) => prev.filter((s) => s.uploadId !== uploadId)), 8000);
        })
        .finally(() => {
          delete abortControllerRef.current[file.name];
        });
    });
  }

  function handleCancelUpload(filename) {
    if (filename) {
      abortControllerRef.current[filename]?.abort();
    } else {
      Object.values(abortControllerRef.current).forEach((c) => c.abort());
    }
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

  function handleViewSummary(sessionId) {
    setSummarySessionId(sessionId || activeChatId);
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

  async function handleDeleteAccount() {
    try {
      const token = await getAccessToken();
      await deleteMyAccount(token);

      sessionStorage.removeItem("access_token");
      nav("/login");
    } catch (error) {
      console.error("Failed to delete account", error);
      alert("Failed to delete account. Please try again.");
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
          onViewSummary={handleViewSummary}
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
        isLoading={loadingChats[activeChatId] || false}
        sidebarOpen={sidebarOpen}
        onSidebarOpen={() => setSidebarOpen(true)}
        onUploadCsv={handleUploadCsv}
        uploadStatus={uploadStatus}
        onCancelUpload={handleCancelUpload}
        onClearChat={handleClearChat}
        onViewSummary={() => handleViewSummary(activeChatId)}
        datasource={datasource}
      />

      {summarySessionId && (() => {
        const summarySession = sessions.find((s) => s.id === summarySessionId) || activeSession;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className={`relative rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh] ${darkMode ? "bg-slate-900 text-white border border-slate-700" : "bg-white text-gray-900 border border-gray-200"}`}>
              {/* Header */}
              <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${darkMode ? "border-slate-700" : "border-gray-100"}`}>
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className={darkMode ? "text-cyan-300" : "text-cyan-600"} />
                  <span className="font-semibold text-sm">
                    {summarySession?.chat_title || "Chat Summary"}
                  </span>
                </div>
                <button
                  onClick={() => setSummarySessionId(null)}
                  className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-slate-700 text-slate-300" : "hover:bg-gray-100 text-gray-500"}`}
                >
                  <X size={16} />
                </button>
              </div>
              {/* Body */}
              <div className="overflow-y-auto px-5 py-4">
                {summarySession?.chat_summary ? (
                  <p className={`text-sm leading-7 whitespace-pre-wrap ${darkMode ? "text-slate-300" : "text-gray-700"}`}>
                    {summarySession.chat_summary}
                  </p>
                ) : (
                  <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-400"}`}>
                    No summary yet. Send a few messages and a summary will be generated automatically.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showSettings && (
        <SettingsModal
          user={user}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
          onDelete={handleDeleteAccount}
          onRestoreChat={handleRestoreChat}
          changeName={handleChangeName}
          changePassword={handleChangePassword}
        />
      )}
    </div>
  );
}
