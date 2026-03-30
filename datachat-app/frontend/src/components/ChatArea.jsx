import { useRef, useState, useEffect, useContext } from "react";
import { DarkModeContext } from "./DarkModeContext";
import { Menu, MoreHorizontal, LayoutTemplate, Paperclip, ArrowUp, BarChart3 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { generateSummaryReports } from "../api/chat";
import UserMessage from "./messages/UserMessage";
import BotMessage from "./messages/BotMessage";
import PdfAttachment from "./PdfAttachment";
import File from "./File";

export default function ChatArea({
  messages,
  activeChatTitle,
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
  onClearChat,
}) {
  const messagesEndRef = useRef(null);
  const renameInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  // Menu state
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [renamingId, setRenamingId] = useState(null);
  const { darkMode } = useContext(DarkModeContext);
  const [renameValue, setRenameValue] = useState("");
  const [isGeneratingReports, setIsGeneratingReports] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  async function handleGenerateReports() {
    try {
      setIsGeneratingReports(true);
      const url = await generateSummaryReports();
      const a = document.createElement("a");
      a.href = url;
      a.download = `Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to generate report", e);
    } finally {
      setIsGeneratingReports(false);
    }
  }
  function handleExportChat() {
    if (!messages || messages.length === 0) return;
    
    const exportText = messages.map(msg => {
      const role = msg.role === 'user' ? 'You' : 'DataChat';
      return `${role}:\n${msg.text}\n`;
    }).join('\n----------------------------------------\n\n');

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const safeTitle = (activeChatTitle || "Chat_Export").replace(/[^a-z0-9]/gi, '_');
    a.download = `${safeTitle}_${new Date().toISOString().split('T')[0]}.txt`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setOpenMenu(null);
  }

  async function handleExportPdf() {
    setOpenMenu(null);
    if (!messages || messages.length === 0) return;
    
    const originalContainer = document.getElementById("chat-messages-container");
    if (!originalContainer) return;
    
    const clone = originalContainer.cloneNode(true);
    
    let stylesheets = '';
    for (let i = 0; i < document.styleSheets.length; i++) {
        const styleSheet = document.styleSheets[i];
        try {
          if (styleSheet.href) {
            stylesheets += `<link rel="stylesheet" href="${styleSheet.href}">\n`;
          } else if (styleSheet.cssRules) {
            stylesheets += `<style>${Array.from(styleSheet.cssRules).map(r => r.cssText).join('')}</style>\n`;
          }
        } catch(e) {}
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${activeChatTitle || "Chat Export"}</title>
          ${stylesheets}
          <style>
             body { background: white !important; color: black !important; padding: 40px; margin: 0; }
             #chat-messages-container { overflow: visible !important; height: auto !important; padding: 0 !important; }
             
             /* Universally force high contrast text and clean up backgrounds for printing */
             * { 
                color: #111827 !important; 
                box-shadow: none !important;
             }
             .bg-sky-700, 
             .bg-slate-700, 
             .bg-slate-800, 
             .bg-slate-900, 
             .bg-black,
             .bg-\\[\\#5BC5D0\\] {
                background-color: #f3f4f6 !important;
                border: 1px solid #e5e7eb !important;
             }
             .prose-invert { filter: none !important; }
             svg, svg path { stroke: #111827 !important; }
          </style>
        </head>
        <body>
          <h2 style="font-family: sans-serif; margin-bottom: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
            ${activeChatTitle || "Chat Export"} - ${new Date().toLocaleDateString()}
          </h2>
          ${clone.outerHTML}
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 300); };
          </script>
        </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

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
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
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
    <div className={`flex-1 flex flex-col min-w-0 ${darkMode ? "bg-black text-white" : "bg-white text-gray-900"}`}>
      {/* Top bar */}
      <div className={`h-16 flex items-center justify-between px-4 border-b flex-shrink-0 ${darkMode ? "border-slate-800" : "border-gray-100"}`}>
        <div className="flex items-center gap-2">
          {!sidebarOpen && (
            <>
              <button
                onClick={onSidebarOpen}
                className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"}`}
              >
                <Menu size={18} className={darkMode ? "text-slate-200" : "text-gray-700"} />
              </button>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${darkMode ? "bg-indigo-500" : "bg-[#5BC5D0]"}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                      stroke={darkMode ? "white" : "black"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span className={darkMode ? "font-semibold text-white text-sm" : "font-semibold text-gray-900 text-sm"}>DataChat</span>
              </div>
            </>
          )}
        </div>
        {/*  Right side of top bar */}
        <div className="flex items-center gap-2">
          <button className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"}`}
            onClick={(e) => handleMenuOpen(e, "current-chat")}
          >
            <MoreHorizontal size={18} className={darkMode ? "text-slate-200" : "text-black"} />
          </button>
          {!rightPanelOpen && (
            <button
              onClick={onRightPanelToggle}
              className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"}`}
            >
              <LayoutTemplate size={18} className={darkMode ? "text-slate-200" : "text-gray-600"} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div id="chat-messages-container" className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessage key={msg.id} text={msg.text} />
          ) : (
            <BotMessage key={msg.id}>
              <div className={`prose prose-sm max-w-none transition-colors ${darkMode ? "prose-invert prose-headings:text-white prose-p:text-slate-100 prose-strong:text-white prose-li:text-slate-100" : "prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-li:text-gray-800"}`}><ReactMarkdown>{msg.text}</ReactMarkdown></div>
              {msg.attachment && <PdfAttachment name={msg.attachment} />}
            </BotMessage>
          )
        )}
        {isLoading && (
          <BotMessage>
            <div className="flex items-center gap-2 h-5">
              <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0 ${darkMode ? "border-indigo-500" : "border-[#5BC5D0]"}`} />
              <span className={`text-sm ${darkMode ? "text-white" : "text-gray-600"}`}>Thinking...</span>
            </div>
          </BotMessage>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-6 pb-6 pt-2">
        {/* Upload status banners */}
        {uploadStatus === "uploading" && (
          <div className={`flex items-center gap-2 mb-2 px-1 text-xs ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
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
        <div className={`rounded-2xl shadow-md overflow-hidden ${darkMode ? "bg-black border border-slate-500" : "bg-white border border-gray-200"}`}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to know?"
            rows={2}
            className={`w-full px-4 pt-3 pb-1 text-sm outline-none resize-none bg-transparent ${darkMode ? "text-gray-100 placeholder-slate-400" : "text-gray-700 placeholder-gray-400"}`}
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
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePaperclipClick}
                disabled={uploadStatus === "uploading"}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? "hover:bg-slate-800 text-slate-300 hover:text-slate-100" : "hover:bg-gray-100 text-gray-700 hover:text-gray-600"}`}
                title="Upload CSV"
              >
                <Paperclip size={16} />
              </button>
              <button
                onClick={handleGenerateReports}
                disabled={isGeneratingReports}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${darkMode ? "hover:bg-slate-800 text-slate-300 hover:text-slate-100" : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"}`}
                title="Download Excel Report"
              >
                {isGeneratingReports ? (
                  <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0 ${darkMode ? "border-slate-300" : "border-gray-600"}`} />
                ) : (
                  <BarChart3 size={16} />
                )}
                <span className="hidden sm:inline">{isGeneratingReports ? "Generating..." : "Generate Report"}</span>
              </button>
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                input.trim() && !isLoading
                  ? darkMode
                    ? "bg-sky-700 text-white hover:bg-sky-800"
                    : "bg-[#5BC5D0] text-black hover:bg-[#5BC5D0]"
                  : darkMode
                    ? "bg-slate-700 text-white cursor-not-allowed"
                    : "bg-gray-200 text-gray-700 cursor-not-allowed"
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
          ref={menuRef}
          style={{ position: "fixed", top: menuPosition.top, right: menuPosition.right }}
          className={`w-36 rounded shadow-lg z-50 ${darkMode ? "bg-slate-900 border border-slate-700" : "bg-white border border-gray-200"}`}
        >
          <button
            onClick={() => { setShowClearConfirm(true); setOpenMenu(null); }}
            className={`w-full text-left px-3 py-1.5 text-sm ${darkMode ? "hover:bg-slate-800 text-slate-100" : "hover:bg-gray-100"}`}
          >
            Clear Chat
          </button>
          <button
            onClick={handleExportChat}
            className={`w-full text-left px-3 py-1.5 text-sm ${darkMode ? "hover:bg-slate-800 text-slate-100" : "hover:bg-gray-100"}`}
          >
            Export as TXT
          </button>
          <button
            onClick={handleExportPdf}
            className={`w-full text-left px-3 py-1.5 text-sm ${darkMode ? "hover:bg-slate-800 text-slate-100" : "hover:bg-gray-100"}`}
          >
            Export as PDF
          </button>
        </div>
      )}

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className={`rounded-xl shadow-lg p-5 w-72 ${darkMode ? "bg-slate-800 text-white" : "bg-white text-gray-900"}`} onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium mb-1">Clear Chat</p>
            <p className={`text-sm mb-4 ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
              Are you sure you want to clear <strong>{activeChatTitle || "this chat"}</strong>? All messages will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className={`px-3 py-1.5 text-sm rounded-lg ${darkMode ? "hover:bg-slate-700 text-slate-200" : "hover:bg-gray-100 text-gray-600"}`}
              >
                Cancel
              </button>
              <button
                onClick={() => { onClearChat(); setShowClearConfirm(false); }}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
