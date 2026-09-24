/**
 * WATnow -> Google Calendar bridge (personal use).
 *
 * 1. script.google.com -> New project -> paste this file
 * 2. Set TOKEN below to any secret string
 * 3. Deploy -> New deployment -> Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the web app URL into WATnow settings (same TOKEN)
 */

const TOKEN = "pick-a-secret-token";
const DEFAULT_CALENDAR_ID = "primary";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!body.token || body.token !== TOKEN) {
      return json({ error: "unauthorized" }, 401);
    }

    const calendarId = body.calendarId || DEFAULT_CALENDAR_ID;
    const map = body.map || {};
    const items = body.items || [];
    const removedIds = body.removedIds || [];

    for (const item of items) {
      if (!item.id || !item.dueAt) continue;
      const start = new Date(item.dueAt);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const event = {
        summary: (item.courseCode ? item.courseCode + ": " : "") + item.title,
        description: item.url || "WATnow",
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        extendedProperties: { private: { watnowId: item.id } },
      };

      if (map[item.id]) {
        Calendar.Events.patch(event, calendarId, map[item.id]);
      } else {
        const created = Calendar.Events.insert(event, calendarId);
        map[item.id] = created.id;
      }
    }

    for (const id of removedIds) {
      const eventId = map[id];
      if (!eventId) continue;
      try {
        Calendar.Events.remove(calendarId, eventId);
      } catch (err) {
        /* already gone */
      }
      delete map[id];
    }

    return json({ ok: true, map });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

function json(obj, code) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  if (code) out.setResponseCode(code);
  return out;
}
