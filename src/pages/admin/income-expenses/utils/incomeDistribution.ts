/**
 * INCOME DISTRIBUTION (Cathy, 2026-11-25): how each income row of
 * the INCOME & EXPENSES section is divided between Car Management and the Car
 * Owner, before expenses.
 *
 * The rules restate the income terms of computeCarMonthSplits (backend
 * incomeExpenseService-raw-sql.ts) and agree with the gold share notes
 * (incomeShareNotes.ts):
 *   - Trip income: what is left of "Income Car Rentals - Turo" after the rows
 *     carved out of it, split by the month's Car Management / Car Owner %.
 *   - Carved-out rows, Guest Cancellation, Gas Reimbursed and Charging: the
 *     fixed share for the year and the month's 50/50 or 70/30 mode.
 *
 * Expenses, the negative-balance carry-over and the $0 floor are NOT applied
 * here; they are what turns these income totals into the Car Management Split
 * and Car Owner Split rows.
 */

export type DistributionField =
  | "tripIncome"
  | "deliveryIncome"
  | "electricPrepaidIncome"
  | "smokingFines"
  | "gasPrepaidIncome"
  | "gasPrepaidOwnerIncome"
  | "skiRacksIncome"
  | "milesIncome"
  | "childSeatIncome"
  | "coolersIncome"
  | "insuranceWreckIncome"
  | "otherIncome"
  | "guestCancellationIncome"
  | "otherCreditIncome"
  | "gasReimbursementIncome"
  | "onTripChargingIncome"
  | "postTripChargingIncome";

/** Same labels and order as the INCOME & EXPENSES section. */
export const DISTRIBUTION_ROWS: { field: DistributionField; label: string }[] = [
  { field: "tripIncome", label: "Income Car Rentals - Turo (Trip Income)" },
  // A–Z under Trip Income, as on the I&E page (2026-11-26).
  { field: "childSeatIncome", label: "Income Car Seats" },
  { field: "coolersIncome", label: "Income Coolers/Camp Chairs" },
  { field: "deliveryIncome", label: "Income Delivery" },
  { field: "electricPrepaidIncome", label: "Income Electric Prepaid" },
  { field: "gasPrepaidIncome", label: "Income Gas Prepaid" },
  { field: "gasPrepaidOwnerIncome", label: "Income Gas Prepaid (Owner Share)" },
  { field: "guestCancellationIncome", label: "Income Guest Cancellation" },
  { field: "milesIncome", label: "Income Miles" },
  { field: "otherCreditIncome", label: "Income Other Credit" },
  { field: "otherIncome", label: "Income Other Turo" },
  { field: "skiRacksIncome", label: "Income Ski Racks" },
  { field: "smokingFines", label: "Income Smoking Fines" },
  { field: "insuranceWreckIncome", label: "Income Turo Claims & Insurance Payments" },
  // Reimbursed Income group, after the A–Z rows (Cathy, 2026-11-26).
  { field: "gasReimbursementIncome", label: "Income Gas Reimbursed" },
  { field: "onTripChargingIncome", label: "Income EV On-Trip Charging Reimbursed" },
  { field: "postTripChargingIncome", label: "Income EV Post-Trip Charging Reimbursed" },
];

/** Rows carved out of "Income Car Rentals - Turo" before the trip split. */
const CARVED_OUT: Exclude<DistributionField, "tripIncome" | "otherCreditIncome" | "gasReimbursementIncome" | "onTripChargingIncome" | "postTripChargingIncome">[] = [
  "deliveryIncome",
  "electricPrepaidIncome",
  "smokingFines",
  "gasPrepaidIncome",
  "gasPrepaidOwnerIncome",
  "skiRacksIncome",
  "milesIncome",
  "childSeatIncome",
  "coolersIncome",
  "insuranceWreckIncome",
  "otherIncome",
  // Carved out of Rental Income like Miles Income (Cathy, 2026-11-26).
  "guestCancellationIncome",
];

export interface DistributionMonthInput {
  year: number;
  /** The month's formula mode; unset months are 50, as in the split formula. */
  mode: 50 | 70;
  /** Car Management % for the month, 0–100. */
  mgmtPercent: number;
  /** Car Owner % for the month, 0–100. */
  ownerPercent: number;
  skiRacksOwner: "GLA" | "CAR_OWNER";
  /** Each income row as shown in INCOME & EXPENSES (manual + approved form). */
  values: Partial<Record<Exclude<DistributionField, "tripIncome"> | "rentalIncome", number>>;
}

export interface DistributionCell {
  /** The income being divided (for the trip row: after carve-outs). */
  amount: number;
  mgmtPercent: number;
  ownerPercent: number;
  mgmt: number;
  owner: number;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** [Car Management %, Car Owner %] for a row, or "pool" for the month's split %. */
export function shareOf(
  field: DistributionField,
  year: number,
  mode: 50 | 70,
  skiRacksOwner: "GLA" | "CAR_OWNER",
): [number, number] | "pool" {
  if (field === "tripIncome") return "pool";
  if (field === "guestCancellationIncome" || field === "otherCreditIncome" || field === "milesIncome" || field === "gasPrepaidOwnerIncome") return [0, 100];
  if (field === "gasReimbursementIncome" || field === "onTripChargingIncome" || field === "postTripChargingIncome") return [100, 0];
  if (year >= 2026) {
    if (field === "smokingFines") return [90, 10];
    if (field === "skiRacksIncome") return skiRacksOwner === "CAR_OWNER" ? [0, 100] : [100, 0];
    return [100, 0];
  }
  // 2019–2025
  if (mode === 70) {
    if (field === "smokingFines") return [90, 10];
    return [100, 0];
  }
  if (field === "smokingFines") return [100, 0];
  if (
    field === "skiRacksIncome" ||
    field === "childSeatIncome" ||
    field === "coolersIncome" ||
    field === "insuranceWreckIncome" ||
    field === "otherIncome"
  ) {
    return "pool";
  }
  return [100, 0];
}

/**
 * One month's distribution, keyed by row. Null for years before 2019, which
 * have no split formula.
 */
export function distributeIncomeMonth(
  input: DistributionMonthInput,
): Record<DistributionField, DistributionCell> | null {
  const { year, mode, mgmtPercent, ownerPercent, skiRacksOwner, values } = input;
  if (!(year >= 2019)) return null;
  const v = (f: keyof DistributionMonthInput["values"]) => Number(values[f]) || 0;
  const carvedOut = CARVED_OUT.reduce((sum, f) => sum + v(f), 0);

  const out = {} as Record<DistributionField, DistributionCell>;
  for (const { field } of DISTRIBUTION_ROWS) {
    const amount = round2(field === "tripIncome" ? v("rentalIncome") - carvedOut : v(field));
    const share = shareOf(field, year, mode, skiRacksOwner);
    const [m, o] = share === "pool" ? [mgmtPercent, ownerPercent] : share;
    const mgmt = round2((amount * m) / 100);
    // When the two shares make 100%, give the owner the exact remainder so
    // the two parts always add back to the row's amount to the cent.
    const owner = Math.abs(m + o - 100) < 1e-9 ? round2(amount - mgmt) : round2((amount * o) / 100);
    out[field] = { amount, mgmtPercent: m, ownerPercent: o, mgmt, owner };
  }
  return out;
}

/** "50%" when every month agrees, otherwise "% by month". */
export function percentNote(percents: number[]): string {
  const distinct = Array.from(new Set(percents.map((p) => round2(p))));
  if (distinct.length === 1) return `${distinct[0]}%`;
  return "% by month";
}

/**
 * The % note for one side of a row on views that add up many cars (All Cars,
 * Totals): the fixed % when every car gets the same share that year, "each
 * car's %" when it follows each car's split, "varies by car" when it depends
 * on the car's mode or ski rack owner. Null when that side never gets a share
 * of the row in that year, so the row is left out.
 */
export function fleetShareNote(field: DistributionField, year: number, side: "mgmt" | "owner"): string | null {
  if (!(year >= 2019)) return null;
  const notes = new Set<string>();
  let anyShare = false;
  for (const mode of [50, 70] as const) {
    for (const ski of ["GLA", "CAR_OWNER"] as const) {
      const share = shareOf(field, year, mode, ski);
      if (share === "pool") {
        anyShare = true;
        notes.add("each car's %");
      } else {
        const p = side === "mgmt" ? share[0] : share[1];
        if (p > 0) anyShare = true;
        notes.add(`${p}%`);
      }
    }
  }
  if (!anyShare) return null;
  return notes.size === 1 ? [...notes][0] : "varies by car";
}
