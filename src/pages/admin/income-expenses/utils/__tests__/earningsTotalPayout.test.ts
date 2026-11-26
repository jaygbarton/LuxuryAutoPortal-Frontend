import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Earnings (Cathy, 2026-11-26): GLA PARKING FEE & LABOR CLEANING has its own
// total; INCOME AND EXPENSES SUMMARY below it holds Total Car Owner Income,
// Total Expenses, Negative Balance Carry Over and Total Payout.
const src = readFileSync(resolve(__dirname, "../../../earnings.tsx"), "utf8");
const rowAt = (label: string, from = 0) => src.indexOf(`label="${label}"`, from);
const rowTag = (at: number) => src.slice(at, src.indexOf("/>", at));

describe("Earnings INCOME AND EXPENSES SUMMARY", () => {
  const section = src.indexOf('title="GLA PARKING FEE & LABOR CLEANING"');
  const summary = src.indexOf('title="INCOME AND EXPENSES SUMMARY"');

  it("totals the GLA Parking Fee section inside it", () => {
    const at = rowAt("Total GLA Parking Fee & Labor Cleaning");
    expect(at).toBeGreaterThan(section);
    expect(at).toBeLessThan(summary);
  });

  it("puts the four rows, in order, in the summary section", () => {
    const at = ["Total Car Owner Income", "Total Expenses", "Negative Balance Carry Over", "Total Payout"].map((l) => rowAt(l, summary));
    at.forEach((i) => expect(i).toBeGreaterThan(summary));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("has Total Expenses, Negative Balance Carry Over and Total Payout only there", () => {
    for (const l of ["Total Expenses", "Negative Balance Carry Over", "Total Payout"]) {
      expect(src.split(`label="${l}"`).length - 1).toBe(1);
    }
  });

  it("highlights Total Expenses and Negative Balance Carry Over", () => {
    expect(rowTag(rowAt("Total Expenses", summary))).toContain("isHighlighted");
    expect(rowTag(rowAt("Negative Balance Carry Over", summary))).toContain("isHighlighted");
  });

  it("uses the statement's Total Expenses and pays out the Car Owner Split", () => {
    expect(src).toMatch(/const totalCarExpenses = [\s\S]*getTotalDirectDeliveryForMonth[\s\S]*getTotalCogsForMonth[\s\S]*getTotalParkingFeeLaborForMonth/);
    expect(rowTag(rowAt("Total Payout", summary))).toContain("calculateCarOwnerSplit");
  });
});
