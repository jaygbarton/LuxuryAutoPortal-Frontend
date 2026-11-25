import { describe, it, expect } from "vitest";
import { distributeIncomeMonth, fleetShareNote, percentNote, DISTRIBUTION_ROWS } from "../incomeDistribution";

const base = { mode: 50 as const, mgmtPercent: 50, ownerPercent: 50, skiRacksOwner: "GLA" as const };

describe("distributeIncomeMonth", () => {
  it("splits trip income after carve-outs and sends each carve-out to its side (2026)", () => {
    const d = distributeIncomeMonth({
      ...base,
      year: 2026,
      values: { rentalIncome: 2000, deliveryIncome: 100, milesIncome: 50, smokingFines: 50, guestCancellationIncome: 40, gasReimbursementIncome: 25 },
    })!;
    expect(d.tripIncome).toMatchObject({ amount: 1800, mgmt: 900, owner: 900 });
    expect(d.deliveryIncome).toMatchObject({ mgmt: 100, owner: 0 });
    expect(d.milesIncome).toMatchObject({ mgmt: 0, owner: 50 });
    expect(d.smokingFines).toMatchObject({ mgmt: 45, owner: 5, mgmtPercent: 90, ownerPercent: 10 });
    expect(d.guestCancellationIncome).toMatchObject({ mgmt: 0, owner: 40 });
    expect(d.gasReimbursementIncome).toMatchObject({ mgmt: 25, owner: 0 });
  });

  it("gives every dollar of income to exactly one side (totals add back to total income)", () => {
    const values = {
      rentalIncome: 3210.55, deliveryIncome: 200, electricPrepaidIncome: 30, smokingFines: 150, gasPrepaidIncome: 40,
      gasPrepaidOwnerIncome: 12.5, skiRacksIncome: 60, milesIncome: 121.05, childSeatIncome: 20, coolersIncome: 15,
      insuranceWreckIncome: 300, otherIncome: 7.33, guestCancellationIncome: 88, gasReimbursementIncome: 19.99,
      onTripChargingIncome: 10, postTripChargingIncome: 5,
    };
    const totalIncome = values.rentalIncome + values.guestCancellationIncome + values.gasReimbursementIncome +
      values.onTripChargingIncome + values.postTripChargingIncome;
    for (const year of [2021, 2025, 2026]) {
      for (const mode of [50, 70] as const) {
        const d = distributeIncomeMonth({ year, mode, mgmtPercent: mode === 70 ? 30 : 50, ownerPercent: mode === 70 ? 70 : 50, skiRacksOwner: "CAR_OWNER", values })!;
        const sum = DISTRIBUTION_ROWS.reduce((s, { field }) => s + d[field].mgmt + d[field].owner, 0);
        expect(sum).toBeCloseTo(totalIncome, 2);
      }
    }
  });

  it("follows the 2019–2025 rules for 50/50 and 70/30 months", () => {
    const values = { rentalIncome: 1000, smokingFines: 100, childSeatIncome: 40, skiRacksIncome: 20 };
    const fifty = distributeIncomeMonth({ ...base, year: 2024, values })!;
    expect(fifty.smokingFines).toMatchObject({ mgmt: 100, owner: 0 });
    expect(fifty.childSeatIncome).toMatchObject({ mgmt: 20, owner: 20 });
    expect(fifty.skiRacksIncome).toMatchObject({ mgmt: 10, owner: 10 });
    const seventy = distributeIncomeMonth({ ...base, year: 2024, mode: 70, mgmtPercent: 30, ownerPercent: 70, values })!;
    expect(seventy.smokingFines).toMatchObject({ mgmt: 90, owner: 10 });
    expect(seventy.childSeatIncome).toMatchObject({ mgmt: 40, owner: 0 });
    expect(seventy.tripIncome).toMatchObject({ amount: 840, mgmt: 252, owner: 588 });
  });

  it("sends 2026 ski racks to the month's ski rack owner", () => {
    const gla = distributeIncomeMonth({ ...base, year: 2026, values: { skiRacksIncome: 30 } })!;
    const owner = distributeIncomeMonth({ ...base, year: 2026, skiRacksOwner: "CAR_OWNER", values: { skiRacksIncome: 30 } })!;
    expect(gla.skiRacksIncome).toMatchObject({ mgmt: 30, owner: 0 });
    expect(owner.skiRacksIncome).toMatchObject({ mgmt: 0, owner: 30 });
  });

  it("shows a negative trip pool when carve-outs exceed trip income", () => {
    const d = distributeIncomeMonth({ ...base, year: 2026, values: { rentalIncome: 0, deliveryIncome: 50 } })!;
    expect(d.tripIncome).toMatchObject({ amount: -50, mgmt: -25, owner: -25 });
    expect(d.deliveryIncome.mgmt).toBe(50);
  });

  it("has no distribution before 2019", () => {
    expect(distributeIncomeMonth({ ...base, year: 2018, values: { rentalIncome: 500 } })).toBeNull();
  });
});

describe("percentNote", () => {
  it("names one % when every month agrees", () => {
    expect(percentNote([50, 50, 50])).toBe("50%");
    expect(percentNote([30, 50])).toBe("% by month");
  });
});

describe("fleetShareNote (All Cars / Totals)", () => {
  it("names the fixed share every car gets", () => {
    expect(fleetShareNote("smokingFines", 2026, "mgmt")).toBe("90%");
    expect(fleetShareNote("smokingFines", 2026, "owner")).toBe("10%");
    expect(fleetShareNote("deliveryIncome", 2026, "mgmt")).toBe("100%");
    expect(fleetShareNote("milesIncome", 2026, "owner")).toBe("100%");
  });

  it("leaves out a side that never gets a share", () => {
    expect(fleetShareNote("deliveryIncome", 2026, "owner")).toBeNull();
    expect(fleetShareNote("guestCancellationIncome", 2026, "mgmt")).toBeNull();
    expect(fleetShareNote("deliveryIncome", 2018, "mgmt")).toBeNull();
  });

  it("says when the share depends on the car", () => {
    expect(fleetShareNote("skiRacksIncome", 2026, "owner")).toBe("varies by car");
    expect(fleetShareNote("childSeatIncome", 2024, "owner")).toBe("varies by car");
    expect(fleetShareNote("tripIncome", 2026, "mgmt")).toBe("each car's %");
  });
});
