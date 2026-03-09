import { LayoutTemplate, ExternalLink } from "lucide-react";

{/* Eventually we will have to redevlop this with the real chat output in mind */}

const LEGEND = [
  { label: "New Subscriptions", color: "bg-purple-400", pct: "28%" },
  { label: "Previous Subscriptions", color: "bg-blue-500", pct: "58%" },
  { label: "Lost Subscriptions", color: "bg-orange-400", pct: "14%" },
];

const BAR_HEIGHTS = [65, 90, 75, 100, 95, 80, 110, 88, 92, 85, 105, 78];

export default function RightPanel() {
  return (
    <aside className="w-96 flex-shrink-0 border-l border-gray-100 bg-white flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
        <LayoutTemplate size={18} className="text-gray-500" />
        <button className="p-1 rounded hover:bg-gray-100">
          <ExternalLink size={15} className="text-gray-400" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Donut chart card */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-800 mb-3">
            Change in Subscriptions from Jan 2025 to Jan 2026
          </h4>
          <div className="flex justify-center gap-6 py-4">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="28" fill="none" stroke="#3b82f6" strokeWidth="14" strokeDasharray="102 175" strokeDashoffset="0" />
              <circle cx="40" cy="40" r="28" fill="none" stroke="#a855f7" strokeWidth="14" strokeDasharray="49 175" strokeDashoffset="-102" />
              <circle cx="40" cy="40" r="28" fill="none" stroke="#f97316" strokeWidth="14" strokeDasharray="24 175" strokeDashoffset="-151" />
            </svg>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="28" fill="none" stroke="#3b82f6" strokeWidth="14" strokeDasharray="115 175" strokeDashoffset="0" />
              <circle cx="40" cy="40" r="28" fill="none" stroke="#a855f7" strokeWidth="14" strokeDasharray="35 175" strokeDashoffset="-115" />
              <circle cx="40" cy="40" r="28" fill="none" stroke="#f97316" strokeWidth="14" strokeDasharray="25 175" strokeDashoffset="-150" />
            </svg>
          </div>
          <div className="space-y-1.5 mt-2">
            {LEGEND.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-xs text-gray-600">{item.label}</span>
                </div>
                <span className="text-xs font-medium text-gray-700">{item.pct}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart card */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-800 mb-3">
            Subscriptions per day in the month of January
          </h4>
          <div className="flex items-end gap-1 h-24">
            {BAR_HEIGHTS.map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-teal-400 rounded-t-sm opacity-90 hover:opacity-100 transition-opacity"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
