import { Menu, Plus, Search, Settings, User } from "lucide-react";
import { PINNED_CHATS, CHATS } from "../data/mockData";
import { useState } from "react";

export default function Sidebar({ user, activeChat, setActiveChat, onClose, onSettingsOpen }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPinned = PINNED_CHATS.filter((c) =>
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredChats = CHATS.filter((c) =>
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={18} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-300 text-gray-900 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="#0d9488"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">DataChat</span>
          </div>
        </div>
        <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <Plus size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1 min-w-0"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-4">
        {filteredPinned.length > 0 && (
          <div>
            <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Pinned Chats
            </p>
            {filteredPinned.map((chat) => (
              <button
                key={chat}
                onClick={() => setActiveChat(chat)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  activeChat === chat
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {chat}
              </button>
            ))}
          </div>
        )}
        {filteredChats.length > 0 && (
          <div>
            <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Chats
            </p>
            {filteredChats.map((chat) => (
              <button
                key={chat}
                onClick={() => setActiveChat(chat)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  activeChat === chat
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {chat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User + settings */}
      <div className="border-t border-gray-100 px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <User size={15} className="text-gray-600" />
          </div>
          <span className="text-sm font-medium text-gray-800 truncate max-w-[120px]">
            {user?.name || user?.email?.split("@")[0] || "User"}
          </span>
        </div>
        <button
          onClick={onSettingsOpen}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Settings size={16} className="text-gray-500" />
        </button>
      </div>
    </aside>
  );
}
