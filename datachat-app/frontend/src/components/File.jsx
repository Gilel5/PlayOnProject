import { X } from "lucide-react";

export default function File({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-100 text-gray-700 text-xs font-medium rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-gray-900 transition-colors">
        <X size={11} />
      </button>
    </span>
  );
}
