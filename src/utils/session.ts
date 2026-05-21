const SESSION_STORAGE_KEY = "meituan_ai.session_id";

function createSessionId(): string {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  return `web_${randomId}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return createSessionId();

  try {
    const existingSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existingSessionId) return existingSessionId;

    const sessionId = createSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    return createSessionId();
  }
}
