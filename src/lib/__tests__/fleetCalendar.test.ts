import { describe, expect, it } from "vitest";
import { eventBlocksAvailability, normalizeFleetCalendarResponse, normalizeFleetCalendarSync } from "../fleetCalendar";

function fixture() {
  return {
    cars: [{ carId: 101, carName: "Test car", plate: "TEST101", status: "available" }],
    events: [{
      id: "turo:1", bookingKey: "turo:1", source: "turo", sourceId: 1,
      carId: 101, carName: "Test car", plate: "TEST101", title: "Test rental",
      start: "2026-10-13T15:00:00Z", end: "2026-10-14T15:00:00Z", status: "booked",
      cancelled: false, blocksAvailability: true, timeStatus: "confirmed",
    }],
    complete: true, availabilityComplete: true,
  };
}

describe("internal calendar response and booking impact", () => {
  it("reads the actual API plate/status aliases without losing a vehicle or event", () => {
    const result = normalizeFleetCalendarResponse(fixture());
    expect(result.cars[0].plateNumber).toBe("TEST101");
    expect(result.cars[0].carStatus).toBe("available");
    expect(result.events[0].plateNumber).toBe("TEST101");
    expect(result.events[0].bookingKey).toBe("turo:1");
  });

  it("rejects an unknown source rather than silently filtering it out", () => {
    const input = fixture();
    input.events[0].source = "unknown_booking_system";
    expect(() => normalizeFleetCalendarResponse(input)).toThrow("unsupported event source");
  });

  it("reads the real nested sync health without guessing whether Google is configured", () => {
    const result = normalizeFleetCalendarResponse({
      ...fixture(), sync: { counts: { pending: 2, error: 1 }, lastSuccess: "2026-10-13T17:00:00Z", lastError: "A calendar update failed." },
    });
    expect(result.sync).toMatchObject({ status: "needs_attention", pending: 2, failed: 1, lastSuccessAt: "2026-10-13T17:00:00Z" });
    expect(result.sync?.configured).toBeUndefined();
  });

  it("keeps first-sync pending status and actual import diagnostics even with zero queued events", () => {
    const sync = normalizeFleetCalendarSync({ configured: true, enabled: true, pending: 0, failed: 0, lastSuccessAt: null }, {
      lastSuccess: null, lastAttempt: "2026-10-13T17:00:00Z", lastError: "Google rejected the refresh token.",
    });
    expect(sync).toMatchObject({ status: "pending", pending: 0, configured: true, enabled: true });
    expect(sync?.import).toEqual({ lastSuccessAt: null, lastAttemptAt: "2026-10-13T17:00:00Z", lastError: "Google rejected the refresh token." });
  });

  it("rejects a broken response instead of presenting an empty calendar", () => {
    expect(() => normalizeFleetCalendarResponse({ success: false, cars: [], events: [] })).toThrow();
    expect(() => normalizeFleetCalendarResponse({ cars: [], events: null })).toThrow();
  });

  it("retains unlinked and undated events so the UI can show their attention state", () => {
    const input = { ...fixture(), events: [{ ...fixture().events[0], carId: null, start: null, end: null, timeStatus: "missing" }] };
    const result = normalizeFleetCalendarResponse(input);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].carId).toBeNull();
    expect(result.events[0].start).toBeNull();
  });

  it("does not let cancelled history make a vehicle look blocked even with a stale flag", () => {
    const event = normalizeFleetCalendarResponse(fixture()).events[0];
    expect(eventBlocksAvailability(event)).toBe(true);
    expect(eventBlocksAvailability({ ...event, cancelled: true })).toBe(false);
    expect(eventBlocksAvailability({ ...event, status: "canceled" })).toBe(false);
  });
});
