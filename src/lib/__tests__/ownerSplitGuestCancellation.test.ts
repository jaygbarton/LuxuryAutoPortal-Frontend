import { describe, expect, it } from "vitest";
import { computeOwnerSplit, type OwnerSplitInputs } from "../ownerSplit";
import { incomeShareNote } from "@/pages/admin/income-expenses/utils/incomeShareNotes";

// Guest Cancellation Income works like Miles Income (Cathy, 2026-11-26): it is
// carved out of Rental Income (subtracted from the rental pool) and paid 100%
// to the Car Owner Split in every branch. Mirrors the backend's
// computeCarMonthSplits (guestCancellationIncomeSplit.test.ts there).
const base: OwnerSplitInputs = {
  year: 2026, mode: 50, ownerPercent: 0.5, skiRacksOwner: "GLA",
  rentalIncome: 1000, deliveryIncome: 0, electricPrepaidIncome: 0, smokingFines: 0,
  gasPrepaidIncome: 0, skiRacksIncome: 0, milesIncome: 0, childSeatIncome: 0,
  coolersIncome: 0, insuranceWreckIncome: 0, otherIncome: 0, guestCancellationIncome: 0,
  negativeBalanceCarryOver: 0, totalDirectDelivery: 0, totalCogs: 0, totalParkingFeeLabor: 0,
};

describe("computeOwnerSplit — Guest Cancellation Income", () => {
  it.each([
    // [year, mode, ownerPercent, expected] — rental 1000, GCI 100
    [2026, 50, 0.5, 550], // (1000 - 100)*0.5 + 100
    [2026, 70, 0.7, 730], // (1000 - 100)*0.7 + 100
    [2025, 50, 0.5, 550],
    [2025, 70, 0.7, 730],
  ] as const)("%i mode %i carves it out of rental and pays it 100% to the owner", (year, mode, ownerPercent, expected) => {
    expect(computeOwnerSplit({ ...base, year, mode, ownerPercent, guestCancellationIncome: 100 })).toBeCloseTo(expected, 2);
  });

  it("gives the same split as the same amount of Miles Income", () => {
    for (const [year, mode, ownerPercent] of [[2026, 50, 0.5], [2026, 70, 0.7], [2025, 50, 0.5], [2025, 70, 0.7]] as const) {
      expect(computeOwnerSplit({ ...base, year, mode, ownerPercent, guestCancellationIncome: 80 }))
        .toBeCloseTo(computeOwnerSplit({ ...base, year, mode, ownerPercent, milesIncome: 80 }), 2);
    }
  });

  it("zero GCI leaves the split unchanged", () => {
    expect(computeOwnerSplit(base)).toBeCloseTo(500, 2);
  });
});

describe("incomeShareNote — Guest Cancellation Income", () => {
  it("is 100% Owner Share in every year and mode", () => {
    expect(incomeShareNote("guestCancellationIncome", 2026, {})).toBe("100% Owner Share");
    expect(incomeShareNote("guestCancellationIncome", 2025, { 1: 50 })).toBe("100% Owner Share");
    expect(incomeShareNote("guestCancellationIncome", 2025, { 1: 70 })).toBe("100% Owner Share");
  });
});
