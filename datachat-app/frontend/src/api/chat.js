import { api } from "./http";

export async function sendChatMessage(message) {
  const response = await api.post("/chat/", { message });
  return response.data;
}