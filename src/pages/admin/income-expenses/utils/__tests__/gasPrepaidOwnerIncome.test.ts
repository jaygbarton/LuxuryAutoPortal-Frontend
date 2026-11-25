import { describe, expect, it } from "vitest";
import { computeOwnerSplit, type OwnerSplitInputs } from "@/lib/ownerSplit";
import { incomeShareNote } from "../incomeShareNotes";

// Gas Prepaid Income — 100% Owner Share (2026+): carved out of Rental Income
// and paid wholly to the owner, like Miles Income. The I&E page passes it to
// computeOwnerSplit inside milesIncome. Mirrors the backend's
// gasPrepaidOwnerIncomeSplit.test.ts.
const base: OwnerSplitInputs = {
  year: 2026, mode: 50, ownerPercent: 0.5, skiRacksOwner: "GLA",
  rentalIncome: 1000, deliveryIncome: 0, electricPrepaidIncome: 0, smokingFines: 0,
  gasPrepaidIncome: 0, skiRacksIncome: 0, milesIncome: 0, childSeatIncome: 0,
  coolersIncome: 0, insuranceWreckIncome: 0, otherIncome: 0, guestCancellationIncome: 0,
  negativeBalanceCarryOver: 0, totalDirectDelivery: 0, totalCogs: 0, totalParkingFeeLabor: 0,
};

describe("Gas Prepaid Income (100% Owner Share)", () => {
  it.each([
    // [mode, ownerPercent, expected] — rental 1000 incl. 100 owner gas
    [50, 0.5, 550], // 100 + 900 * 0.5
    [70, 0.7, 730], // 100 + 900 * 0.7
  ] as const)("2026 mode %i: deducted from the pool and paid 100%% to the owner", (mode, ownerPercent, expected) => {
    expect(computeOwnerSplit({ ...base, mode, ownerPercent, milesIncome: 100 })).toBeCloseTo(expected, 2);
  });

  it("is the mirror of Gas Prepaid Income (Host Share)", () => {
    // Host-share gas leaves the owner only their percent of what remains.
    expect(computeOwnerSplit({ ...base, gasPrepaidIncome: 100 })).toBeCloseTo(450, 2);
  });

  it("has the 100% Owner Share note", () => {
    expect(incomeShareNote("gasPrepaidOwnerIncome", 2026, {})).toBe("100% Owner Share");
    expect(incomeShareNote("gasPrepaidIncome", 2026, {})).toBe("100% Host Share");
  });
});
