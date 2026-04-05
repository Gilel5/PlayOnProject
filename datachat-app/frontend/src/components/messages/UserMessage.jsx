import { useContext } from "react";
import { User } from "lucide-react";
import { DarkModeContext } from "../DarkModeContext";

export default function UserMessage({ text }) {
  const { darkMode } = useContext(DarkModeContext);

  return (
    <div className="flex items-start gap-3 justify-end">
      <div className={`max-w-md px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm ${darkMode ? "bg-indigo-500 text-white" : "bg-[#5BC5D0] text-black"}`}>
        {text}
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${darkMode ? "bg-indigo-500" : "bg-[#5BC5D0]"}`}>
        <User size={14} className={darkMode ? "text-white" : "text-black"} />
      </div>
    </div>
  );
}
