import { api } from "./http";

// res.data : whatever JSON the server returns

//Helper: extract a message from axios errors
// Helper to extract a friendly message from axios/FastAPI errors
function getAxiosErrorMessage(err) {
  const detail = err?.response?.data?.detail;

  // FastAPI validation errors often come back as an array
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item.msg).join(", ");
  }

  // Sometimes detail is already a string
  if (typeof detail === "string") {
    return detail;
  }

  // Other APIs may return "message"
  if (typeof err?.response?.data?.message === "string") {
    return err.response.data.message;
  }

  // Generic axios message fallback
  if (typeof err?.message === "string") {
    return err.message;
  }

  return "Request failed";
}

export async function register(email, password) {
    try {
        //Post to /auth/register with credentials
        //using the shared api instance keeps baseURL / credential settings centralized
        const res = await api.post("/auth/register", {email, password});
        return res.data; // access_token, token_type
    } catch (err) {
        throw new Error(getAxiosErrorMessage(err));
    }
}

export async function login(email, password) {
    try{
        const res = await api.post("/auth/login", {email, password});
        return res.data;
    } catch (err) {
        throw new Error(getAxiosErrorMessage(err));
    }
}

export async function refresh() {
    try {
        const res = await api.post("/auth/refresh");
        return res.data;
    } catch (err) {
        throw new Error(getAxiosErrorMessage(err));
    }
}

export async function logout() {
    try {
        const res = await api.post("/auth/logout");
        return res.data;
    } catch (err) {
        throw new Error(getAxiosErrorMessage(err));
    }
}

export async function me(accessToken) {
    try {
        const res = await api.get("/auth/me", {
            headers: {Authorization: "Bearer " + accessToken},
        });
        return res.data;
    } catch (err) {
        throw new Error(getAxiosErrorMessage(err));
    }
}

export async function updateDisplayName(accessToken, displayName) {
    try {
        const res = await api.patch(
            "/auth/me/name",
            { display_name: displayName },
            { headers: { Authorization: "Bearer " + accessToken } }
        );
        return res.data;
    } catch (err) {
        throw new Error(getAxiosErrorMessage(err));
    }
}

export async function deleteMyAccount(accessToken) {
  const res = await fetch("http://localhost:8000/auth/me", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to delete account: ${detail}`);
  }

  return await res.json();
}

