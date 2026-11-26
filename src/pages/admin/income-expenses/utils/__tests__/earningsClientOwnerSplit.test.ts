import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Earnings page for client users (Cathy, 2026-11-26).
const src = readFileSync(resolve(__dirname, "../../../earnings.tsx"), "utf8");

describe("Earnings page, client users", () => {
  it('titles the split section "CAR OWNER SPLIT" for clients only', () => {
    expect(src).toContain('title={isClient ? "CAR OWNER SPLIT" : "CAR MANAGEMENT - OWNER SPLIT"}');
  });

  it("hides the Car Management Split row from clients", () => {
    const row = src.indexOf('label="Car Management Split"');
    expect(row).toBeGreaterThan(-1);
    expect(src.slice(src.lastIndexOf("{!isClient && (", row), row)).not.toContain(")}");
  });

  it("shows clients the car's owner split % instead of the 50/70 mode", () => {
    expect(src).toMatch(/\{isClient \? \(\s*<div[\s\S]*?\{ownerSplitPercent\}%/);
  });

  it("uses the Car Information colour for the 20th-of-the-month notice", () => {
    const notice = src.indexOf("finalized rental income and detailed expenses");
    const p = src.lastIndexOf("<p ", notice);
    const tag = src.slice(p, src.indexOf(">", p));
    expect(tag).toContain("text-muted-foreground");
    expect(tag).not.toContain("text-red");
  });
});
