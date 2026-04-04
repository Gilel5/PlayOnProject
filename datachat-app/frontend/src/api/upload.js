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
 * @param {function} onProgress  — called with 0-100 integer
 * @returns {Promise<{ rows_inserted: number, table: string }>}
 */
export async function uploadCsv(file, onProgress, signal) {
  const form = new FormData();
  form.append("file", file);

  const { data } = await uploadApi.post("/upload/csv", form, {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });

  return data;
}
