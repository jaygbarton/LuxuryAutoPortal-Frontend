import { describe, it, expect } from "vitest";
import {
  mtLocalInputToUtcIso,
  mtDayStartToUtcIso,
  mtLocalInputToUtcDbString,
  mtDayKey,
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
