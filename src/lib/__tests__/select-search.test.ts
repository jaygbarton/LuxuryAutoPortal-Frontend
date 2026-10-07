import { describe, expect, it } from "vitest";
import { matchesOption, optionKeywords } from "../select-search";

describe("dropdown search", () => {
  const car = { id: 42, make: "BMW", model: "X5", year: 2025, licensePlate: "ABC-123", vin: "5UXCR6C05S9X12345" };
  it.each(["bmw", "X5", "2025", "abc123", "5uxcr6", "2025 bmw x5", "ABC-123 2025"])("finds a car by %s", (query) => {
    expect(matchesOption(query, ...optionKeywords(car))).toBe(true);
  });
  it("requires every term to match, rather than showing unrelated cars", () => {
    expect(matchesOption("BMW 2024", ...optionKeywords(car))).toBe(false);
  });
  it("matches employee names, accents, email and department", () => {
    const employee = { employee_first_name: "José", employee_last_name: "Rivera", employee_email: "jose@example.com", employee_job_pay_department_name: "Operations" };
    expect(matchesOption("rivera jose operations", ...optionKeywords(employee))).toBe(true);
    expect(matchesOption("jose@example.com", ...optionKeywords(employee))).toBe(true);
  });
  it("handles empty search and missing fields without using sensitive unrelated fields", () => {
    expect(matchesOption("", ...optionKeywords(null))).toBe(true);
    expect(optionKeywords({ label: "Cash", value: "cash", passwordHash: "secret" })).toEqual(["Cash", "cash"]);
  });
});
