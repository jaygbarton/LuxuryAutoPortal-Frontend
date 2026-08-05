import { differenceInDays } from "date-fns";
import { formatMonthDayYear } from "@/lib/date-format";
import type { TuroTrip } from "./types";

export function fmt(val: number | string | null | undefined): string {
  const n = parseFloat(String(val ?? 0)) || 0;
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
