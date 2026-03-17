import { Menu, Plus, Search, Settings, User, MoreHorizontal } from "lucide-react";
import { useState, useEffect, useRef } from "react";


export default function Sidebar({
  user,
  sessions,
  activeChatId,
  onSelectChat,
  onCreateChat,
  onTogglePin,
  onDeleteChat,
  onRenameChat,
  onArchiveChat,
  onClose,
  onSettingsOpen,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  // Position of the dropdown menu (fixed to avoid being clipped by overflow container)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  // Tracks which session is being renamed and the current input value
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const sidebarRef = useRef(null);
  const renameInputRef = useRef(null);

  // Close menu when clicking outside the sidebar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };

    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenu]);

  // Focus and select the rename input text when it appears
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Open the context menu — calculate fixed position from the button's location
  // so the dropdown is not clipped by the overflow-y-auto scroll container
  function handleMenuOpen(e, chatId) {
    e.stopPropagation();
    if (openMenu === chatId) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenMenu(chatId);
  }

  function startRename(chat) {
    setRenamingId(chat.id);
    setRenameValue(chat.chat_title);
    setOpenMenu(null);
  }

  function submitRename(sessionId) {
    if (renameValue.trim()) {
      onRenameChat(sessionId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  }

  const filteredSessions = sessions.filter((session) =>
    session.chat_title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredPinned = filteredSessions.filter((session) => session.is_pinned);
  const filteredChats = filteredSessions.filter((session) => !session.is_pinned);

  // The session whose context menu is currently open
  const activeMenuSession = sessions.find((s) => s.id === openMenu);

  return (
    <aside ref={sidebarRef} className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-full">
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
            <div className="w-8 h-6 rounded-lg bg-[#5BC5D0] text-gray-900 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="black"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">DataChat</span>
          </div>
        </div>
        <button onClick={onCreateChat} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
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
              <div key={chat.id} className="relative group">
                {renamingId === chat.id ? (
                  // Inline rename input replaces the title button while renaming
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => submitRename(chat.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename(chat.id);
                      if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-sm border border-[#5BC5D0] outline-none bg-white"
                  />
                ) : (
                  <button
                    onClick={() => { onSelectChat(chat.id); setOpenMenu(null); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors pr-10 ${
                      activeChatId === chat.id ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate block">{chat.chat_title}</span>
                  </button>
                )}
                {renamingId !== chat.id && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                    onClick={(e) => handleMenuOpen(e, chat.id)}
                  >
                    <MoreHorizontal size={14} className="text-black" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {filteredChats.length > 0 && (
          <div>
            <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Chats
            </p>
            {filteredChats.map((chat) => (
              <div key={chat.id} className="relative group">
                {renamingId === chat.id ? (
                  // Inline rename input replaces the title button while renaming
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => submitRename(chat.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename(chat.id);
                      if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-sm border border-[#5BC5D0] outline-none bg-white"
                  />
                ) : (
                  <button
                    onClick={() => { onSelectChat(chat.id); setOpenMenu(null); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors pr-10 ${
                      activeChatId === chat.id ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate block">{chat.chat_title}</span>
                  </button>
                )}
                {renamingId !== chat.id && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                    onClick={(e) => handleMenuOpen(e, chat.id)}
                  >
                    <MoreHorizontal size={14} className="text-black" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context menu — rendered with fixed position so it is never clipped by the scroll container */}
      {openMenu && activeMenuSession && (
        <div
          style={{ position: "fixed", top: menuPosition.top, right: menuPosition.right }}
          className="w-36 bg-white border border-gray-200 rounded shadow-lg z-50"
        >
          <button
            onClick={() => startRename(activeMenuSession)}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Rename Chat
          </button>
          <button
            onClick={() => { onTogglePin(openMenu); setOpenMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            {activeMenuSession.is_pinned ? "Unpin Chat" : "Pin Chat"}
          </button>
          <button
            onClick={() => { onArchiveChat(openMenu); setOpenMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Archive Chat
          </button>
          <button
            onClick={() => { onDeleteChat(openMenu); setOpenMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Delete Chat
          </button>
        </div>
      )}

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
