import { differenceInDays } from "date-fns";
import { formatMonthDayYear } from "@/lib/date-format";
import type { TuroTrip } from "./types";

/** Em dash shown wherever a figure could not be computed. */
export const UNAVAILABLE = "\u2014";

/**
 * Format a currency figure.
 *
 * `null` means "the backend could not compute this" and renders as an em dash,
 * NOT $0.00 — a computation failure must not be indistinguishable from a real
 * zero. `undefined` is treated the same way. Genuine 0 still renders $0.00.
 */
export function fmt(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return UNAVAILABLE;
  const n = parseFloat(String(val)) || 0;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  return `${String(parseInt(m, 10)).padStart(2, "0")}/${y}`;
}

export function fmtDate(val: string | null | undefined): string {
  return formatMonthDayYear(val);
}

export function tripDays(trip: TuroTrip): number {
  try {
    return Math.max(1, differenceInDays(new Date(trip.tripEnd), new Date(trip.tripStart)));
  } catch {
    return 1;
  }
}
