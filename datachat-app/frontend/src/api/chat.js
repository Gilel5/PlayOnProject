import { api } from "./http";

export async function sendChatMessage(message, sessionId) {
  // Data-aware chat can take 15-30s (two OpenAI calls + SQL execution)
  const response = await api.post("/chat/", { message, session_id: sessionId }, { timeout: 60000 });
  return response.data;
}

export async function generateSummaryReports() {
  // Summary generation, can take up to 2 minutes
  // Returns the blob URL for the Excel file
  const response = await api.post("/chat/summary", {}, {
    timeout: 180000,
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  return url;
}