import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { distributeIncomeMonth } from "../incomeDistribution";

// Earnings INCOME: Total Income, % Amount, Income Distribution to Car Owner,
// Total Car Owner Income, as on the Statement of Account (Cathy, 2026-11-26).
const src = readFileSync(resolve(__dirname, "../../../earnings.tsx"), "utf8");

describe("Earnings car owner income rows", () => {
  it("adds the rows after the Income Shares and highlights the three totals", () => {
    const order = ['label="Total Income"', "label={percentNote(", 'label="Income Distribution to Car Owner"', 'label="Total Car Owner Income"'];
    const at = order.map((s) => src.indexOf(s));
    at.forEach((i) => expect(i).toBeGreaterThan(src.indexOf('label="Income Turo Claims & Insurance Payments"')));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    for (const s of ['label="Total Income"', "label={percentNote(", 'label="Total Car Owner Income"']) {
      expect(src.slice(src.indexOf(s), src.indexOf("/>", src.indexOf(s)))).toContain("isHighlighted");
    }
  });

  it("matches the Statement of Account example (Jul: Total 1999.94, 70% 1399.96, owner 1525.02)", () => {
    const m = distributeIncomeMonth({
      year: 2026, mode: 70, mgmtPercent: 30, ownerPercent: 70, skiRacksOwner: "GLA",
      values: { rentalIncome: 2275, deliveryIncome: 50, electricPrepaidIncome: 100, milesIncome: 125.06 },
    })!;
    expect(m.tripIncome.amount).toBe(1999.94);
    expect(m.tripIncome.owner).toBe(1399.96);
    const distribution = m.milesIncome.owner + m.deliveryIncome.owner + m.electricPrepaidIncome.owner;
    expect(Math.round((m.tripIncome.owner + distribution) * 100) / 100).toBe(1525.02);
  });
});
