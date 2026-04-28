import { useState, useEffect, useRef, useContext } from "react";
import { DarkModeContext } from "../DarkModeContext"
import { X, User, Lock, LogOut, Trash2, Sun, MoreHorizontal, Pencil } from "lucide-react";
import { getArchivedSessions } from "../../api/chatSessions";

export default function SettingsModal({ user, onClose, onLogout, onDelete, onRestoreChat, changeName, changePassword, changeEmail }) {
  const { darkMode, setDarkMode } = useContext(DarkModeContext);
  const [archivedSessions, setArchivedSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [editableName, setEditableName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  // track which archived item's menu is open (id acts as key)
  const [openMenu, setOpenMenu] = useState(null);
  const modalRef = useRef(null);
  const menuRef = useRef(null);


  // Fetch archived sessions when modal opens
  useEffect(() => {
    const fetchArchivedSessions = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const sessions = await getArchivedSessions(user.id);
        setArchivedSessions(sessions);
      } catch (error) {
        console.error("Failed to fetch archived sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedSessions();
  }, [user?.id]);

  const currentName = user?.display_name || user?.email?.split("@")[0] || "User";

  useEffect(() => {
    setEditableName(currentName);
  }, [currentName]);

  const handleRestore = async (sessionId) => {
    try {
      await onRestoreChat(sessionId);
      setArchivedSessions(archivedSessions.filter(s => s.id !== sessionId));
      setOpenMenu(null);
    } catch (error) {
      console.error("Failed to restore session:", error);
    }
  };

  const handleOpenNameModal = () => {
    setEditableName(currentName);
    setNameError("");
    setNameSuccess("");
    setShowNameModal(true);
  };

  const handleSaveName = async () => {
    if (typeof changeName !== "function") {
      setNameError("Name change is not available right now.");
      return;
    }

    const trimmed = editableName.trim();
    if (trimmed.length < 2) {
      setNameError("Name must be at least 2 characters.");
      setNameSuccess("");
      return;
    }

    if (trimmed === currentName) {
      setNameError("Please enter a new name before saving.");
      setNameSuccess("");
      return;
    }

    try {
      setIsSavingName(true);
      setNameError("");
      await changeName(trimmed);
      setNameSuccess("Name updated successfully.");
      setShowNameModal(false);
    } catch (error) {
      setNameSuccess("");
      setNameError(error?.message || "Failed to update name.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleOpenPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setShowPasswordModal(true);
  };

  const handleSavePassword = async () => {
    if (typeof changePassword !== "function") {
      setPasswordError("Password change is not available right now.");
      return;
    }

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      setPasswordSuccess("");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      setPasswordSuccess("");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      setPasswordSuccess("");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError("New password must be different from the current one.");
      setPasswordSuccess("");
      return;
    }

    try {
      setIsSavingPassword(true);
      setPasswordError("");
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess("Password updated successfully.");
      setShowPasswordModal(false);
    } catch (error) {
      setPasswordSuccess("");
      setPasswordError(error?.message || "Failed to update password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking on the menu button itself
      if (event.target.closest('[data-menu-button]')) return;

      if (menuRef.current && !menuRef.current.contains(event.target)) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
    <div ref={modalRef} className={`relative rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[85vh] overflow-y-auto ${darkMode ? "bg-black" : "bg-white"}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-5 border-b ${darkMode ? "border-slate-800" : "border-gray-100"}`}>
          <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-black"}`}>Settings</h2>
          <button onClick={onClose} className={`p-1 rounded-full transition-colors ${darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}>
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Profile */}
          <section>
            <h3 className={`text-sm font-semibold text-gray-900 mb-3 ${darkMode ? "text-white" : "text-black"}`}>Profile</h3>
            <div className={`border-t ${darkMode ? "border-slate-800" : "border-gray-100"}`} />
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className={`flex items-center gap-3 ${darkMode ? "text-slate-400" : "text-gray-600"}`}>
                  <User size={16} />
                  <span className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>Name</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${darkMode ? "text-white" : "text-black"}`}>{currentName}</span>
                  <button
                    onClick={handleOpenNameModal}
                    className={`p-1.5 rounded-lg transition-colors ${darkMode ? "hover:bg-slate-700 text-slate-400 hover:text-white" : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"}`}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
              {nameError && <p className="text-xs text-red-500">{nameError}</p>}
              {nameSuccess && <p className="text-xs text-emerald-500">{nameSuccess}</p>}
              
              <div className="flex items-center justify-between py-2">
                <div className={`flex items-center gap-3 ${darkMode ? "text-slate-400" : "text-gray-600"}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>Email</span>
                </div>
                <span className={`text-sm text-gray-900 font-medium ${darkMode ? "text-white" : "text-black"}`}>{user?.email || "user@example.com"}</span>
              </div>
            </div>
          </section>

          {/* Account */}
          <section>
            <h3 className={`text-sm font-semibold text-gray-900 mb-3 ${darkMode ? "text-white" : "text-black"}`}>Account</h3>
            <div className={`border-t ${darkMode ? "border-slate-800" : "border-gray-100"}`} />
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className={`flex items-center gap-3 ${darkMode ? "text-slate-400" : "text-gray-600"}`}>
                  <Lock size={16} />
                  <span className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>Change Password</span>
                </div>
                <button
                  onClick={handleOpenPasswordModal}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full hover:bg-gray-700 transition-colors ${darkMode ? "bg-white text-black" : "bg-black text-white"}`}>
                  Password Reset
                </button>
              </div>
              {passwordSuccess && <p className="text-xs text-emerald-500">{passwordSuccess}</p>}
              <div className="flex items-center justify-between py-2">
                <div className={`flex items-center gap-3 ${darkMode ? "text-slate-400" : "text-gray-600"}`}>
                  <LogOut size={16} />
                  <span className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>Sign Out</span>
                </div>
                <button
                  onClick={onLogout}
                  className={`px-4 py-1.5 bg-gray-900 text-xs font-medium rounded-full hover:bg-gray-700 transition-colors ${darkMode ? "bg-white text-black" : "bg-black text-white"}`}>
                  Sign Out
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className={`flex items-center gap-3 ${darkMode ? "text-slate-400" : "text-gray-600"}`}>
                  <Trash2 size={16} />
                  <span className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>Delete Account</span>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
                      onDelete();
                    }
                  }}
                  className={`px-4 py-1.5 text-white text-xs font-medium rounded-full hover:bg-red-600 transition-colors bg-red-600`}>
                  Delete Account
                </button>
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section>
            <h3 className={`text-sm font-semibold mb-3 ${darkMode ? "text-white" : "text-black"}`}>Appearance</h3>
            <div className={`border-t ${darkMode ? "border-slate-800" : "border-gray-100"}`} />
            <div className="mt-3">
              <div className="flex items-center justify-between py-2">
                <div className={`flex items-center gap-3 ${darkMode ? "text-slate-400" : "text-gray-600"}`}>
                  <Sun size={16} />
                  <span className={`text-sm ${darkMode ? "text-white" : "text-black"}`}>Theme: {darkMode ? "Dark" : "Light"}</span>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${darkMode ? "bg-gray-400" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Archived */}
          <section>
            <h3 className={`text-sm font-semibold text-gray-900 mb-3 ${darkMode ? "text-white" : "text-black"}`}>Archived</h3>
            <div className={`border-t ${darkMode ? "border-slate-800" : "border-gray-100"}`} />
            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="text-sm text-gray-500">Loading archived sessions...</div>
              ) : archivedSessions.length === 0 ? (
                <div className="text-sm text-gray-500">No archived sessions</div>
              ) : (
                archivedSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between py-2 relative">
                    <span className={`text-sm text-gray-700 truncate flex-1 ${darkMode ? "text-white" : "text-black"}`}>{session.chat_title}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {new Date(session.last_message_at).toLocaleDateString()}
                      </span>
                      <button
                        data-menu-button
                        className={`p-1 rounded flex-shrink-0 transition-colors ${darkMode ? "hover:bg-slate-700 bg-black text-white" : "hover:bg-gray-100 bg-white text-gray-600"}`}
                        onClick={() => setOpenMenu(openMenu === session.id ? null : session.id)}
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {openMenu === session.id && (
                        <div ref={menuRef} className={`absolute right-0 mt-12 w-32 border rounded shadow-lg z-20 ${darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`} onClick={(e) => e.stopPropagation()}>
                          <button
                            className={`w-full text-left px-3 py-1.5 text-sm ${darkMode ? "hover:bg-slate-800 text-slate-200" : "hover:bg-gray-100 text-gray-800"}`}
                            onClick={() => handleRestore(session.id)}
                          >
                            Restore
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {showNameModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => !isSavingName && setShowNameModal(false)} />
          <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl p-6 ${darkMode ? "bg-neutral-950" : "bg-white"}`}>
            <h3 className={`text-base font-semibold mb-4 ${darkMode ? "text-white" : "text-black"}`}>Change Name</h3>

            <label className={`block text-sm mb-2 ${darkMode ? "text-gray-200" : "text-gray-700"}`}>Display name</label>
            <input
              value={editableName}
              onChange={(e) => setEditableName(e.target.value)}
              disabled={isSavingName}
              className={`w-full px-3 py-2 rounded-md border text-sm ${darkMode ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-gray-300 text-black"}`}
              placeholder="Enter display name"
              autoFocus
            />

            {nameError && <p className="mt-2 text-xs text-red-500">{nameError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowNameModal(false)}
                disabled={isSavingName}
                className={`px-4 py-2 text-xs font-medium rounded-full border transition-colors disabled:opacity-60 ${darkMode ? "border-neutral-700 text-white hover:bg-neutral-900" : "border-gray-300 text-black hover:bg-gray-100"}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveName}
                disabled={isSavingName}
                className={`px-4 py-2 text-xs font-medium rounded-full transition-colors disabled:opacity-60 ${darkMode ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-700"}`}
              >
                {isSavingName ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => !isSavingPassword && setShowPasswordModal(false)} />
          <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl p-6 ${darkMode ? "bg-neutral-950" : "bg-white"}`}>
            <h3 className={`text-base font-semibold mb-4 ${darkMode ? "text-white" : "text-black"}`}>Change Password</h3>

            <label className={`block text-sm mb-2 ${darkMode ? "text-gray-200" : "text-gray-700"}`}>Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isSavingPassword}
              className={`w-full px-3 py-2 rounded-md border text-sm ${darkMode ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-gray-300 text-black"}`}
              placeholder="Enter current password"
              autoFocus
            />

            <label className={`block text-sm mt-3 mb-2 ${darkMode ? "text-gray-200" : "text-gray-700"}`}>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSavingPassword}
              className={`w-full px-3 py-2 rounded-md border text-sm ${darkMode ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-gray-300 text-black"}`}
              placeholder="Enter new password"
            />

            <label className={`block text-sm mt-3 mb-2 ${darkMode ? "text-gray-200" : "text-gray-700"}`}>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSavingPassword}
              className={`w-full px-3 py-2 rounded-md border text-sm ${darkMode ? "bg-neutral-900 border-neutral-700 text-white" : "bg-white border-gray-300 text-black"}`}
              placeholder="Re-enter new password"
            />

            <p className={`mt-2 text-[11px] ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Must be 8+ characters with uppercase, lowercase, number, and special character.
            </p>

            {passwordError && <p className="mt-2 text-xs text-red-500">{passwordError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                disabled={isSavingPassword}
                className={`px-4 py-2 text-xs font-medium rounded-full border transition-colors disabled:opacity-60 ${darkMode ? "border-neutral-700 text-white hover:bg-neutral-900" : "border-gray-300 text-black hover:bg-gray-100"}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePassword}
                disabled={isSavingPassword}
                className={`px-4 py-2 text-xs font-medium rounded-full transition-colors disabled:opacity-60 ${darkMode ? "bg-white text-black hover:bg-gray-200" : "bg-black text-white hover:bg-gray-700"}`}
              >
                {isSavingPassword ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
