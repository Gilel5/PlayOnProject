import { useRef, useState, useEffect, useContext } from "react";
import { DarkModeContext } from "./DarkModeContext";
import { Menu, MoreHorizontal, LayoutTemplate, Paperclip, ArrowUp } from "lucide-react";
import UserMessage from "./messages/UserMessage";
import BotMessage from "./messages/BotMessage";
import PdfAttachment from "./PdfAttachment";
import File from "./File";

export default function ChatArea({
  messages,
  input,
  setInput,
  files,
  removeFile,
  sendMessage,
  isLoading,
  sidebarOpen,
  onSidebarOpen,
  rightPanelOpen,
  onRightPanelToggle,
  onUploadCsv,
  uploadStatus, // null | 'uploading' | {rows_inserted, table} | {error}
  onCancelUpload,
}) {
  const messagesEndRef = useRef(null);
  const renameInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Menu state
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const { darkMode } = useContext(DarkModeContext);



  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // Focus and select the rename input text when it appears
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      setOpenMenu(null);
    };

    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenu]);

  // Open the context menu — calculate fixed position from the button's location
  // so the dropdown is not clipped by the overflow-y-auto scroll container
  function handleMenuOpen(e, chatId) {
    e.stopPropagation();
    if (openMenu === chatId) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenMenu(chatId);
  }

  function handlePaperclipClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    onUploadCsv(file);
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Top bar */}
      <div className={`flex items-center justify-between px-4 py-4 border-b ${darkMode ? "border-gray-700" : "border-gray-100"}`}>
        <div className="flex items-center gap-2">
          {!sidebarOpen && (
            <>
              <button
                onClick={onSidebarOpen}
                className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
              >
                <Menu size={18} className={darkMode ? "text-gray-300" : "text-gray-600"} />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#5BC5D0] text-gray-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                      stroke="black"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span className={`font-semibold text-sm ${darkMode ? "text-white" : "text-gray-900"}`}>DataChat</span>
              </div>
            </>
          )}
        </div>
        {/*  Right side of top bar */}
        <div className="flex items-center gap-2">
          <button className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
            onClick={(e) => handleMenuOpen(e, "current-chat")}
          >
            <MoreHorizontal size={18} className={darkMode ? "text-gray-400" : "text-black"} />
          </button>
          {!rightPanelOpen && (
            <button
              onClick={onRightPanelToggle}
              className={`p-1.5 rounded-lg text-gray-500 transition-colors ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
            >
              <LayoutTemplate size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto px-8 py-6 space-y-5 ${darkMode ? "bg-black" : "bg-white"}`}>
        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessage key={msg.id} text={msg.text} />
          ) : (
            <BotMessage key={msg.id}>
              <p className="mb-2">{msg.text}</p>
              {msg.attachment && <PdfAttachment name={msg.attachment} />}
            </BotMessage>
          )
        )}
        {isLoading && (
          <BotMessage>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[#5BC5D0] border-t-transparent rounded-full animate-spin" />
              <p>Thinking...</p>
            </div>
          </BotMessage>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-6 pb-6 pt-2">
        {uploadStatus === "uploading" && (
          <div className="flex items-center gap-2 mb-2 px-1 text-xs text-gray-500">
            <div className="w-3 h-3 border-2 border-[#5BC5D0] border-t-transparent rounded-full animate-spin" />
            <span>Uploading CSV…</span>
            <button
              onClick={onCancelUpload}
              className="ml-1 text-red-400 hover:text-red-600 underline"
            >
              Cancel
            </button>
          </div>
        )}
        {uploadStatus?.rows_inserted != null && (
          <div className={`mb-2 px-1 text-xs ${darkMode ? "text-green-400" : "text-green-600"}`}>
            ✓ {uploadStatus.rows_inserted.toLocaleString()} rows added to <strong>{uploadStatus.table}</strong>
          </div>
        )}
        {uploadStatus?.error && (
          <div className={`mb-2 px-1 text-xs ${darkMode ? "text-red-400" : "text-red-500"}`}>{uploadStatus.error}</div>
        )}

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {files.map((file) => (
              <File key={file} label={file} onRemove={() => removeFile(file)} />
            ))}
          </div>
        )}
        <div className={`border rounded-2xl shadow-sm overflow-hidden ${darkMode ? "bg-black border-gray-600" : "bg-white border-gray-200"}`}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to know?"
            rows={2}
            className={`w-full px-4 pt-3 pb-1 text-sm placeholder-gray-400 outline-none resize-none bg-transparent ${darkMode ? "text-gray-200" : "text-gray-700"}`}
          />
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Hidden CSV file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={handlePaperclipClick}
              disabled={uploadStatus === "uploading"}
              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? "hover:bg-gray-700 text-gray-400 hover:text-gray-200" : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"}`}
            >
              <Paperclip size={16} />
            </button>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                input.trim() && !isLoading
                  ? (darkMode ? "bg-gray-600 text-white hover:bg-gray-500" : "bg-gray-800 text-white hover:bg-gray-900")
                  : (darkMode ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-200 text-gray-400 cursor-not-allowed")
              }`}
            >
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Context menu — rendered with fixed position so it is never clipped by the scroll container */}
      {openMenu && (
        <div
          style={{ position: "fixed", top: menuPosition.top, right: menuPosition.right }}
          className={`w-36 border rounded shadow-lg z-50 ${darkMode ? "bg-black border-gray-600" : "bg-white border-gray-200"}`}
        >
          <button
            onClick={() => { /* TODO: Implement clear chat */ setOpenMenu(null); }}
            className={`w-full text-left px-3 py-1.5 text-sm ${darkMode ? "hover:bg-gray-700 text-white" : "hover:bg-gray-100"}`}
          >
            Clear Chat
          </button>
          <button
            onClick={() => { /* TODO: Implement export chat */ setOpenMenu(null); }}
            className={`w-full text-left px-3 py-1.5 text-sm ${darkMode ? "hover:bg-gray-700 text-white" : "hover:bg-gray-100"}`}
          >
            Export Chat
          </button>
        </div>
      )}
    </div>
  );
}
