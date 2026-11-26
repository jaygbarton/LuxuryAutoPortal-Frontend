import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The Earnings page is built for client users, and admins/staff see the same
// page (Cathy, 2026-11-26).
const src = readFileSync(resolve(__dirname, "../../../earnings.tsx"), "utf8");

describe("Earnings page: one client layout for every user", () => {
  it("has no isClient layout gates left", () => {
    expect(src).not.toMatch(/\{!?isClient\s*(&&|\?)/);
    expect(src).not.toContain("userData?.user?.isClient");
  });

  it('titles the split section "CAR OWNER SPLIT" with no Car Management Split row', () => {
    expect(src).toContain('title="CAR OWNER SPLIT"');
    expect(src).not.toContain('label="Car Management Split"');
  });

  it("shows the car's owner split % under each month, not the 50/70 mode", () => {
    expect(src).toContain("{ownerSplitPercent}%");
    expect(src).not.toContain("Rate mode:");
  });

  it("does not show Reimbursed Income or Cars Available", () => {
    expect(src).not.toContain('label="Reimbursed Income"');
    expect(src).not.toContain('label="Income Gas Reimbursed"');
    expect(src).not.toContain('label="Cars Available"');
  });

  it("uses the Car Information colour for the 20th-of-the-month notice", () => {
    const notice = src.indexOf("finalized rental income and detailed expenses");
    const p = src.lastIndexOf("<p ", notice);
    const tag = src.slice(p, src.indexOf(">", p));
    expect(tag).toContain("text-muted-foreground");
    expect(tag).not.toContain("text-red");
  });
});
