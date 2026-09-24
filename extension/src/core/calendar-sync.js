// Pushes open Learn deadlines to Google Calendar through a personal Apps Script webhook.
// Local-only: not part of the upstream WATnow release.

export async function syncCalendar(items, courses, settings) {
  const cs = settings.calendarSync;
  if (!cs?.enabled || !cs?.webhookUrl) return { ok: false, reason: "disabled" };

  const { calendarMap = {} } = await chrome.storage.local.get("calendarMap");
  const courseById = new Map((courses || []).map((c) => [c.id, c]));
  const open = (items || []).filter((i) => i.status === "open" && i.dueAt);
  const openIds = new Set(open.map((i) => i.id));

  const payload = {
    token: cs.token || "",
    calendarId: cs.calendarId || "primary",
    map: calendarMap,
    items: open.map((i) => ({
      id: i.id,
      title: i.title,
      dueAt: i.dueAt,
      url: i.url || "",
      courseCode: (courseById.get(i.courseId) || {}).code || "",
    })),
    removedIds: Object.keys(calendarMap).filter((id) => !openIds.has(id)),
  };

  try {
    const res = await fetch(cs.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) return { ok: false, reason: data.error || `HTTP ${res.status}` };
    if (data.map) {
      await chrome.storage.local.set({
        calendarMap: data.map,
        calendarSyncAt: new Date().toISOString(),
      });
    }
    return { ok: true, synced: open.length, removed: payload.removedIds.length };
  } catch (e) {
    console.warn("calendar sync", e);
    return { ok: false, reason: String(e && e.message ? e.message : e) };
  }
}
