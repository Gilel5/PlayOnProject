import { ChevronRight } from "lucide-react";
import { useContext } from "react";
import { DarkModeContext } from "./DarkModeContext";

export default function PdfAttachment({ name }) {
  const { darkMode } = useContext(DarkModeContext);
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 border rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group ${darkMode ? "bg-gray-800 border-gray-600" : "bg-white border-gray-200"}`}>
      <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">PDF</span>
      <span className={`text-sm ${darkMode ? "text-gray-200" : "text-gray-700"}`}>{name}</span>
      <ChevronRight size={14} className={`group-hover:text-gray-600 transition-colors ${darkMode ? "text-gray-500 group-hover:text-gray-300" : "text-gray-400"}`} />
    </div>
  );
}
