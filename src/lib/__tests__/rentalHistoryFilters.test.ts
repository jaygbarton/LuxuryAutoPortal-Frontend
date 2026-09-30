import { describe, expect, it } from "vitest";
import { buildRentalHistorySearchParams } from "../rentalHistoryFilters";

describe("buildRentalHistorySearchParams", () => {
  it("omits the status parameter when all statuses are selected", () => {
    const params = buildRentalHistorySearchParams({
      plate: "A907GJ",
      vin: "1C4SJSBP5RS130997",
      status: "all",
    });

    expect(params.get("plate")).toBe("A907GJ");
    expect(params.get("vin")).toBe("1C4SJSBP5RS130997");
    expect(params.has("status")).toBe(false);
    expect(params.get("limit")).toBe("200");
  });

  it("sends the selected status to the server", () => {
    const params = buildRentalHistorySearchParams({
      plate: "A907GJ",
      vin: "1C4SJSBP5RS130997",
      status: "cancelled",
    });

    expect(params.get("status")).toBe("cancelled");
  });
});
