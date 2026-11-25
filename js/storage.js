const STORAGE_KEY = "smart_purchase_sessions_v1";

export function loadSavedSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSessionToStorage(session) {
  const list = loadSavedSessions();
  const idx = list.findIndex((s) => s.comparison_session_id === session.comparison_session_id);
  const updated = { ...session, updated_at: new Date().toISOString() };
  if (idx >= 0) {
    list[idx] = updated;
  } else {
    list.unshift(updated);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return updated;
}

export function deleteSessionFromStorage(sessionId) {
  const list = loadSavedSessions().filter((s) => s.comparison_session_id !== sessionId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function exportSessionJson(session) {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.comparison_session_id || "comparison"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
