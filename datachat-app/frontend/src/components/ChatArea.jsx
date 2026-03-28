import { useRef, useState, useEffect, useContext } from "react";
import { DarkModeContext } from "./DarkModeContext";
import { Menu, MoreHorizontal, LayoutTemplate, Paperclip, ArrowUp, BarChart3 } from "lucide-react";
import SummaryReport from "./SummaryReport";
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
  onGenerateReports,
  isGeneratingReports,
}) {
  const messagesEndRef = useRef(null);
  const renameInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Menu state
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  // const {darkMode} = useContext(DarkModeContext)



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
      <div className={`flex items-center justify-between px-4 py-4 border-b border-gray-100`}>
        <div className="flex items-center gap-2">
          {!sidebarOpen && (
            <>
              <button
                onClick={onSidebarOpen}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Menu size={18} className="text-gray-600" />
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
                <span className="font-semibold text-gray-900 text-sm">DataChat</span>
              </div>
            </>
          )}
        </div>
        {/*  Right side of top bar */}
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-lg transition-colors"
            onClick={(e) => handleMenuOpen(e, "current-chat")}
          >
            <MoreHorizontal size={18} className="text-black" />
          </button>
          {!rightPanelOpen && (
            <button
              onClick={onRightPanelToggle}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <LayoutTemplate size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessage key={msg.id} text={msg.text} />
          ) : msg.summaryData ? (
            <BotMessage key={msg.id} wide>
              <SummaryReport data={msg.summaryData} />
            </BotMessage>
          ) : (
            <BotMessage key={msg.id}>
              <p className="mb-2 whitespace-pre-wrap">{msg.text}</p>
              {msg.reportFile && (
                <a
                  href={msg.reportFile.url}
                  download={msg.reportFile.name}
                  className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3 mt-2 hover:bg-gray-100 hover:border-gray-300 transition-colors group cursor-pointer max-w-xs"
                >
                  <div className="w-9 h-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="8" y1="13" x2="16" y2="13" />
                      <line x1="8" y1="17" x2="16" y2="17" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{msg.reportFile.name}</p>
                    <p className="text-xs text-gray-500">Excel Workbook • 3 sheets</p>
                  </div>
                  <div className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                </a>
              )}
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
        {/* Upload status banners */}
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
          <div className="mb-2 px-1 text-xs text-green-600">
            ✓ {uploadStatus.rows_inserted.toLocaleString()} rows added to <strong>{uploadStatus.table}</strong>
          </div>
        )}
        {uploadStatus?.error && (
          <div className="mb-2 px-1 text-xs text-red-500">{uploadStatus.error}</div>
        )}

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {files.map((file) => (
              <File key={file} label={file} onRemove={() => removeFile(file)} />
            ))}
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to know?"
            rows={2}
            className="w-full px-4 pt-3 pb-1 text-sm text-gray-700 placeholder-gray-400 outline-none resize-none bg-transparent"
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
            <div className="flex items-center gap-1">
              <button
                onClick={handlePaperclipClick}
                disabled={uploadStatus === "uploading"}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-40"
              >
                <Paperclip size={16} />
              </button>
              <button
                onClick={onGenerateReports}
                disabled={isGeneratingReports}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-40"
                title="Generate Summary Reports"
              >
                <BarChart3 size={16} />
              </button>
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                input.trim() && !isLoading
                  ? "bg-gray-800 text-white hover:bg-gray-900"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
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
          className="w-36 bg-white border border-gray-200 rounded shadow-lg z-50"
        >
          <button
            onClick={() => { /* TODO: Implement clear chat */ setOpenMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Clear Chat
          </button>
          <button
            onClick={() => { /* TODO: Implement export chat */ setOpenMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Export Chat
          </button>
        </div>
      )}
    </div>
  );
}
