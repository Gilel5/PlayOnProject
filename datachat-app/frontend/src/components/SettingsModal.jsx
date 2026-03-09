import { useState } from "react";
import { X, User, Lock, LogOut, Trash2, Sun, MoreHorizontal } from "lucide-react";
import { ARCHIVED } from "../data/mockData";

export default function SettingsModal({ user, onClose, onLogout }) {
  const [darkMode, setDarkMode] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Profile */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Profile</h3>
            <div className="border-t border-gray-100" />
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 text-gray-600">
                  <User size={16} />
                  <span className="text-sm">Name</span>
                </div>
                <span className="text-sm text-gray-900 font-medium">{user?.name || "User"}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 text-gray-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span className="text-sm">Email</span>
                </div>
                <span className="text-sm text-gray-900 font-medium">{user?.email || "user@example.com"}</span>
              </div>
            </div>
          </section>

          {/* Account */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Account</h3>
            <div className="border-t border-gray-100" />
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 text-gray-600">
                  <Lock size={16} />
                  <span className="text-sm">Change Password</span>
                </div>
                <button className="px-4 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-full hover:bg-gray-700 transition-colors">
                  Password Reset
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 text-gray-600">
                  <LogOut size={16} />
                  <span className="text-sm">Sign Out</span>
                </div>
                <button
                  onClick={onLogout}
                  className="px-4 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-full hover:bg-gray-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 text-gray-600">
                  <Trash2 size={16} />
                  <span className="text-sm">Delete Account</span>
                </div>
                <button className="px-4 py-1.5 bg-red-500 text-white text-xs font-medium rounded-full hover:bg-red-600 transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Appearance</h3>
            <div className="border-t border-gray-100" />
            <div className="mt-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3 text-gray-600">
                  <Sun size={16} />
                  <span className="text-sm">Theme</span>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${darkMode ? "bg-gray-900" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Archived */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Archived</h3>
            <div className="border-t border-gray-100" />
            <div className="mt-3 space-y-2">
              {ARCHIVED.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">Archive Date: {item.date}</span>
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <MoreHorizontal size={14} className="text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
