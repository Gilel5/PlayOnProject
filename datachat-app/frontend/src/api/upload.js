import axios from "axios";

// Separate instance — 30 minute timeout for large CSV uploads (up to 300 MB / 600k rows)
const uploadApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: true,
  timeout: 1800000,
});

uploadApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Upload a CSV File object to the backend.
 * @param {File} file
 * @param {function} onProgress  — called with (percent: 0-100, loaded: bytes, total: bytes) for the upload phase
 * @param {function} onServerProgress  — called with {phase, rows_processed, total_rows} for server-side progress
 * @param {AbortSignal} signal
 * @returns {Promise<{ rows_inserted: number, table: string }>}
 */
export async function uploadCsv(file, onProgress, onServerProgress, signal) {
  const form = new FormData();
  form.append("file", file);

  const jobId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Poll the server for processing progress in parallel with the upload.
  let pollInterval = null;
  if (onServerProgress) {
    pollInterval = setInterval(async () => {
      try {
        const res = await uploadApi.get(`/upload/status/${jobId}`);
        onServerProgress(res.data);
        if (["done", "error", "cancelled"].includes(res.data.phase)) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      } catch {
        // Ignore poll failures — next tick will retry.
      }
    }, 500);
  }

  try {
    const { data } = await uploadApi.post("/upload/csv", form, {
      headers: {
        "Content-Type": "multipart/form-data",
        "X-Upload-Job-Id": jobId,
      },
      signal,
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total), e.loaded, e.total);
        }
      },
    });
    return data;
  } finally {
    if (pollInterval) clearInterval(pollInterval);
  }
}
