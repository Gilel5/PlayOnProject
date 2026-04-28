import { Upload } from "lucide-react";
import { useContext } from "react";
import { DarkModeContext } from "../DarkModeContext";

export default function UploadProgress({ progress, onCancel }) {
  const { darkMode } = useContext(DarkModeContext);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/10">
      <div className={`${darkMode ? "bg-slate-900 border border-slate-700" : "bg-white"} rounded-2xl p-10 flex flex-col items-center shadow-xl`}>
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Background ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={darkMode ? "#334155" : "#e5e7eb"}
              strokeWidth="8"
            />
            {/* Progress arc */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#4F7EF7"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-300"
            />
          </svg>
          {/* Icon and percentage */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Upload size={28} className="text-[#4F7EF7]" />
            <span className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-gray-700"}`}>{progress}%</span>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="mt-6 text-xs text-red-400 hover:text-red-600 underline"
        >
          Cancel Upload
        </button>
      </div>
    </div>
  );
}
