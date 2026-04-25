import { useContext, useState } from "react";
import { DarkModeContext } from "../DarkModeContext";
import FollowUpQuestions from "./FollowUpQuestions";
import { Copy, Check } from "lucide-react";

export default function BotMessage({ children, followUpQuestions, onSelectFollowUp, rawText }) {
  const { darkMode } = useContext(DarkModeContext);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  async function handleCopy() {
    if (!rawText) return;
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed", e);
    }
  }

  return (
    <div
      className="flex items-start gap-3 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${darkMode ? "bg-indigo-500" : "bg-[#5BC5D0]"}`}>
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
      <div className="flex-1 min-w-0">
        <div className={`max-w-2xl text-sm mt-1.5 ${darkMode ? "text-white" : "text-black"}`}>{children}</div>
        {followUpQuestions && onSelectFollowUp && (
          <FollowUpQuestions questions={followUpQuestions} onSelectQuestion={onSelectFollowUp} />
        )}
      </div>
      {/* Copy button — fades in on hover */}
      {rawText && (
        <button
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy response"}
          style={{ opacity: hovered || copied ? 1 : 0, transition: "opacity 0.15s ease" }}
          className={`mt-1 p-1.5 rounded-lg flex-shrink-0 transition-colors ${
            darkMode
              ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          }`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}
