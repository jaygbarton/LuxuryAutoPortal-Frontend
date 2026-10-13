import { mtLocalInputToUtcIso, toMtLocalInput } from "@/lib/mt-datetime";

/** Reject impossible or ambiguous local wall times instead of silently shifting a booking. */
export function previewLocalTimeToIso(local: string, timezone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  try {
    const iso = mtLocalInputToUtcIso(local, timezone);
    if (!iso || toMtLocalInput(iso, timezone) !== local) return null;
    const stamp = Date.parse(iso);
    // DST transitions can repeat a wall time; require the user to choose a
    // different unambiguous pickup/return time before sending an instant.
    for (const delta of [-120, -90, -60, -30, 30, 60, 90, 120]) {
      if (toMtLocalInput(new Date(stamp + delta * 60_000).toISOString(), timezone) === local) return null;
    }
    return iso;
  } catch { return null; }
}

export function previewDateRange(start: string, end: string, timezone: string): { startAt: string; endAt: string } | null {
  const startAt = previewLocalTimeToIso(start, timezone), endAt = previewLocalTimeToIso(end, timezone);
  return startAt && endAt && Date.parse(endAt) > Date.parse(startAt) ? { startAt, endAt } : null;
}

export function formatBookingDate(instant: string | null | undefined, timezone: string): string {
  if (!instant || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(instant) || !Number.isFinite(Date.parse(instant))) return "Date unavailable";
  try { return new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(instant)); }
  catch { return "Date unavailable"; }
}
