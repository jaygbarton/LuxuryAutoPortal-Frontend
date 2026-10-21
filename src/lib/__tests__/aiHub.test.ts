import { describe, expect, it } from "vitest";
import { hubMoney, hubNarrative, type HubReport } from "../aiHub";
describe("AI Hub report wording", () => {
  it("keeps unknown profit distinct from a zero value", () => {
    expect(hubMoney(null)).toBe("Not available");
    expect(hubMoney(0)).toBe("$0.00");
    const report = {
      status: "partial",
      sections: {
        profitability: { data: { recordedCarProfit: null } },
        lateReturns: { data: { overdueTripsLogged: 0 } },
      },
    } as HubReport;
    const text = hubNarrative(report).join(" ");
    expect(text).toContain("income entries are missing");
    expect(text).toContain("does not establish");
    expect(text).toContain("incomplete");
    expect(text).not.toContain("$0.00");
  });
  it("does not describe recorded car profit as company profit or omit incomplete coverage", () => {
    const text = hubNarrative({
      status: "ready",
      sections: {
        profitability: {
          data: { recordedCarProfit: -75, missingIncomeMonths: [3] },
        },
      },
    } as HubReport).join(" ");
    expect(text).toContain("-$75.00");
    expect(text).toContain("Income coverage is incomplete");
    expect(text).not.toContain("company profit");
  });
});
