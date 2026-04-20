import { useContext } from "react";
import { DarkModeContext } from "../DarkModeContext";

export default function FollowUpQuestions({ questions, onSelectQuestion }) {
  const { darkMode } = useContext(DarkModeContext);

  if (!questions || questions.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {questions.map((question, index) => (
        <button
          key={index}
          onClick={() => onSelectQuestion(question)}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${
            darkMode
              ? "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800"
              : "bg-cyan-100 text-cyan-900 hover:bg-cyan-200 active:bg-cyan-300"
          }`}
        >
          {question}
        </button>
      ))}
    </div>
  );
}
