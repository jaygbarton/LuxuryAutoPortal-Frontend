import { describe, expect, it } from "vitest";
import { dayStatus, daysBetween, overlappingTrip } from "../blockOffAvailability";

const trip = { start: "2026-11-18 10:00", end: "2026-11-20 16:00" };

describe("block-off calendar days", () => {
  it("crosses out days a Turo trip fully covers and flags the start and end days", () => {
    expect(dayStatus("2026-11-17", [trip], [])).toBe("free");
    expect(dayStatus("2026-11-18", [trip], [])).toBe("turo_partial");
    expect(dayStatus("2026-11-19", [trip], [])).toBe("turo_full");
    expect(dayStatus("2026-11-20", [trip], [])).toBe("turo_partial");
    expect(dayStatus("2026-11-21", [trip], [])).toBe("free");
  });
  it("frees the days when the trip is cancelled (no trip returned)", () => {
    expect(dayStatus("2026-11-19", [], [])).toBe("free");
  });
  it("marks days already blocked off and open-ended block-offs", () => {
    expect(dayStatus("2026-12-02", [], [{ start: "2026-12-01 09:00", end: null }])).toBe("blocked");
  });
  it("catches times that overlap a trip on its start or end day", () => {
    expect(overlappingTrip("2026-11-20T15:00", "2026-11-22T10:00", [trip])).toEqual(trip);
    expect(overlappingTrip("2026-11-20T16:30", "2026-11-22T10:00", [trip])).toBeNull();
    expect(overlappingTrip("2026-11-16T10:00", "2026-11-18T09:00", [trip])).toBeNull();
  });
  it("lists every day of a range", () => {
    expect(daysBetween("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });
});
