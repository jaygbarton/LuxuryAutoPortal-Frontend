import { differenceInDays } from "date-fns";
import { MONTHS_SHORT } from "./constants";
import type { TuroTrip } from "./types";

export function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val ?? 0)) || 0;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  return `${MONTHS_SHORT[parseInt(m, 10) - 1]} ${y}`;
}

/** Format a date value (ISO timestamp like "2026-04-30T00:00:00.000Z" or a
 *  plain "YYYY-MM-DD") as "MMM D, YYYY". Uses the date's UTC parts so a
 *  midnight-UTC date doesn't slip to the previous day. Returns "—" when empty
 *  and the raw value if it can't be parsed. */
export function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(val));
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (m >= 1 && m <= 12) return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
  }
  const dt = new Date(String(val));
  if (isNaN(dt.getTime())) return String(val);
  return `${MONTHS_SHORT[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}

export function tripDays(trip: TuroTrip): number {
  try {
    return Math.max(1, differenceInDays(new Date(trip.tripEnd), new Date(trip.tripStart)));
  } catch {
    return 1;
  }
}
