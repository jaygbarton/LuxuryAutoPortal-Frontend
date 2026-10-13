import { dayKeyToUtcDate, mtDayKey } from "@/lib/mt-datetime";

const DAY_MS = 86_400_000;
export const MAX_CALENDAR_DAYS = 180;

export function calendarRangeDays(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = dayKeyToUtcDate(from);
  const end = dayKeyToUtcDate(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  if (start.toISOString().slice(0, 10) !== from || end.toISOString().slice(0, 10) !== to) return null;
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  return days > 0 && days <= MAX_CALENDAR_DAYS ? days : null;
}

/** Require the server's normalized instant, never infer a bare DATETIME's zone. */
export function calendarInstant(value: string | null): number | null {
  if (!value || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? instant : null;
}

export interface CalendarBarPosition {
  left: number;
  width: number;
  clippedLeft: boolean;
  clippedRight: boolean;
}

/** Day-level display only; booking decisions use the exact server-side interval. */
export function calendarBarPosition(
  start: string | null,
  end: string | null,
  from: string,
  to: string,
  timezone: string,
  columnWidth: number,
): CalendarBarPosition | null {
  const days = calendarRangeDays(from, to);
  const startInstant = calendarInstant(start);
  const endInstant = end === null ? null : calendarInstant(end);
  if (!days || startInstant === null || (end !== null && endInstant === null)) return null;
  if (endInstant !== null && endInstant < startInstant) return null;

  const first = dayKeyToUtcDate(from).getTime();
  const last = dayKeyToUtcDate(to).getTime();
  const startsOn = dayKeyToUtcDate(mtDayKey(startInstant, timezone)).getTime();
  // End is exclusive for intervals; a midnight return does not occupy the next
  // day. A zero-length scheduled task remains visible on its scheduled day.
  const endsOn = endInstant === null ? last : dayKeyToUtcDate(
    mtDayKey(endInstant > startInstant ? endInstant - 1 : endInstant, timezone),
  ).getTime();
  if (endsOn < first || startsOn > last) return null;

  const firstColumn = Math.max(0, Math.round((startsOn - first) / DAY_MS));
  const lastColumn = Math.min(days - 1, Math.round((endsOn - first) / DAY_MS));
  return {
    left: firstColumn * columnWidth,
    width: Math.max(columnWidth * 0.6, (lastColumn - firstColumn + 1) * columnWidth - 6),
    clippedLeft: startsOn < first,
    clippedRight: endInstant === null || endsOn > last,
  };
}
