import { User } from "lucide-react";

export default function UserMessage({ text }) {
  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="max-w-md bg-[#5BC5D0] text-black px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm">
        {text}
      </div>
      <div className="w-8 h-8 rounded-full bg-[#5BC5D0] flex items-center justify-center flex-shrink-0 mt-0.5">
        <User size={14} className="text-black" />
      </div>
    </div>
  );
}
