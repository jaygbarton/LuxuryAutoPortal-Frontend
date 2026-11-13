import { describe, expect, it } from "vitest";
import { daysOpen, formatRecallDay, recallStatusLabel, recallVehicleName } from "../recalls";

describe("recall helpers", () => {
  it("formats a stored day without a timezone shifting it", () => {
    expect(formatRecallDay("2026-11-19")).toBe("11/19/2026");
    expect(formatRecallDay("2026-11-19T00:00:00.000Z")).toBe("11/19/2026");
    expect(formatRecallDay(null)).toBe("--");
  });

  it("counts days open from the Turo email, falling back to when it was entered", () => {
    const now = Date.parse("2026-11-13T12:00:00Z");
    expect(daysOpen({ emailReceivedAt: "2026-08-25T16:00:00Z", createdAt: "2026-11-12T00:00:00Z" }, now)).toBe(79);
    expect(daysOpen({ emailReceivedAt: null, createdAt: "2026-11-12T00:00:00Z" }, now)).toBe(1);
  });

  it("labels status and vehicle", () => {
    expect(recallStatusLabel("repair_completed")).toBe("Repair Completed");
    expect(recallVehicleName({ carName: null, vehicleLabel: "Toyota Sienna" })).toBe("Toyota Sienna");
  });
});
