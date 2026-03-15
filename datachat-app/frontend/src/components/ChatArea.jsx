import { useRef } from "react";
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
}) {
  const messagesEndRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
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
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <MoreHorizontal size={18} className="text-gray-500" />
          </button>
          <button
            onClick={onRightPanelToggle}
            className={`p-1.5 rounded-lg transition-colors ${
              rightPanelOpen ? "bg-gray-100 text-gray-800" : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            <LayoutTemplate size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
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
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
              <Paperclip size={16} />
            </button>
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
    </div>
  );
}
