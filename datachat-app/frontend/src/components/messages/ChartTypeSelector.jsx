import { useContext } from "react";
import { DarkModeContext } from "../DarkModeContext";
import { BarChart3, TrendingUp, PieChart, Layers, Plus } from "lucide-react";

const CHART_TYPE_CONFIG = {
  bar: { icon: BarChart3, label: "Bar" },
  line: { icon: TrendingUp, label: "Line" },
  area: { icon: Layers, label: "Area" },
  pie: { icon: PieChart, label: "Pie" },
};

export default function ChartTypeSelector({ activeType, suggestedTypes = [], onChange, onAddChart, canAddChart = true }) {
  const { darkMode } = useContext(DarkModeContext);
  const types = suggestedTypes.length > 0 ? suggestedTypes : ["bar", "line", "area", "pie"];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {types.map((type) => {
        const config = CHART_TYPE_CONFIG[type];
        if (!config) return null;
        const Icon = config.icon;
        const isActive = type === activeType;

        return (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all duration-200 border
              ${isActive
                ? darkMode
                  ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-sm shadow-indigo-500/10"
                  : "bg-[#5BC5D0]/15 border-[#5BC5D0]/50 text-[#3a9da6] shadow-sm shadow-[#5BC5D0]/10"
                : darkMode
                  ? "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300"
                  : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }
            `}
          >
            <Icon size={12} />
            <span>{config.label}</span>
          </button>
        );
      })}

      {canAddChart && (
        <>
          <div className={`w-px h-5 mx-1 ${darkMode ? "bg-slate-700" : "bg-gray-200"}`} />
          <button
            onClick={onAddChart}
            className={`
              flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium
              transition-all duration-200 border border-dashed
              ${darkMode
                ? "border-slate-600 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-300 hover:bg-indigo-500/10"
                : "border-gray-300 text-gray-400 hover:border-[#5BC5D0]/50 hover:text-[#3a9da6] hover:bg-[#5BC5D0]/10"
              }
            `}
            title="Add another chart view"
          >
            <Plus size={12} />
            <span>Add View</span>
          </button>
        </>
      )}
    </div>
  );
}
