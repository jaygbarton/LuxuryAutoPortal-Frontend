import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { INCOME_SHARE_FIELDS } from "../incomeShareNotes";
import { DISTRIBUTION_ROWS, distributeIncomeMonth, type DistributionMonthInput } from "../incomeDistribution";

// "Income Shares" (Cathy, 2026-11-26): the rows under
// it must be exactly the income carved out of Trip Income, so the sub-heading
// is true. Income Other Credit and the Reimbursed Income rows stay outside.
const tripAfter = (field: string, amount: number) => {
  const input: DistributionMonthInput = {
    year: 2026,
    mode: 50,
    mgmtPercent: 30,
    ownerPercent: 70,
    skiRacksOwner: "GLA",
    values: { rentalIncome: 1000, [field]: amount } as DistributionMonthInput["values"],
  };
  return distributeIncomeMonth(input)!.tripIncome.amount;
};

describe("Income Shares group", () => {
  it("holds only rows that are part of Trip Income", () => {
    for (const field of INCOME_SHARE_FIELDS) expect(tripAfter(field, 100)).toBe(900);
  });

  it("holds every row that is part of Trip Income", () => {
    const outside = DISTRIBUTION_ROWS.map((r) => r.field).filter(
      (f) => f !== "tripIncome" && !(INCOME_SHARE_FIELDS as readonly string[]).includes(f),
    );
    expect(outside.sort()).toEqual(
      ["gasReimbursementIncome", "onTripChargingIncome", "otherCreditIncome", "postTripChargingIncome"].sort(),
    );
    for (const field of outside) expect(tripAfter(field, 100)).toBe(1000);
  });
});

describe("Earnings page (car owners)", () => {
  const src = readFileSync(resolve(__dirname, "../../../earnings.tsx"), "utf8");

  it("shows the Income Shares and Owner Credit sub-headings", () => {
    expect(src).toContain('label="Income Shares"');
    expect(src).toContain('label="Owner Credit (not in Trip Income)"');
  });

  it("does not show Reimbursed Income on Earnings", () => {
    expect(src).not.toContain('label="Reimbursed Income"');
  });
});
