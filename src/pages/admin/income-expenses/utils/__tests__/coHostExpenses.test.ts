import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isCoHostExpenseName } from "../coHostExpenses";

// REIMBURSE AND NON-REIMBURSE BILLS: GLA Expenses / Co-Host Expenses (Cathy, 2026-11-26).
describe("Co-Host Expenses grouping", () => {
  it("puts rows whose name says Co-Host under Co-Host Expenses", () => {
    expect(isCoHostExpenseName("Expenses Co-Host: Violation Ticket Not Reimbursed")).toBe(true);
    expect(isCoHostExpenseName("Violation Ticket Not Reimbursed (Co-Host)")).toBe(true);
    expect(isCoHostExpenseName("Cohost tolls")).toBe(true);
  });

  it("keeps every other row under GLA Expenses", () => {
    for (const n of ["Expenses Parking Airport", "Expenses Credit to Car Owner", "Violation Ticket", "Hostage fee", ""]) {
      expect(isCoHostExpenseName(n)).toBe(false);
    }
  });

  it("shows both sub-headings on Income & Expenses and Totals", () => {
    for (const p of ["../../components/IncomeExpenseTable.tsx", "../../../totals.tsx"]) {
      const src = readFileSync(resolve(__dirname, p), "utf8");
      expect(src).toContain("GLA_EXPENSES_HEADING");
      expect(src).toContain("CO_HOST_EXPENSES_HEADING");
    }
  });
});
