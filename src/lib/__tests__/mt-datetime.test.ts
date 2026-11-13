import { describe, it, expect } from "vitest";
import {
  mtLocalInputToUtcIso,
  mtDayStartToUtcIso,
  mtLocalInputToUtcDbString,
  mtDayKey,
  mtDayKeyOrNull,
  mtTodayKey,
} from "../mt-datetime";

// The Day Schedule "Add Entry" form combined a Mountain-Time day key with a
// browser-local time and let `new Date()` parse the pair, so a Manila user
// picking Aug 24 9:00 AM filed the entry under Aug 23. These conversions must
// depend only on the values passed in — never on where the browser sits.
describe("mtLocalInputToUtcIso", () => {
  it("reads the wall time as Mountain, not browser-local (MDT)", () => {
    expect(mtLocalInputToUtcIso("2026-08-24T09:00")).toBe("2026-08-24T15:00:00.000Z");
  });

  it("handles standard time too (MST, UTC-7)", () => {
    expect(mtLocalInputToUtcIso("2026-01-15T09:00")).toBe("2026-01-15T16:00:00.000Z");
  });

  it("always carries the Z suffix — the backend parses with new Date()", () => {
    expect(mtLocalInputToUtcIso("2026-08-24T09:00")).toMatch(/Z$/);
  });

  it("returns null rather than an Invalid Date for junk", () => {
    expect(mtLocalInputToUtcIso("")).toBeNull();
    expect(mtLocalInputToUtcIso("not-a-date")).toBeNull();
  });
});

describe("mtDayStartToUtcIso", () => {
  it("is MT midnight, not UTC midnight", () => {
    // new Date("2026-08-24").toISOString() would give 00:00Z — 6h too early.
    expect(mtDayStartToUtcIso("2026-08-24")).toBe("2026-08-24T06:00:00.000Z");
  });
});

describe("mtLocalInputToUtcDbString", () => {
  it("still returns the space-separated DB form after the refactor", () => {
    expect(mtLocalInputToUtcDbString("2026-08-24T09:00")).toBe("2026-08-24 15:00:00");
  });
});

// Phase 4 of the timezone feature parameterizes these on an optional `tz`
// argument so per-user display can route through the same functions instead
// of duplicating them. Existing call sites omit it and keep getting Mountain
// Time — these confirm passing a different zone actually changes the result.
describe("optional tz parameter (backward compatible)", () => {
  it("mtLocalInputToUtcIso: same wall time reads differently in a different zone", () => {
    expect(mtLocalInputToUtcIso("2026-08-24T09:00")).toBe("2026-08-24T15:00:00.000Z"); // MT default
    expect(mtLocalInputToUtcIso("2026-08-24T09:00", "Asia/Manila")).toBe("2026-08-24T01:00:00.000Z");
    expect(mtLocalInputToUtcIso("2026-08-24T09:00", "UTC")).toBe("2026-08-24T09:00:00.000Z");
  });

  it("mtDayKey: the same instant can fall on different calendar days in different zones", () => {
    // 2026-08-31 04:00 UTC is Aug 30 10pm in Denver but Aug 31 in Manila.
    expect(mtDayKey("2026-08-31T04:00:00.000Z")).toBe("2026-08-30");
    expect(mtDayKey("2026-08-31T04:00:00.000Z", "Asia/Manila")).toBe("2026-08-31");
  });

  it("mtTodayKey: honors the tz argument", () => {
    // Not asserting a specific date (depends on when the test runs) — just
    // that passing a tz doesn't throw and returns a well-formed day key.
    expect(mtTodayKey("Asia/Manila")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// mtDayKeyOrNull backs the dashboard/Operations date-range filters, which
// were 14 identical per-component `toMtDate` copies before consolidation.
// Those copies all answered `null` for "no date", and every call site keys
// off that with `day != null`. mtDayKey alone cannot be substituted: it
// answers "" for an invalid date and "1969-12-31" for null, either of which
// passes a `>=` range bound and silently widens the filter.
describe("mtDayKeyOrNull", () => {
  it("returns null for absent input rather than a date string", () => {
    expect(mtDayKeyOrNull(null)).toBeNull();
    expect(mtDayKeyOrNull(undefined)).toBeNull();
    expect(mtDayKeyOrNull("")).toBeNull();
  });

  it("never returns the epoch day for null, which mtDayKey does", () => {
    // The whole reason this wrapper exists.
    expect(mtDayKey(null as unknown as string)).toBe("1969-12-31");
    expect(mtDayKeyOrNull(null)).toBeNull();
  });

  it("returns null for an unparseable date rather than an empty string", () => {
    expect(mtDayKey("not-a-date")).toBe("");
    expect(mtDayKeyOrNull("not-a-date")).toBeNull();
  });

  it("matches mtDayKey for real dates", () => {
    expect(mtDayKeyOrNull("2026-08-31T04:00:00.000Z")).toBe("2026-08-30");
    expect(mtDayKeyOrNull("2026-08-31T04:00:00.000Z", "Asia/Manila")).toBe("2026-08-31");
  });

  it("honors an explicit tz, which call sites must pass", () => {
    // Call sites pass getActiveTimezone(); omitting it would silently pin
    // them back to the Denver default the timezone-preference work removed.
    expect(mtDayKeyOrNull("2026-01-15T02:00:00.000Z", "UTC")).toBe("2026-01-15");
    expect(mtDayKeyOrNull("2026-01-15T02:00:00.000Z", "America/Denver")).toBe("2026-01-14");
  });

  it("degrades to null instead of throwing on an invalid tz", () => {
    expect(() => mtDayKey("2026-08-31T04:00:00.000Z", "Not/AZone")).toThrow();
    expect(mtDayKeyOrNull("2026-08-31T04:00:00.000Z", "Not/AZone")).toBeNull();
  });

  it("accepts Date and number input like mtDayKey", () => {
    expect(mtDayKeyOrNull(new Date("2026-08-31T04:00:00.000Z"))).toBe("2026-08-30");
    expect(mtDayKeyOrNull(Date.parse("2026-08-31T04:00:00.000Z"))).toBe("2026-08-30");
  });
});

describe("handoffTimezone (car on/off-boarding)", () => {
  // Must agree with handoffTimezone in backend/src/config/timezone.ts, which
  // formats the same stored instant for Slack and the emails.
  it("reads North Carolina locations as Eastern and everything else as Mountain", async () => {
    const { handoffTimezone, NC_HANDOFF_ADDRESS, mtLocalInputToUtcIso } = await import("../mt-datetime");
    expect(handoffTimezone(NC_HANDOFF_ADDRESS)).toBe("America/New_York");
    expect(handoffTimezone("123 Market St, Wilmington NC")).toBe("America/New_York");
    expect(handoffTimezone("50 South Redwood Road, Salt Lake City, Utah 84116")).toBe("America/Denver");
    expect(handoffTimezone("Lincoln Avenue")).toBe("America/Denver");
    expect(handoffTimezone("")).toBe("America/Denver");
    // An NC pick-up at 11:00 AM is 16:00 UTC, not the 18:00 a Mountain reading gave.
    expect(mtLocalInputToUtcIso("2026-11-19T11:00", handoffTimezone(NC_HANDOFF_ADDRESS))).toBe("2026-11-19T16:00:00.000Z");
  });
});

describe("dayRangeToUtcIso", () => {
  it("covers exactly the local days, in both standard and daylight time", async () => {
    const { dayRangeToUtcIso } = await import("../mt-datetime");
    // MST (-07:00)
    expect(dayRangeToUtcIso("2026-11-01", "2026-11-13")).toEqual({ start: "2026-11-01T06:00:00.000Z", end: "2026-11-14T06:59:59.999Z" });
    // MDT (-06:00): the old fixed "-07:00" end spilled an hour into the next day
    expect(dayRangeToUtcIso("2026-07-01", "2026-07-15")).toEqual({ start: "2026-07-01T06:00:00.000Z", end: "2026-07-16T05:59:59.999Z" });
    // Range ending on the fall-back day (25 hours long)
    expect(dayRangeToUtcIso("2026-11-01", "2026-11-01").end).toBe("2026-11-02T06:59:59.999Z");
    // Viewer in another zone
    expect(dayRangeToUtcIso("2026-11-13", "2026-11-13", "America/New_York")).toEqual({ start: "2026-11-13T05:00:00.000Z", end: "2026-11-14T04:59:59.999Z" });
    expect(dayRangeToUtcIso("", "")).toEqual({ start: null, end: null });
  });
});
