import { describe, expect, it } from "vitest";
import { calendarBarPosition, calendarInstant, calendarRangeDays } from "../fleetCalendarDates";

describe("fleet calendar dates", () => {
  it("accepts up to 180 actual calendar days and rejects reversed or invalid dates", () => {
    expect(calendarRangeDays("2026-10-13", "2026-10-13")).toBe(1);
    expect(calendarRangeDays("2026-01-01", "2026-06-29")).toBe(180);
    expect(calendarRangeDays("2026-01-01", "2026-06-30")).toBeNull();
    expect(calendarRangeDays("2026-10-14", "2026-10-13")).toBeNull();
    expect(calendarRangeDays("2026-02-30", "2026-03-01")).toBeNull();
  });

  it("does not guess whether an unnormalized database time means Denver or UTC", () => {
    expect(calendarInstant("2026-10-13 09:00:00")).toBeNull();
    expect(calendarInstant("2026-10-13T09:00:00")).toBeNull();
    expect(calendarInstant("2026-10-13T09:00:00-06:00"))
      .toBe(calendarInstant("2026-10-13T15:00:00Z"));
  });

  it("places the same instant on the viewer's selected calendar day", () => {
    const start = "2026-10-14T01:00:00Z";
    const end = "2026-10-14T02:00:00Z";
    expect(calendarBarPosition(start, end, "2026-10-13", "2026-10-14", "America/Denver", 44)?.left).toBe(0);
    expect(calendarBarPosition(start, end, "2026-10-13", "2026-10-14", "America/New_York", 44)?.left).toBe(0);
    expect(calendarBarPosition(start, end, "2026-10-13", "2026-10-14", "Europe/London", 44)?.left).toBe(44);
  });

  it("does not draw an interval into the next day when it ends at local midnight", () => {
    const position = calendarBarPosition(
      "2026-10-13T15:00:00Z", "2026-10-14T06:00:00Z", "2026-10-13", "2026-10-14", "America/Denver", 44,
    );
    expect(position?.width).toBe(38);
  });

  it("keeps day columns consistent across the Denver DST change", () => {
    const position = calendarBarPosition(
      "2026-10-31T15:00:00Z", "2026-11-02T07:00:00Z", "2026-10-31", "2026-11-03", "America/Denver", 44,
    );
    expect(position?.left).toBe(0);
    expect(position?.width).toBe(82);
  });

  it("draws an open-ended interval to the view's edge and marks its continuation", () => {
    expect(calendarBarPosition("2026-10-12T15:00:00Z", null, "2026-10-13", "2026-10-15", "America/Denver", 44))
      .toEqual({ left: 0, width: 126, clippedLeft: true, clippedRight: true });
  });

  it("keeps a point-in-time maintenance appointment visible", () => {
    expect(calendarBarPosition("2026-10-13T15:00:00Z", "2026-10-13T15:00:00Z", "2026-10-13", "2026-10-14", "America/Denver", 44)?.width)
      .toBe(38);
  });

  it("rejects bad or inverted intervals instead of displaying guessed dates", () => {
    expect(calendarBarPosition("invalid", null, "2026-10-13", "2026-10-14", "America/Denver", 44)).toBeNull();
    expect(calendarBarPosition("2026-10-14T15:00:00Z", "2026-10-13T15:00:00Z", "2026-10-13", "2026-10-14", "America/Denver", 44)).toBeNull();
  });
});
