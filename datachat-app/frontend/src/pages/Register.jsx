import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register as registerApi } from "../api/auth";

export default function Register() {
    const nav = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [err, setErr] = useState(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setErr(null);
        setLoading(true);

        try{
            // calls backend /auth/Login and returns {access_token, token type }
            // Backend should also set refresh cookie (httpOnly)
            const data = await registerApi(email, password);

            //Store access tken
            sessionStorage.setItem("access_token", data.access_token);

            //Go to protected area
            nav("/app");
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: 420, margin: "80px auto" }}>
      <h1>Register</h1>

      <form onSubmit={onSubmit}>
        <div style={{ marginTop: 12 }}>
          <label>Email</label>
          <input
            style={{ width: "100%" }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Password</label>
          <input
            style={{ width: "100%" }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {err && <p style={{ color: "crimson" }}>{err}</p>}

        <button style={{ width: "100%", marginTop: 16 }} disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
    );
}