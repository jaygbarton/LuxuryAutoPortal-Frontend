import { describe, it, expect } from "vitest";
import { DISTRIBUTION_ROWS } from "../incomeDistribution";

// INCOME sub-categories (Cathy, 2026-11-26): Trip Income first, the rest A–Z,
// then the Reimbursed Income group (Gas Reimbursed, EV On-Trip and EV
// Post-Trip Charging Reimbursed) last.
const REIMBURSED = ["gasReimbursementIncome", "onTripChargingIncome", "postTripChargingIncome"];

describe("INCOME sub-category order", () => {
  it("keeps Trip Income on top, sorts the rest A–Z and ends with Reimbursed Income", () => {
    expect(DISTRIBUTION_ROWS[0].field).toBe("tripIncome");
    expect(DISTRIBUTION_ROWS.slice(-3).map((r) => r.field)).toEqual(REIMBURSED);
    const labels = DISTRIBUTION_ROWS.slice(1, -3).map((r) => r.label.toLowerCase());
    expect(labels).toEqual([...labels].sort());
  });

  it("uses the EV charging names", () => {
    const byField = Object.fromEntries(DISTRIBUTION_ROWS.map((r) => [r.field, r.label]));
    expect(byField.onTripChargingIncome).toBe("Income EV On-Trip Charging Reimbursed");
    expect(byField.postTripChargingIncome).toBe("Income EV Post-Trip Charging Reimbursed");
  });
});
