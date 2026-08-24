import { describe, it, expect, vi, beforeEach } from "vitest";

// getActiveTimezone reads the shared /api/auth/me query cache — mock it so
// these tests can drive the timezone directly instead of standing up a real
// QueryClient + fetch.
const mockGetActiveTimezone = vi.fn<() => string>();
vi.mock("@/hooks/use-timezone", () => ({
  getActiveTimezone: () => mockGetActiveTimezone(),
}));

import { formatMonthDayYear, formatMonthDayYearTime, formatMonthYear } from "../date-format";

beforeEach(() => {
  mockGetActiveTimezone.mockReset();
});

// Before this fix these three functions pinned NO timezone at all —
// getMonth()/getDate()/getFullYear() and toLocaleTimeString() with no
// `timeZone` option all render in the *browser's* zone. A Manila-based user
// (UTC+8) would see an instant that is 8pm-8am the previous MT day rendered
// as if it were already the next MT day.
describe("formatMonthDayYearTime — follows the active timezone", () => {
  it("renders in Mountain Time when that's the active zone", () => {
    mockGetActiveTimezone.mockReturnValue("America/Denver");
    // 2026-08-24 15:00 UTC = Aug 24, 9:00 AM MDT
    expect(formatMonthDayYearTime("2026-08-24T15:00:00.000Z")).toBe("08/24/2026 9:00 AM");
  });

  it("renders the SAME instant on a different calendar day in Manila", () => {
    mockGetActiveTimezone.mockReturnValue("Asia/Manila");
    // Same instant as above: Aug 24, 11:00 PM in Manila (UTC+8) — one day later.
    expect(formatMonthDayYearTime("2026-08-24T15:00:00.000Z")).toBe("08/24/2026 11:00 PM");
  });

  it("crosses midnight: an instant that is one MT day but the next Manila day", () => {
    mockGetActiveTimezone.mockReturnValue("America/Denver");
    // 2026-08-31 04:00 UTC = Aug 30, 10:00 PM MDT
    expect(formatMonthDayYearTime("2026-08-31T04:00:00.000Z")).toBe("08/30/2026 10:00 PM");

    mockGetActiveTimezone.mockReturnValue("Asia/Manila");
    // Same instant = Aug 31, 12:00 PM in Manila — a different calendar day.
    expect(formatMonthDayYearTime("2026-08-31T04:00:00.000Z")).toBe("08/31/2026 12:00 PM");
  });

  it("falls back for unparseable input regardless of zone", () => {
    mockGetActiveTimezone.mockReturnValue("Asia/Manila");
    expect(formatMonthDayYearTime("not-a-date")).toBe("—");
    expect(formatMonthDayYearTime(null)).toBe("—");
  });
});

describe("formatMonthDayYear", () => {
  it("reads a bare YYYY-MM-DD directly — no timezone involved, any zone", () => {
    mockGetActiveTimezone.mockReturnValue("Asia/Manila");
    expect(formatMonthDayYear("2026-08-24")).toBe("08/24/2026");
    mockGetActiveTimezone.mockReturnValue("America/Denver");
    expect(formatMonthDayYear("2026-08-24")).toBe("08/24/2026");
  });

  it("routes a real instant (Date object) through the active timezone", () => {
    mockGetActiveTimezone.mockReturnValue("Asia/Manila");
    // 2026-08-31 04:00 UTC -> Aug 31 in Manila, Aug 30 in Denver.
    expect(formatMonthDayYear(new Date("2026-08-31T04:00:00.000Z"))).toBe("08/31/2026");
    mockGetActiveTimezone.mockReturnValue("America/Denver");
    expect(formatMonthDayYear(new Date("2026-08-31T04:00:00.000Z"))).toBe("08/30/2026");
  });
});

describe("formatMonthYear", () => {
  it("follows the active timezone at a month boundary", () => {
    mockGetActiveTimezone.mockReturnValue("America/Denver");
    // 2026-09-01 05:00 UTC = Aug 31, 11:00 PM MDT — previous month in Denver.
    expect(formatMonthYear("2026-09-01T05:00:00.000Z")).toBe("08/2026");
    mockGetActiveTimezone.mockReturnValue("Asia/Manila");
    // Same instant = Sep 1, 1:00 PM in Manila.
    expect(formatMonthYear("2026-09-01T05:00:00.000Z")).toBe("09/2026");
  });
});
