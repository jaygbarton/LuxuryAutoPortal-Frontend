import { describe, it, expect } from "vitest";
import { ebitdaIncome, ebitdaExpenses } from "../ebitda";

describe("All Cars EBITDA", () => {
  it("Total Income adds the four additional income rows to Rental Income", () => {
    expect(ebitdaIncome({
      rentalIncome: 10000, guestCancellationIncome: 200, gasReimbursementIncome: 150,
      onTripChargingIncome: 40, postTripChargingIncome: 60, otherIncome: 999,
    })).toBe(10450); // Other Income is inside Rental Income already
  });

  it("Total Expenses leaves Car Payment out", () => {
    // mgmt 1500 + owner 3500 + office 800 = 5800, minus car payment 1200 = 4600.
    expect(ebitdaExpenses(
      { carManagementTotalExpenses: 1500, carOwnerTotalExpenses: 3500 },
      { carPayment: 1200, carInsurance: 300 },
      800,
    )).toBe(4600);
  });

  it("missing values count as 0", () => {
    expect(ebitdaIncome(undefined)).toBe(0);
    expect(ebitdaExpenses(undefined, undefined, 0)).toBe(0);
  });
});
