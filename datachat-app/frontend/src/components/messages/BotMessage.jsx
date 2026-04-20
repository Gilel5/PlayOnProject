import { useContext } from "react";
import { DarkModeContext } from "../DarkModeContext";
import FollowUpQuestions from "./FollowUpQuestions";

export default function BotMessage({ children, followUpQuestions, onSelectFollowUp }) {
  const { darkMode } = useContext(DarkModeContext);

  return (
    <div className="flex items-start gap-3">
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
      <div className="flex-1">
        <div className={`max-w-2xl text-sm mt-1.5 ${darkMode ? "text-white" : "text-black"}`}>{children}</div>
        {followUpQuestions && onSelectFollowUp && (
          <FollowUpQuestions questions={followUpQuestions} onSelectQuestion={onSelectFollowUp} />
        )}
      </div>
    </div>
  );
}
