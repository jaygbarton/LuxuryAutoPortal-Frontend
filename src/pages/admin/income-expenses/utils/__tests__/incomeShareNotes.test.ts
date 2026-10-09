import { describe, expect, it } from "vitest";
import { incomeShareNote, type IncomeShareField } from "../incomeShareNotes";

const allMonths = (mode: 50 | 70) =>
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, mode])) as { [m: number]: 50 | 70 };

const notesFor = (year: number, modes: { [m: number]: 50 | 70 }) => {
  const fields: IncomeShareField[] = [
    "deliveryIncome", "electricPrepaidIncome", "smokingFines", "gasPrepaidIncome", "skiRacksIncome",
    "milesIncome", "childSeatIncome", "coolersIncome", "insuranceWreckIncome", "otherIncome",
  ];
  return Object.fromEntries(fields.map((f) => [f, incomeShareNote(f, year, modes)]));
};

describe("incomeShareNote", () => {
  it("2025 on 50/50 restates the 2019–2025 50/50 formula (car 864, owner request 2026-10-10)", () => {
    expect(notesFor(2025, allMonths(50))).toEqual({
      deliveryIncome: "100% Host Share",
      electricPrepaidIncome: "100% Host Share",
      smokingFines: "100% Host Share",
      gasPrepaidIncome: "100% Host Share",
      skiRacksIncome: "50% Host & Owner Share",
      milesIncome: "100% Owner Share",
      childSeatIncome: "50% Host & Owner Share",
      coolersIncome: "50% Host & Owner Share",
      insuranceWreckIncome: "50% Host & Owner Share",
      otherIncome: "50% Host & Owner Share",
    });
  });

  it("2024 on 70/30 keeps everything but Miles and 10% of Smoking Fines with GLA", () => {
    const notes = notesFor(2024, allMonths(70));
    expect(notes.smokingFines).toBe("10% Owner Share, 90% Host Share");
    expect(notes.milesIncome).toBe("100% Owner Share");
    expect(notes.skiRacksIncome).toBe("100% Host Share");
    expect(notes.otherIncome).toBe("100% Host Share");
  });

  it("a year mixing 50 and 70 months shows only the notes both modes agree on", () => {
    const notes = notesFor(2025, { ...allMonths(50), 7: 70 });
    expect(notes.deliveryIncome).toBe("100% Host Share");
    expect(notes.milesIncome).toBe("100% Owner Share");
    expect(notes.smokingFines).toBeUndefined();
    expect(notes.skiRacksIncome).toBeUndefined();
  });

  it("unset months count as 50, like the formula", () => {
    expect(incomeShareNote("smokingFines", 2025, {})).toBe("100% Host Share");
  });

  it("2026+ keeps its notes regardless of month mode", () => {
    expect(incomeShareNote("smokingFines", 2026, allMonths(50))).toBe("10% Owner Share, 90% Host Share");
    expect(incomeShareNote("skiRacksIncome", 2027, allMonths(70))).toBe("100% Ski Racks Owner Share");
  });

  it("years before 2019 have no formula, so no note", () => {
    expect(incomeShareNote("deliveryIncome", 2018, allMonths(50))).toBeUndefined();
  });
});
