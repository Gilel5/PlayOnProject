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

export async function renameSession(sessionId, title) {
  const res = await fetch(`${API_URL}/chat_sessions/${sessionId}/title?title=${encodeURIComponent(title)}`, {
    method: "PUT"
  });

  if (!res.ok) {
    throw new Error("Failed to rename chat session");
  }
  return await res.json();
}

export async function archiveSession(sessionId) {
  const res = await fetch(`${API_URL}/chat_sessions/${sessionId}/archive`, {
    method: "PUT"
  });

  if (!res.ok) {
    throw new Error("Failed to archive chat session");
  }
  return await res.json();
}

export async function restoreSession(sessionId) {
  const res = await fetch(`${API_URL}/chat_sessions/${sessionId}/restore`, {
    method: "PUT"
  });

  if (!res.ok) {
    throw new Error("Failed to restore chat session");
  }
  return await res.json();
}

export async function getArchivedSessions(userId) {
  const res = await fetch(`${API_URL}/chat_sessions/user/${userId}/archived`);

  if (!res.ok) {
    throw new Error("Failed to fetch archived sessions");
  }
  return await res.json();
}