import { describe, expect, it } from "vitest";
import { previewDateRange, previewLocalTimeToIso } from "../directBookingPreviewDates";

describe("preview booking instants", () => {
  it("uses the selected trip zone rather than the browser zone", () => {
    expect(previewLocalTimeToIso("2026-10-13T10:00", "America/Denver")).toBe("2026-10-13T16:00:00.000Z");
    expect(previewLocalTimeToIso("2026-10-13T10:00", "America/New_York")).toBe("2026-10-13T14:00:00.000Z");
  });
  it("rejects the skipped and repeated DST hours", () => {
    expect(previewLocalTimeToIso("2026-03-08T02:30", "America/Denver")).toBeNull();
    expect(previewLocalTimeToIso("2026-11-01T01:30", "America/Denver")).toBeNull();
    expect(previewLocalTimeToIso("2026-11-01T03:30", "America/Denver")).toBe("2026-11-01T10:30:00.000Z");
  });
  it("rejects invalid calendar dates, timezone names and inverted periods", () => {
    expect(previewLocalTimeToIso("2026-02-30T10:00", "America/Denver")).toBeNull();
    expect(previewLocalTimeToIso("2026-10-13T10:00", "missing-zone")).toBeNull();
    expect(previewDateRange("2026-10-13T10:00", "2026-10-13T10:00", "America/Denver")).toBeNull();
    expect(previewDateRange("2026-10-14T10:00", "2026-10-13T10:00", "America/Denver")).toBeNull();
  });
});
