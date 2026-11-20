import { describe, expect, it } from "vitest";
import { rentalAveragePerKnownTrip, rentalMetricKnownTotal } from "../rentalReportMetrics";

// Shape of the 2024 car in the bug report: Feb and Dec unknown (null), the
// rest known.
const trips = [3, null, 6, 8, 4, 1, 4, 4, 6, 6, 3, null];
const income = [2784, 1330, 1599, 995, 965, 248, 1363, 1059, 1309, 1055, 348, 0];

describe("rentalMetricKnownTotal", () => {
  it("totals the known months and lists the unknown ones", () => {
    expect(rentalMetricKnownTotal(trips)).toEqual({ total: 45, missing: [1, 11] });
  });

  it("is null only when no month is known", () => {
    expect(rentalMetricKnownTotal(Array(12).fill(null)).total).toBeNull();
    expect(rentalMetricKnownTotal([null, 0, null]).total).toBe(0);
  });
});

describe("rentalAveragePerKnownTrip", () => {
  it("leaves out the income of months whose trip count is unknown", () => {
    // Feb's $1330 has no known trips, so it must not inflate the average.
    const knownIncome = income.reduce((sum, value, i) => (trips[i] === null ? sum : sum + value), 0);
    expect(rentalAveragePerKnownTrip(income, trips)).toBeCloseTo(knownIncome / 45, 6);
  });

  it("is 0 with known months but no trips, null with no known month", () => {
    expect(rentalAveragePerKnownTrip([100, 50], [0, 0])).toBe(0);
    expect(rentalAveragePerKnownTrip([100, 50], [null, undefined])).toBeNull();
  });
});
