import { api } from "./http";

export async function sendChatMessage(message, sessionId) {
  // Data-aware chat can take 15-30s (two OpenAI calls + SQL execution)
  const response = await api.post("/chat/", { message, session_id: sessionId }, { timeout: 60000 });
  return response.data;
}

export async function getDatasource() {
  const response = await api.get("/chat/datasource");
  return response.data;
}

export async function generateSummaryReports({
  reportType,
  year = null,
  month = null,
  startMonth = null,
  endMonth = null,
}) {
  const response = await api.post(
    "/chat/summary",
    {
      report_type: reportType,
      year,
      month,
      start_month: startMonth,
      end_month: endMonth,
    },
    {
      timeout: 180000,
      responseType: "blob",
    }
  );

  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return window.URL.createObjectURL(blob);
}