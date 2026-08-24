import { describe, it, expect } from "vitest";
import {
  mtLocalInputToUtcIso,
  mtDayStartToUtcIso,
  mtLocalInputToUtcDbString,
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
