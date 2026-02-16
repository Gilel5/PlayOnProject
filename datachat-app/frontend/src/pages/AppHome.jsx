import { useEffect, useState} from "react";
import { useNavigate } from "react-router-dom";
import { me, refresh, logout as logoutApi} from "../api/auth";

export default function AppHome() {
    const nav = useNavigate();

    const [user, setUser] = useState(null);
    const [err, setErr] = useState(null);

    //Gets an access token:
        // use existing if present
        // else try /auth/refresh using refresh cookie
    async function getAccessToken() {
        const existing = sessionStorage.getItem("access_token");
        if (existing) return existing;

        const data = await refresh();
        sessionStorage.setItem("access_token", data.access_token);
        return data.access_token;
    }

    useEffect(() => {
        (async () => {
            try {
                const token = await getAccessToken();
                const u = await me(token);
                setUser(u);
            } catch (e) {
                setErr("Please login again.");
                nav("/login");
            }
        }) ();
    }, [nav]);

    async function onLogout() {
        try {
            await logoutApi();
        } finally {
            sessionStorage.removeItem("access_token");
            nav("/login");
        }
    }

    if (err) return <p>{err}</p>
    if (!user) return <p>Loading...</p>

    return (
        <div style={{maxWidth: 720, margin: "60px auto"}}>
            <h1>Protected App</h1>
            <p>
                Logged in as: <b>{user.email}</b>
            </p>
            <button onClick={onLogout}>Logout</button>
        </div>
    );
 }