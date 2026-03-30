import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register as registerApi } from "../api/auth";
import { DarkModeContext } from "../components/DarkModeContext";

export default function Register() {
  const { darkMode } = useContext(DarkModeContext);
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const data = await registerApi(email, password);
      sessionStorage.setItem("access_token", data.access_token);
      nav("/app");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 transition-colors ${darkMode ? "bg-black" : "bg-gray-50"}`}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm ${darkMode ? "bg-indigo-500" : "bg-[#5BC5D0]"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>DataChat</h1>
          <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>Create your account</p>
        </div>

        {/* Card */}
        <div className={`rounded-2xl shadow-sm border px-6 py-7 ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-100"}`}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? "text-gray-200" : "text-gray-700"}`}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-[#5BC5D0] focus:border-transparent transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-white placeholder-slate-400" : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? "text-gray-200" : "text-gray-700"}`}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-[#5BC5D0] focus:border-transparent transition-all ${darkMode ? "bg-slate-800 border-slate-700 text-white placeholder-slate-400" : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"}`}
              />
            </div>

            {err && (
              <p className={`text-xs px-3 py-2 rounded-lg ${darkMode ? "text-red-400 bg-red-950/50" : "text-red-500 bg-red-50"}`}>{err}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 text-white text-sm font-medium rounded-xl transition-colors mt-1 ${darkMode ? "bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-400" : "bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300"}`}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <p className={`text-center text-sm mt-4 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
          Already have an account?{" "}
          <Link to="/login" className={`font-medium hover:underline ${darkMode ? "text-indigo-400" : "text-[#5BC5D0]"}`}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
