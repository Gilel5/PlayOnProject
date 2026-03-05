import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: true,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Attach access token on every request (if present)
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Prevent multiple refresh requests running at once
let isRefreshing = false;
let queued = [];

// Retry queued requests after refresh finishes
function flushQueue(error, token = null) {
  queued.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  queued = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // If there is no response at all, just reject
    if (!error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;
    const url = original?.url || "";

    // Do NOT trigger refresh flow for auth endpoints
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout");

    // Only refresh for non-auth routes that failed with 401
    if (status !== 401 || isAuthRoute || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    // If another refresh is already happening, wait for it
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queued.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const res = await api.post("/auth/refresh");
      const newToken = res.data.access_token;

      sessionStorage.setItem("access_token", newToken);
      flushQueue(null, newToken);

      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      flushQueue(refreshErr, null);
      sessionStorage.removeItem("access_token");
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);