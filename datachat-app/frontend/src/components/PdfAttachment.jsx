import { ChevronRight } from "lucide-react";
import { useContext } from "react";
import { DarkModeContext } from "./DarkModeContext";

export default function PdfAttachment({ name }) {
  const { darkMode } = useContext(DarkModeContext);
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 border rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group ${darkMode ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-200"}`}>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${darkMode ? "text-red-400 bg-red-950" : "text-red-500 bg-red-50"}`}>PDF</span>
      <span className={`text-sm ${darkMode ? "text-slate-200" : "text-gray-700"}`}>{name}</span>
      <ChevronRight size={14} className={`transition-colors ${darkMode ? "text-slate-400 group-hover:text-slate-200" : "text-gray-400 group-hover:text-gray-600"}`} />
    </div>
  );
}
