import { isBookingKey } from "@/lib/booking-navigation";
import { calendarInstant } from "@/lib/fleetCalendarDates";
import { mtDayKey } from "@/lib/mt-datetime";

/** A link must name an actual calendar day, not a date that JavaScript rolls over. */
export function validScheduleDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

export function dayScheduleBookingKey(search: string): string | null {
  const value = new URLSearchParams(search).get("booking");
  // Drafts have their own private schedule preview; they must never become work.
  return value && isBookingKey(value) && !value.startsWith("direct_booking_preview:") ? value : null;
}

export function linkedScheduleDate(requested: string | null, start: string | null, timezone: string): string | null {
  const explicit = validScheduleDate(requested);
  if (explicit) return explicit;
  const instant = calendarInstant(start);
  if (instant === null) return null;
  try { return validScheduleDate(mtDayKey(instant, timezone)); } catch { return null; }
}
