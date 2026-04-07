import { X } from "lucide-react";
import { useContext } from "react";
import { DarkModeContext } from "./DarkModeContext";

export default function File({ label, onRemove }) {
  const { darkMode } = useContext(DarkModeContext);
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${darkMode ? "bg-indigo-500 text-white" : "bg-[#5BC5D0] text-gray-700"}`}>
      {label}
      <button onClick={onRemove} className={`transition-colors ${darkMode ? "hover:text-black" : "hover:text-gray-900"}`}>
        <X size={11} />
      </button>
    </span>
  );
}
