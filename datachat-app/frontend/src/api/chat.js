import { api } from "./http";

export async function sendChatMessage(message, sessionId) {
  const response = await api.post("/chat/", { message, session_id: sessionId });
  return response.data;
}