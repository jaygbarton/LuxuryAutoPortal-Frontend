export type BookingView = "calendar" | "rental" | "day-schedule";
export type DirectBookingPreviewView = "customer" | "worker" | "calendar" | "day-schedule";

const UUID = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
export function isBookingKey(key: string): boolean {
  return /^(?:turo|owner_rental|block_off|maintenance|direct_booking):[1-9]\d*$/.test(key) ||
    /^block_off:google:[A-Za-z0-9_.@-]{1,512}$/.test(key) ||
    new RegExp(`^direct_booking_preview:${UUID}$`, "i").test(key);
}

/** Draft links stay within the developer preview; they never enter live views. */
export function directBookingPreviewHref(view: DirectBookingPreviewView, bookingKey?: string): string {
  const query = new URLSearchParams({ view });
  if (bookingKey && isBookingKey(bookingKey) && bookingKey.startsWith("direct_booking_preview:")) query.set("booking", bookingKey);
  return `/admin/developer/direct-bookings?${query}`;
}

export function bookingViewHref(view: BookingView, bookingKey: string, date?: string): string | null {
  if (!isBookingKey(bookingKey)) return null;
  if (bookingKey.startsWith("direct_booking_preview:")) return directBookingPreviewHref(view === "rental" ? "worker" : view, bookingKey);
  const query = new URLSearchParams({ booking: bookingKey });
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) query.set("date", date);
  if (view === "day-schedule") {
    query.set("tab", "day-schedule");
    return `/admin/operations?${query}`;
  }
  return `${view === "calendar" ? "/admin/trip-calendar" : "/admin/developer/car-rentals"}?${query}`;
}
