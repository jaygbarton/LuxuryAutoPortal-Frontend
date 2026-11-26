import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findStandardCategoryMatch } from "../standardCategoryNames";

// REIMBURSE AND NON-REIMBURSE BILLS rows start with "Expenses" (Cathy,
// 2026-11-26); the section keeps its name.
const ROWS = [
  "Expenses Electric - Reimbursed",
  "Expenses Electric - Not Reimbursed",
  "Expenses Gas – Charged to Guest",
  "Expenses Gas – Not Charged to Guest",
  "Expenses Gas - Service Run",
  "Expenses Parking Airport",
  "Expenses Credit to Car Owner",
];
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

describe("Reimbursed bills rows start with Expenses", () => {
  const table = read("../../components/IncomeExpenseTable.tsx");
  const earnings = read("../../../earnings.tsx");

  it("labels every row on Income & Expenses", () => {
    for (const label of ROWS) expect(table).toContain(`label="${label}"`);
  });

  // The bills section is not on Earnings for any user (Cathy, 2026-11-26).
  it("does not show the bills section on Earnings", () => {
    expect(earnings).not.toContain('title="REIMBURSED AND NON-REIMBURSED BILLS"');
    for (const label of ROWS) expect(earnings).not.toContain(`label="${label}"`);
  });

  it("keeps the section name", () => {
    expect(table).toContain('title="REIMBURSE AND NON-REIMBURSE BILLS"');
  });

  it("treats the new names as the standard rows, not new subcategories", () => {
    for (const label of ROWS) expect(findStandardCategoryMatch("reimbursedBills", label)).toBeTruthy();
  });
});
