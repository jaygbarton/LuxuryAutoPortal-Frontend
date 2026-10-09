/**
 * The gold "who gets this income" note shown next to each add-on income row on
 * the I&E and Earnings pages. Each note restates what computeCarMonthSplits
 * (backend incomeExpenseService-raw-sql.ts) does with that field for the year
 * and month mode, so the note always agrees with the Car Owner / Management
 * Split rows above it.
 */
export type IncomeShareField =
  | "deliveryIncome"
  | "electricPrepaidIncome"
  | "smokingFines"
  | "gasPrepaidIncome"
  | "skiRacksIncome"
  | "milesIncome"
  | "childSeatIncome"
  | "coolersIncome"
  | "insuranceWreckIncome"
  | "otherIncome";

const HOST = "100% Host Share";
const OWNER = "100% Owner Share";
const SMOKING_10_90 = "10% Owner Share, 90% Host Share";
const SHARED_50 = "50% Host & Owner Share";

const NOTES_2026: Record<IncomeShareField, string> = {
  deliveryIncome: HOST,
  electricPrepaidIncome: HOST,
  smokingFines: SMOKING_10_90,
  gasPrepaidIncome: HOST,
  skiRacksIncome: "100% Ski Racks Owner Share",
  milesIncome: OWNER,
  childSeatIncome: HOST,
  coolersIncome: HOST,
  insuranceWreckIncome: HOST,
  otherIncome: HOST,
};

// 2019–2025, 50/50 mode: Smoking Fines go wholly to GLA, Miles wholly to the
// owner, and Ski Racks / Child Seat / Coolers / Insurance / Other are split.
const NOTES_LEGACY_50: Record<IncomeShareField, string> = {
  deliveryIncome: HOST,
  electricPrepaidIncome: HOST,
  smokingFines: HOST,
  gasPrepaidIncome: HOST,
  skiRacksIncome: SHARED_50,
  milesIncome: OWNER,
  childSeatIncome: SHARED_50,
  coolersIncome: SHARED_50,
  insuranceWreckIncome: SHARED_50,
  otherIncome: SHARED_50,
};

// 2019–2025, 70/30 mode: everything but Miles and the owner's 10% of Smoking
// Fines stays with GLA.
const NOTES_LEGACY_70: Record<IncomeShareField, string> = {
  deliveryIncome: HOST,
  electricPrepaidIncome: HOST,
  smokingFines: SMOKING_10_90,
  gasPrepaidIncome: HOST,
  skiRacksIncome: HOST,
  milesIncome: OWNER,
  childSeatIncome: HOST,
  coolersIncome: HOST,
  insuranceWreckIncome: HOST,
  otherIncome: HOST,
};

/**
 * The note for one income row, or undefined when none applies. Before 2026 the
 * rule depends on each month's 50/70 mode (unset months are 50, as in the
 * formula); a year mixing both modes shows a note only where the two agree.
 * Years before 2019 have no split formula, so they get no note.
 */
export function incomeShareNote(
  field: IncomeShareField,
  year: number,
  monthModes: { [month: number]: 50 | 70 },
): string | undefined {
  if (year >= 2026) return NOTES_2026[field];
  if (!(year >= 2019)) return undefined;
  const notes = new Set<string>();
  for (let m = 1; m <= 12; m++) {
    notes.add((monthModes[m] === 70 ? NOTES_LEGACY_70 : NOTES_LEGACY_50)[field]);
  }
  return notes.size === 1 ? [...notes][0] : undefined;
}
