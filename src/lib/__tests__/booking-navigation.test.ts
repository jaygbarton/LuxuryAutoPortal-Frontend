import { describe, expect, it } from "vitest";
import { bookingViewHref, directBookingPreviewHref, isBookingKey } from "../booking-navigation";

describe("booking cross navigation", () => {
  it("preserves a source identity and day between the real internal views", () => {
    expect(bookingViewHref("calendar", "owner_rental:23", "2026-10-13")).toBe("/admin/trip-calendar?booking=owner_rental%3A23&date=2026-10-13");
    expect(bookingViewHref("day-schedule", "turo:99", "2026-10-13")).toBe("/admin/operations?booking=turo%3A99&date=2026-10-13&tab=day-schedule");
    expect(bookingViewHref("rental", "maintenance:7")).toBe("/admin/developer/car-rentals?booking=maintenance%3A7");
    expect(isBookingKey("block_off:google:27")).toBe(true);
    expect(bookingViewHref("rental", "direct_booking:33")).toBe("/admin/developer/car-rentals?booking=direct_booking%3A33");
  });
  it("keeps every direct booking draft link inside the developer preview", () => {
    const key = "direct_booking_preview:11111111-1111-4111-8111-111111111111";
    for (const view of ["calendar", "rental", "day-schedule"] as const) {
      const href = bookingViewHref(view, key, "2026-10-13");
      expect(href).toMatch(/^\/admin\/developer\/direct-bookings\?/);
      expect(new URLSearchParams(href!.split("?")[1]).get("booking")).toBe(key);
      expect(href).not.toContain("/admin/operations");
      expect(href).not.toContain("/admin/trip-calendar");
    }
    expect(directBookingPreviewHref("customer", "turo:1")).toBe("/admin/developer/direct-bookings?view=customer");
  });
  it("rejects malformed and external booking keys", () => {
    for (const key of ["turo:0", "turo:-1", "https://evil.test", "turo:1&next=https://evil.test", "direct_booking_preview:no-id", "block_off:google:../secret"]) {
      expect(isBookingKey(key)).toBe(false);
      expect(bookingViewHref("rental", key)).toBeNull();
    }
  });
});
