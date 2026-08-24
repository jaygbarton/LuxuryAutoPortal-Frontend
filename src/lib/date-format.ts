import { getActiveTimezone } from "@/hooks/use-timezone";

type DateInput = string | number | Date | null | undefined;

function parseDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * A bare `YYYY-MM-DD` (no time component) names a calendar day, not an
 * instant — there is no timezone to convert it through, so its digits are
 * read directly rather than routed through `Date`. `formatMonthDayYearTime`
 * needs an actual instant (it renders a time), so it never takes this path.
 */
export function formatMonthDayYear(value: DateInput, fallback = "—"): string {
  if (typeof value === "string") {
    const plainDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (plainDate) {
      return `${plainDate[2]}/${plainDate[3]}/${plainDate[1]}`;
    }
  }

  const date = parseDate(value);
  if (!date) return fallback;
  const tz = getActiveTimezone();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((a, p) => {
      if (p.type !== "literal") a[p.type] = p.value;
      return a;
    }, {});
  return `${parts.month}/${parts.day}/${parts.year}`;
}

export function formatMonthDayYearTime(value: DateInput, fallback = "—"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  const tz = getActiveTimezone();
  const time = date.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatMonthDayYear(date, fallback)} ${time}`;
}

export function formatMonthYear(value: DateInput, fallback = "—"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  const tz = getActiveTimezone();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((a, p) => {
      if (p.type !== "literal") a[p.type] = p.value;
      return a;
    }, {});
  return `${parts.month}/${parts.year}`;
}
