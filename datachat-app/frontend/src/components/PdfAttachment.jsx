import { ChevronRight } from "lucide-react";

export default function PdfAttachment({ name }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
      <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">PDF</span>
      <span className="text-sm text-gray-700">{name}</span>
      <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
    </div>
  );
}
