import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Earnings, like the Statement of Account (Cathy, 2026-11-26): after GLA
// PARKING FEE & LABOR CLEANING come Total Expenses, Negative Balance Carry
// Over and Total Payout (the final Car Owner Split).
const src = readFileSync(resolve(__dirname, "../../../earnings.tsx"), "utf8");

describe("Earnings Total Expenses / Negative Balance / Total Payout", () => {
  it("puts the three rows in order after the GLA Parking Fee section", () => {
    const at = [
      'title="GLA PARKING FEE & LABOR CLEANING"',
      'label="Total Expenses"',
      'label="Negative Balance Carry Over"',
      'label="Total Payout"',
    ].map((s) => src.indexOf(s));
    at.forEach((i) => expect(i).toBeGreaterThan(-1));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("shows Negative Balance Carry Over only once (moved, not copied)", () => {
    expect(src.split('label="Negative Balance Carry Over"').length - 1).toBe(1);
  });

  it("totals every expense section and pays out the Car Owner Split", () => {
    const exp = src.slice(src.indexOf('label="Total Expenses"'), src.indexOf("/>", src.indexOf('label="Total Expenses"')));
    expect(exp).toContain("getTotalDirectDeliveryForMonth");
    expect(exp).toContain("getTotalCogsForMonth");
    expect(exp).toContain("getTotalParkingFeeLaborForMonth");
    const payout = src.slice(src.indexOf('label="Total Payout"'), src.indexOf("/>", src.indexOf('label="Total Payout"')));
    expect(payout).toContain("calculateCarOwnerSplit");
  });
});
