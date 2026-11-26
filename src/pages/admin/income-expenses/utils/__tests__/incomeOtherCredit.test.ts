import { describe, it, expect } from "vitest";
import { computeOwnerSplit } from "@/lib/ownerSplit";
import { DISTRIBUTION_ROWS } from "../incomeDistribution";
import { EBITDA_ADDITIONAL_INCOME_FIELDS } from "../ebitda";

// Income Other Credit (Cathy, 2026-11-26): 100% Owner Share, outside Rental
// Income, like Income Guest Cancellation. Callers pass it inside the
// guestCancellationIncome input of computeOwnerSplit (both are owner add-ons).

describe("Income Other Credit", () => {
  it("adds in full to the Car Owner Split", () => {
    const base = {
      year: 2026, mode: 50 as const, ownerPercent: 0.5, skiRacksOwner: "GLA" as const,
      rentalIncome: 1000, deliveryIncome: 0, electricPrepaidIncome: 0, smokingFines: 0,
      gasPrepaidIncome: 0, skiRacksIncome: 0, milesIncome: 0, childSeatIncome: 0,
      coolersIncome: 0, insuranceWreckIncome: 0, otherIncome: 0, negativeBalanceCarryOver: 0,
      totalDirectDelivery: 0, totalCogs: 0, totalParkingFeeLabor: 0,
    };
    expect(computeOwnerSplit({ ...base, guestCancellationIncome: 0 })).toBe(500);
    expect(computeOwnerSplit({ ...base, guestCancellationIncome: 100 })).toBe(600);
  });

  it("is a 100% Car Owner row right after Income Other Turo in the Income Distribution", () => {
    const i = DISTRIBUTION_ROWS.findIndex((r) => r.field === "otherIncome");
    expect(DISTRIBUTION_ROWS[i + 1]).toEqual({ field: "otherCreditIncome", label: "Income Other Credit" });
  });

  it("counts in EBITDA Total Income like Guest Cancellation", () => {
    expect(EBITDA_ADDITIONAL_INCOME_FIELDS).toContain("otherCreditIncome");
  });
});
