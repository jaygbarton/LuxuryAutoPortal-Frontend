import { expect, it } from "vitest";
import { legacyCarDestination, reportSectionId } from "../report-navigation";
it("keeps the original car ID and report/period instead of sending every legacy report to the general page", () => {
  expect(
    legacyCarDestination(
      "cogs",
      new URLSearchParams("carId=902&year=2025&month=12"),
    ),
  ).toBe("/admin/cars/902/income-expense?section=cogs&year=2025&month=12");
  expect(
    legacyCarDestination(
      "history",
      new URLSearchParams("car_id=902&year=2024"),
    ),
  ).toBe("/admin/cars/902/income-expense?section=history&year=2024");
  expect(reportSectionId("OPERATING EXPENSE (COGS - Per Vehicle)")).toBe(
    "cogs",
  );
});
it("does not propagate tokens, arbitrary redirects or an invalid car ID", () => {
  expect(
    legacyCarDestination(
      "income",
      new URLSearchParams(
        "id=902&token=private&next=https://example.test&year=bad",
      ),
    ),
  ).toBe("/admin/cars/902/income-expense");
  expect(legacyCarDestination("cogs", new URLSearchParams("id=1/path"))).toBe(
    "/cars",
  );
});
