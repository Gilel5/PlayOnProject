import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Attach access token on every request (if present)
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Prevent infinite loops
let isRefreshing = false;
let queued = [];

// Retry queued requests after refresh
function flushQueue(error, token = null) {
  queued.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  queued = [];
}

// Response interceptor: if 401, try refresh once and retry request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // If not 401 or we've already retried, just throw
    if (error?.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Mark request as retried so we don't infinite loop
    original._retry = true;

    // If a refresh is already in progress, wait for it
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
      // Call refresh endpoint (cookie is sent automatically withCredentials)
      const res = await api.post("/auth/refresh");

      const newToken = res.data.access_token;
      sessionStorage.setItem("access_token", newToken);

      flushQueue(null, newToken);

      // Retry original request with new token
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      flushQueue(refreshErr, null);

      // If refresh fails, clear token and force user to login
      sessionStorage.removeItem("access_token");
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
