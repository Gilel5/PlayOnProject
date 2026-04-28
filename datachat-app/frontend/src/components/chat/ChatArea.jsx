import { useRef, useState, useEffect, useContext } from "react";
import { DarkModeContext } from "../DarkModeContext";
import { Menu, MoreHorizontal, Paperclip, ArrowUp, BarChart3, Database, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { generateSummaryReports } from "../../api/chat";
import { getUploadedFiles } from "../../api/upload";
import UserMessage from "../messages/UserMessage";
import BotMessage from "../messages/BotMessage";
import FollowUpQuestions from "../messages/FollowUpQuestions";
import ChartBlock from "../messages/ChartBlock";
import PdfAttachment from "./PdfAttachment";
import File from "./File";
import remarkGfm from "remark-gfm";

// New extracted components and utilities
import ReportModal from "../modals/ReportModal";
import UploadStatusBar from "./UploadStatusBar";
import { formatFlattenedTable } from "../../utils/formatters";

/**
 * Main chat interface component.
 * 
 * Manages the message list rendering, text input, file attachments, and context menus.
 * Delegates report generation and upload progress to sub-components.
 * 
 * @param {Object} props
 * @param {Array} props.messages - Array of message objects to render.
 * @param {string} props.activeChatTitle - Title of the current chat.
 * @param {string} props.input - Current text input value.
 * @param {Function} props.setInput - State setter for input.
 * @param {Array} props.files - List of attached files.
 * @param {Function} props.removeFile - Callback to remove an attached file.
 * @param {Function} props.sendMessage - Callback to send a message.
 * @param {boolean} props.isLoading - Whether the bot is currently thinking.
 * @param {boolean} props.sidebarOpen - Whether the sidebar is open.
 * @param {Function} props.onSidebarOpen - Callback to open the sidebar.
 * @param {Function} props.onUploadCsv - Callback when a CSV is selected for upload.
 * @param {Object|null} props.uploadStatus - Current status of the CSV upload.
 * @param {Function} props.onCancelUpload - Callback to cancel the current upload.
 * @param {Function} props.onClearChat - Callback to clear the current chat messages.
 * @param {Function} props.onViewSummary - Callback to view the chat summary.
 * @param {string|null} props.datasource - The name of the active datasource.
 */
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
  onUploadCsv,
  uploadStatus,
  onCancelUpload,
  onClearChat,
  onViewSummary,
  datasource,
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
  const [dsDropdownOpen, setDsDropdownOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState(null);
  const dsDropdownRef = useRef(null);
  
  // Modal state
  const [showReportModal, setShowReportModal] = useState(false);
    
  async function handleGenerateReports(reportType, params) {
    try {
      setIsGeneratingReports(true);

      const payload = {
        reportType,
        year: params.year || null,
        month: params.month || null,
        startMonth: params.start_month || null,
        endMonth: params.end_month || null,
      };

      console.log("REPORT PAYLOAD", payload);

      const url = await generateSummaryReports(payload);

      const a = document.createElement("a");
      a.href = url;

      if (reportType === "annual") {
        a.download = `Annual_Summary_${payload.year}.xlsx`;
      } else if (reportType === "single_month") {
        a.download = `Monthly_Summary_${payload.month}.xlsx`;
      } else {
        a.download = `MultiMonth_Summary_${payload.startMonth}_to_${payload.endMonth}.xlsx`;
      }

      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setShowReportModal(false);
    } catch (e) {
      console.error("Failed to generate report", e);
      alert(e?.response?.data?.detail || e?.message || "Failed to generate report.");
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

  function handleExportPdf() {
    setOpenMenu(null);
    if (!messages || messages.length === 0) return;

    // ── Capture chart SVGs inline from the live DOM (no canvas / no blob URL) ──
    // Cloning and serializing the SVG directly is the most reliable approach —
    // no image loading, no CORS taint, works in every browser.
    function captureChartForMessage(msgId) {
      try {
        const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
        if (!wrapper) return null;
        const svg = wrapper.querySelector('.recharts-surface');
        if (!svg) return null;

        const clonedSvg = svg.cloneNode(true);
        const bbox = svg.getBoundingClientRect();
        const w = Math.max(bbox.width, 600);
        const h = Math.max(bbox.height, 300);
        clonedSvg.setAttribute('width', w);
        clonedSvg.setAttribute('height', h);
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // White background so it prints cleanly
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bgRect.setAttribute('width', '100%');
        bgRect.setAttribute('height', '100%');
        bgRect.setAttribute('fill', '#ffffff');
        clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

        // Return the raw SVG markup — we'll embed it inline in the HTML
        return new XMLSerializer().serializeToString(clonedSvg);
      } catch {
        return null;
      }
    }

    // Collect inline SVG strings for every message that has a chart
    const chartSvgs = {};
    messages
      .filter(m => m.role !== 'user' && m.chart_data)
      .forEach(m => {
        const svgMarkup = captureChartForMessage(m.id);
        if (svgMarkup) chartSvgs[m.id] = svgMarkup;
      });

    // Build clean message HTML from raw message data (no DOM clone)
    const messagesHtml = messages.map((msg, idx) => {
      const isUser = msg.role === 'user';
      // Convert basic markdown to HTML for bot messages
      let content = msg.text || '';
      if (!isUser) {
        // Bold
        content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic
        content = content.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Inline code
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Headers
        content = content.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        content = content.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        content = content.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        // Unordered lists
        content = content.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
        content = content.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
        // Ordered lists
        content = content.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        // Markdown tables → HTML tables
        content = content.replace(/(?:^|\n)((?:\|.+\|\s*\n?)+)/g, (_, tableBlock) => {
          const rows = tableBlock.trim().split('\n').filter(r => r.trim());
          if (rows.length < 2) return tableBlock;
          const headerCells = rows[0].split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
          const bodyRows = rows.slice(2).map(r => {
            const cells = r.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
            return `<tr>${cells}</tr>`;
          }).join('');
          return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
        });
        // Paragraphs — wrap bare lines
        content = content.replace(/^(?!<[hultb]).+$/gm, line => `<p>${line}</p>`);
      }

      if (isUser) {
        return `
          <div class="message user-message">
            <div class="message-label">You</div>
            <div class="message-bubble user-bubble">${msg.text}</div>
          </div>`;
      } else {
        const chartSvg = chartSvgs[msg.id];
        const chartHtml = chartSvg
          ? `<div style="margin-top:14px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff;padding:8px 4px;">${chartSvg}</div>`
          : '';
        return `
          <div class="message bot-message">
            <div class="message-header">
              <div class="bot-avatar">DC</div>
              <div class="message-label">DataChat</div>
            </div>
            <div class="message-bubble bot-bubble">${content}${chartHtml}</div>
          </div>`;
      }
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${activeChatTitle || 'Chat Export'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #ffffff;
      color: #1a1a2e;
      padding: 48px 56px;
      max-width: 820px;
      margin: 0 auto;
      font-size: 13.5px;
      line-height: 1.65;
    }
    /* ── Header ─────────────────────────── */
    .export-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 36px;
    }
    .export-logo {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #5BC5D0, #4facb8);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 700; font-size: 12px; letter-spacing: 0.05em;
    }
    .export-title { font-size: 18px; font-weight: 600; color: #0f172a; }
    .export-meta  { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    /* ── Messages ───────────────────────── */
    .message { margin-bottom: 28px; }
    .message-label {
      font-size: 10.5px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: #64748b; margin-bottom: 6px;
    }
    .message-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .bot-avatar {
      width: 24px; height: 24px;
      background: linear-gradient(135deg, #5BC5D0, #4facb8);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 8px; font-weight: 700; flex-shrink: 0;
    }
    .message-bubble {
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 13.5px;
      line-height: 1.65;
    }
    .user-bubble {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      margin-left: auto;
      max-width: 90%;
      display: inline-block;
    }
    .user-message { text-align: right; }
    .user-message .message-label { text-align: right; color: #5BC5D0; }
    .bot-bubble {
      background: #ffffff;
      border: 1px solid #e8edf4;
      color: #1e293b;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    /* ── Markdown elements inside bot bubble ── */
    .bot-bubble h1, .bot-bubble h2, .bot-bubble h3 {
      font-weight: 600; margin: 14px 0 6px; color: #0f172a;
    }
    .bot-bubble h1 { font-size: 16px; }
    .bot-bubble h2 { font-size: 14.5px; }
    .bot-bubble h3 { font-size: 13.5px; }
    .bot-bubble p  { margin: 6px 0; }
    .bot-bubble strong { font-weight: 600; color: #0f172a; }
    .bot-bubble em { font-style: italic; }
    .bot-bubble code {
      font-family: 'Menlo', 'Consolas', monospace;
      background: #f1f5f9; border-radius: 4px;
      padding: 1px 5px; font-size: 12px; color: #0f172a;
    }
    .bot-bubble ul, .bot-bubble ol {
      padding-left: 20px; margin: 6px 0;
    }
    .bot-bubble li { margin: 3px 0; }
    .bot-bubble table {
      border-collapse: collapse;
      width: 100%; margin: 12px 0; font-size: 12.5px;
    }
    .bot-bubble th {
      background: #5BC5D0; color: white;
      padding: 7px 12px; text-align: left; font-weight: 600;
    }
    .bot-bubble td {
      padding: 6px 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    .bot-bubble tr:nth-child(even) td { background: #f8fafc; }
    /* ── Separator ──────────────────────── */
    .msg-divider {
      border: none; border-top: 1px dashed #e2e8f0;
      margin: 24px 0;
    }
    /* ── Footer ─────────────────────────── */
    .export-footer {
      margin-top: 48px; padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px; color: #94a3b8; text-align: center;
    }
    @media print {
      body { padding: 24px 32px; }
      .message { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="export-header">
    <div class="export-logo">DC</div>
    <div>
      <div class="export-title">${activeChatTitle || 'Chat Export'}</div>
      <div class="export-meta">Exported on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} &nbsp;·&nbsp; ${messages.length} message${messages.length !== 1 ? 's' : ''}</div>
    </div>
  </div>
  ${messagesHtml}
  <div class="export-footer">Generated by DataChat</div>
  <script>window.onload = () => { setTimeout(() => window.print(), 400); };<\/script>
</body>
</html>`;

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
    }
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

  // Invalidate cached file list after a successful upload
  useEffect(() => {
    if (uploadStatus?.rows_inserted != null) {
      setUploadedFiles(null);
    }
  }, [uploadStatus]);

  // Close datasource dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dsDropdownRef.current && !dsDropdownRef.current.contains(event.target)) {
        setDsDropdownOpen(false);
      }
    };
    if (dsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dsDropdownOpen]);

  async function handleDsDropdownToggle() {
    if (dsDropdownOpen) {
      setDsDropdownOpen(false);
      return;
    }
    setDsDropdownOpen(true);
    if (uploadedFiles === null) {
      try {
        const files = await getUploadedFiles();
        setUploadedFiles(files);
      } catch {
        setUploadedFiles([]);
      }
    }
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

  function handleFollowUpQuestion(question) {
    setInput(question);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => {
      const textarea = document.querySelector("textarea");
      textarea?.focus();
    }, 100);
  }

  const STARTER_QUESTIONS = [
    "Which pass type generates the most revenue?",
    "How does monthly revenue trend over time?",
    "What is the refund rate by transaction type?",
    "Which month had the highest number of new purchases?",
    "How much revenue came from Annual vs Month passes?",
  ];

  const isEmptyChat = messages.length <= 1;

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
            <div className="relative" ref={dsDropdownRef}>
              <button
                onClick={handleDsDropdownToggle}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                <Database size={12} />
                <span>Uploaded Files</span>
                <ChevronDown size={12} className={`transition-transform ${dsDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dsDropdownOpen && (
                <div className={`absolute right-0 top-full mt-1 w-72 rounded-lg shadow-lg z-50 border overflow-hidden ${darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}>
                  <div className={`px-3 py-2 text-xs font-medium border-b ${darkMode ? "border-slate-700 text-slate-400" : "border-gray-100 text-gray-400"}`}>
                    Uploaded Files
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {uploadedFiles === null ? (
                      <div className={`px-3 py-4 text-xs text-center ${darkMode ? "text-slate-400" : "text-gray-400"}`}>
                        Loading...
                      </div>
                    ) : uploadedFiles.length === 0 ? (
                      <div className={`px-3 py-4 text-xs text-center ${darkMode ? "text-slate-400" : "text-gray-400"}`}>
                        No files uploaded yet.
                      </div>
                    ) : (
                      uploadedFiles.map((f, i) => (
                        <div key={i} className={`px-3 py-2 text-xs ${darkMode ? "hover:bg-slate-800 border-slate-800" : "hover:bg-gray-50 border-gray-50"} ${i > 0 ? "border-t" : ""}`}>
                          <div className={`font-medium truncate ${darkMode ? "text-slate-200" : "text-gray-700"}`}>{f.filename}</div>
                          <div className={`mt-0.5 flex gap-3 ${darkMode ? "text-slate-400" : "text-gray-400"}`}>
                            <span>{f.rows_inserted.toLocaleString()} rows</span>
                            <span>{new Date(f.uploaded_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          <button className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"}`}
            onClick={(e) => handleMenuOpen(e, "current-chat")}
          >
            <MoreHorizontal size={18} className={darkMode ? "text-slate-200" : "text-black"} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div id="chat-messages-container" className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessage key={msg.id} text={msg.text} />
          ) : (
            <BotMessage key={msg.id} followUpQuestions={msg.followUpQuestions} onSelectFollowUp={handleFollowUpQuestion} rawText={msg.text}>
              <div className={`prose prose-sm max-w-none transition-colors prose-table:w-full prose-td:border prose-td:border-gray-300 prose-th:border prose-th:border-gray-300 prose-td:px-2 prose-td:py-1 prose-th:px-2 prose-th:py-1 ${darkMode ? "prose-invert prose-headings:text-white prose-p:text-slate-100 prose-strong:text-white prose-li:text-slate-100" : "prose-headings:text-gray-900 prose-p:text-gray-800 prose-strong:text-gray-900 prose-li:text-gray-800"}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatFlattenedTable(msg.text)}</ReactMarkdown>
              </div>
              {msg.chart_data && <span data-msg-id={msg.id}><ChartBlock chartData={msg.chart_data} /></span>}
              {msg.attachment && <PdfAttachment name={msg.attachment} />}
            </BotMessage>
          )
        )}
        {isEmptyChat && !isLoading && (
          <div className="mt-6">
            <p className={`text-xs mb-3 ${darkMode ? "text-slate-400" : "text-gray-400"}`}>
              Suggested questions to get started:
            </p>
            <FollowUpQuestions
              questions={STARTER_QUESTIONS}
              onSelectQuestion={handleFollowUpQuestion}
            />
          </div>
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
        <UploadStatusBar
          uploadStatus={uploadStatus}
          darkMode={darkMode}
          onCancelUpload={onCancelUpload}
        />

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
                disabled={uploadStatus?.phase === "uploading" || uploadStatus?.phase === "processing"}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${darkMode ? "hover:bg-slate-800 text-slate-300 hover:text-slate-100" : "hover:bg-gray-100 text-gray-700 hover:text-gray-600"}`}
                title="Upload CSV"
              >
                <Paperclip size={16} />
              </button>
              <button
                onClick={() => setShowReportModal(true)}
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
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${input.trim() && !isLoading
                  ? darkMode
                    ? "bg-indigo-500 text-white hover:bg-indigo-600"
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
            onClick={() => { onViewSummary(); setOpenMenu(null); }}
            className={`w-full text-left px-3 py-1.5 text-sm ${darkMode ? "hover:bg-slate-800 text-slate-100" : "hover:bg-gray-100"}`}
          >
            View Summary
          </button>
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
            Export to TXT
          </button>
          <button
            onClick={handleExportPdf}
            className={`w-full text-left px-3 py-1.5 text-sm ${darkMode ? "hover:bg-slate-800 text-slate-100" : "hover:bg-gray-100"}`}
          >
            Export to PDF
          </button>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className={`rounded-xl shadow-lg p-5 w-80 ${darkMode ? "bg-slate-800 text-white" : "bg-white text-gray-900"}`}>
            <p className="text-sm font-medium mb-4">Are you sure you want to clear this chat?</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className={`px-3 py-1.5 text-sm rounded-lg ${darkMode ? "hover:bg-slate-700 text-slate-200" : "hover:bg-gray-100 text-gray-600"}`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearChat();
                  setShowClearConfirm(false);
                }}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <ReportModal
          darkMode={darkMode}
          onClose={() => setShowReportModal(false)}
          onGenerate={handleGenerateReports}
          isGenerating={isGeneratingReports}
        />
      )}
    </div>
  );
}
