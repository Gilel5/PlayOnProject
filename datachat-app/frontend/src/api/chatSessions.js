const API_URL = "http://localhost:8000";

export async function createChatSession(userId) {
  const res = await fetch(`${API_URL}/chat_sessions/create?user_id=${userId}`, {
    method: "POST"
  });

  if (!res.ok) {
    throw new Error("Failed to create chat session");
  }
  return await res.json();
}

export async function getUserSessions(userId) {
  const res = await fetch(`${API_URL}/chat_sessions/user/${userId}`);

  if (!res.ok) {
    throw new Error("Failed to fetch user sessions");
  }
  return await res.json();
}

export async function pinSession(sessionId) {
  const res = await fetch(`${API_URL}/chat_sessions/${sessionId}/pin`, {
    method: "PUT"
  });

  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Failed to toggle pinned state: ${details}`);
  }
  return await res.json();
}

export async function deleteSession(sessionId) {
  const res = await fetch(`${API_URL}/chat_sessions/${sessionId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    throw new Error("Failed to delete chat session");
  }
  return await res.json();
}