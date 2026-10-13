import { describe, expect, it } from "vitest";
import { dayScheduleBookingKey, linkedScheduleDate, validScheduleDate } from "../dayScheduleBooking";

describe("Day Schedule booking links", () => {
  it("rejects impossible dates and accepts leap days", () => {
    expect(validScheduleDate("2026-02-30")).toBeNull();
    expect(validScheduleDate("2026-13-01")).toBeNull();
    expect(validScheduleDate("2024-02-29")).toBe("2024-02-29");
    expect(validScheduleDate("2026-10-07")).toBe("2026-10-07");
  });
  it("keeps draft bookings out of the live Day Schedule", () => {
    expect(dayScheduleBookingKey("booking=direct_booking_preview:00000000-0000-4000-8000-000000000001")).toBeNull();
    expect(dayScheduleBookingKey("booking=turo:208")).toBe("turo:208");
    expect(dayScheduleBookingKey("booking=owner_rental:208")).toBe("owner_rental:208");
    expect(dayScheduleBookingKey("booking=block_off:google:208")).toBe("block_off:google:208");
    expect(dayScheduleBookingKey("booking=turo:208%22%5D")).toBeNull();
  });
  it("uses the viewer's day around midnight and DST rather than the browser day", () => {
    expect(linkedScheduleDate(null, "2026-10-07T01:00:00.000Z", "America/Denver")).toBe("2026-10-06");
    expect(linkedScheduleDate(null, "2026-10-07T01:00:00.000Z", "Asia/Manila")).toBe("2026-10-07");
    expect(linkedScheduleDate(null, "2026-11-01T08:30:00.000Z", "America/Denver")).toBe("2026-11-01");
    expect(linkedScheduleDate("2026-10-08", "2026-10-07T01:00:00.000Z", "America/Denver")).toBe("2026-10-08");
    expect(linkedScheduleDate(null, "2026-10-07 01:00:00", "America/Denver")).toBeNull();
    expect(linkedScheduleDate(null, null, "America/Denver")).toBeNull();
  });
});
