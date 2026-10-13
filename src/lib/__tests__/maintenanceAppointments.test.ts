import { describe, expect, it } from "vitest";
import { maintenanceReturnAfterDays } from "../maintenanceAppointments";
import { previewDateRange } from "../directBookingPreviewDates";

describe("maintenance appointment days away", () => {
  it("preserves the start clock time over spring daylight saving", () => {
    const end = maintenanceReturnAfterDays("2026-03-07T10:00", 2);
    expect(end).toBe("2026-03-09T10:00");
    const range = previewDateRange("2026-03-07T10:00", end!, "America/Denver")!;
    expect((Date.parse(range.endAt) - Date.parse(range.startAt)) / 3_600_000).toBe(47);
  });
  it("preserves the return wall time over fall daylight saving", () => {
    const end = maintenanceReturnAfterDays("2026-10-31T10:00", 2);
    expect(end).toBe("2026-11-02T10:00");
    const range = previewDateRange("2026-10-31T10:00", end!, "America/Denver")!;
    expect((Date.parse(range.endAt) - Date.parse(range.startAt)) / 3_600_000).toBe(49);
  });
  it("does not invent a return date for missing or invalid days", () => {
    for (const days of [0, -1, 1.5, 367, NaN]) expect(maintenanceReturnAfterDays("2026-10-13T10:00", days)).toBeNull();
    expect(maintenanceReturnAfterDays("2026-02-30T10:00", 2)).toBeNull();
    expect(maintenanceReturnAfterDays("", 2)).toBeNull();
  });
});
