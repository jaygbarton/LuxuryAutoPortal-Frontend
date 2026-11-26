/**
 * Car Owner Split formula — single source of truth.
 *
 * Ported from IncomeExpenseTable.tsx's `calculateCarOwnerSplit`, the
 * spec-correct implementation (its category totals include
 * `getCategoryMonthFormTotal`, per the Form/Manual separation spec —
 * see IncomeExpenseTable.tsx:672-676). AddEditPaymentModal.tsx had an
 * independent copy whose totals never included the form-submission
 * contribution, silently undercounting COGS/Direct Delivery/Parking Fee
 * & Labor whenever an approved expense-form submission existed for that
 * car/month.
 *
 * All inputs are explicit parameters — this function fetches nothing and
 * holds no state, so both call sites must compute the same input shape
 * (including `totalCogs`/`totalDirectDelivery`/`totalParkingFeeLabor` via
 * their own category-total helpers, which DO need to include
 * getCategoryMonthFormTotal) and `negativeBalanceCarryOver` via their own
 * (still-separate) recursive carry-over calculation.
 */

export type OwnerSplitMode = 50 | 70;

export interface OwnerSplitInputs {
  year: number;
  mode: OwnerSplitMode;
  ownerPercent: number; // decimal, e.g. 0.5 for 50%
  skiRacksOwner: "GLA" | "CAR_OWNER";
  rentalIncome: number;
  deliveryIncome: number;
  electricPrepaidIncome: number;
  smokingFines: number;
  gasPrepaidIncome: number;
  skiRacksIncome: number;
  /** Miles Income PLUS Gas Prepaid Income (100% Owner Share, 2026+): both are
   *  carved out of rentalIncome and paid wholly to the owner, so callers pass
   *  their sum here (as computeCarMonthSplits does on the backend). */
  milesIncome: number;
  childSeatIncome: number;
  coolersIncome: number;
  insuranceWreckIncome: number;
  otherIncome: number;
  /** Income Guest Cancellation (manual + approved forms). Works like Miles
   *  Income (Cathy, 2026-11-26): carved out of rentalIncome — subtracted from
   *  the rental pool in every branch — and added 100% to the owner. Mirrors
   *  computeCarMonthSplits on the backend. */
  guestCancellationIncome: number;
  /** Income Other Credit (manual + approved forms): 100% owner and NOT part
   *  of rentalIncome, so it is added on top in every branch and never
   *  subtracted from the rental pool. Optional; defaults to 0. */
  otherCreditIncome?: number;
  negativeBalanceCarryOver: number;
  totalDirectDelivery: number;
  totalCogs: number;
  /** Only used in 70:30-mode months; ignored in 50:50-mode months. */
  totalParkingFeeLabor: number;
}

/**
 * Computes the Car Owner Split amount for one car/month.
 * Mirrors IncomeExpenseTable.tsx's `calculateCarOwnerSplit` exactly,
 * branch for branch (year >= 2026 vs 2019-2025, mode 50 vs 70, and —
 * for 2026+ mode 50 only — the three ski-racks-income/owner branches).
 */
export function computeOwnerSplit(inputs: OwnerSplitInputs): number {
  const {
    year,
    mode,
    ownerPercent,
    skiRacksOwner,
    rentalIncome: rentalIncomeInput,
    deliveryIncome,
    electricPrepaidIncome,
    smokingFines,
    gasPrepaidIncome,
    skiRacksIncome,
    milesIncome,
    childSeatIncome,
    coolersIncome,
    insuranceWreckIncome,
    otherIncome,
    guestCancellationIncome,
    otherCreditIncome = 0,
    negativeBalanceCarryOver,
    totalDirectDelivery,
    totalCogs,
    totalParkingFeeLabor,
  } = inputs;

  // The rental pool every part2 below splits: Guest Cancellation is carved
  // out of Rental Income like Miles Income.
  const rentalIncome = rentalIncomeInput - guestCancellationIncome;
  // Paid 100% to the owner on top of the formula.
  const ownerAddOnIncome = guestCancellationIncome + otherCreditIncome;

  const isYear2026OrLater = year >= 2026;
  const isYear2019To2025 = year >= 2019 && year <= 2025;

  if (isYear2026OrLater) {
    if (mode === 50) {
      // A) No ski racks income
      if (skiRacksIncome === 0) {
        const part1 =
          milesIncome + (smokingFines * 0.1 + skiRacksIncome * ownerPercent);
        const part2 =
          (rentalIncome +
            negativeBalanceCarryOver -
            deliveryIncome -
            electricPrepaidIncome -
            gasPrepaidIncome -
            smokingFines -
            milesIncome -
            skiRacksIncome -
            childSeatIncome -
            coolersIncome -
            insuranceWreckIncome -
            otherIncome -
            totalDirectDelivery -
            totalCogs) *
          ownerPercent;
        const calculation = part1 + part2 + ownerAddOnIncome;
        return calculation >= 0 ? calculation : 0;
      }
      // B) If Car Management (GLA) is ski racks owner
      else if (skiRacksOwner === "GLA") {
        const part1 = milesIncome + smokingFines * 0.1;
        const part2 =
          (rentalIncome +
            negativeBalanceCarryOver -
            deliveryIncome -
            electricPrepaidIncome -
            gasPrepaidIncome -
            smokingFines -
            milesIncome -
            skiRacksIncome -
            childSeatIncome -
            coolersIncome -
            insuranceWreckIncome -
            otherIncome -
            totalDirectDelivery -
            totalCogs) *
          ownerPercent;
        const calculation = part1 + part2 + ownerAddOnIncome;
        return calculation >= 0 ? calculation : 0;
      }
      // C) If Car Owner is ski racks owner
      else {
        const part1 = milesIncome + skiRacksIncome + smokingFines * 0.1;
        const part2 =
          (rentalIncome +
            negativeBalanceCarryOver -
            deliveryIncome -
            electricPrepaidIncome -
            gasPrepaidIncome -
            smokingFines -
            milesIncome -
            skiRacksIncome -
            childSeatIncome -
            coolersIncome -
            insuranceWreckIncome -
            otherIncome -
            totalDirectDelivery -
            totalCogs) *
          ownerPercent;
        const calculation = part1 + part2 + ownerAddOnIncome;
        return calculation >= 0 ? calculation : 0;
      }
    }
    // 70:30 mode
    else {
      // A) No ski racks income
      if (skiRacksIncome === 0) {
        const part1 =
          skiRacksIncome * ownerPercent +
          milesIncome -
          totalDirectDelivery -
          totalCogs -
          totalParkingFeeLabor +
          negativeBalanceCarryOver +
          smokingFines * 0.1;
        const part2 =
          (rentalIncome -
            deliveryIncome -
            electricPrepaidIncome -
            gasPrepaidIncome -
            milesIncome -
            skiRacksIncome -
            childSeatIncome -
            coolersIncome -
            insuranceWreckIncome -
            smokingFines -
            otherIncome) *
          ownerPercent;
        const calculation = part1 + part2 + ownerAddOnIncome;
        return calculation >= 0 ? calculation : 0;
      }
      // B) If Car Management (GLA) is ski racks owner
      else if (skiRacksOwner === "GLA") {
        const part1 =
          milesIncome -
          totalDirectDelivery -
          totalCogs -
          totalParkingFeeLabor +
          negativeBalanceCarryOver +
          smokingFines * 0.1;
        const part2 =
          (rentalIncome -
            deliveryIncome -
            electricPrepaidIncome -
            gasPrepaidIncome -
            milesIncome -
            skiRacksIncome -
            childSeatIncome -
            coolersIncome -
            insuranceWreckIncome -
            smokingFines -
            otherIncome) *
          ownerPercent;
        const calculation = part1 + part2 + ownerAddOnIncome;
        return calculation >= 0 ? calculation : 0;
      }
      // C) If Car Owner is ski racks owner
      else {
        const part1 =
          skiRacksIncome +
          milesIncome -
          totalDirectDelivery -
          totalCogs -
          totalParkingFeeLabor +
          negativeBalanceCarryOver +
          smokingFines * 0.1;
        const part2 =
          (rentalIncome -
            deliveryIncome -
            electricPrepaidIncome -
            gasPrepaidIncome -
            milesIncome -
            skiRacksIncome -
            childSeatIncome -
            coolersIncome -
            insuranceWreckIncome -
            smokingFines -
            otherIncome) *
          ownerPercent;
        const calculation = part1 + part2 + ownerAddOnIncome;
        return calculation >= 0 ? calculation : 0;
      }
    }
  }
  // Year 2019-2025
  else if (isYear2019To2025) {
    if (mode === 50) {
      const part1 =
        milesIncome +
        (skiRacksIncome * ownerPercent +
          childSeatIncome * ownerPercent +
          coolersIncome * ownerPercent +
          insuranceWreckIncome * ownerPercent +
          otherIncome * ownerPercent);
      const part2 =
        (rentalIncome +
          negativeBalanceCarryOver -
          deliveryIncome -
          electricPrepaidIncome -
          gasPrepaidIncome -
          smokingFines -
          milesIncome -
          skiRacksIncome -
          childSeatIncome -
          coolersIncome -
          insuranceWreckIncome -
          otherIncome -
          totalDirectDelivery -
          totalCogs) *
        ownerPercent;
      const calculation = part1 + part2 + ownerAddOnIncome;
      return calculation >= 0 ? calculation : 0;
    }
    // 70:30 mode
    else {
      const part1 =
        milesIncome -
        totalDirectDelivery -
        totalCogs -
        totalParkingFeeLabor +
        negativeBalanceCarryOver +
        smokingFines * 0.1;
      const part2 =
        (rentalIncome -
          deliveryIncome -
          electricPrepaidIncome -
          gasPrepaidIncome -
          milesIncome -
          skiRacksIncome -
          childSeatIncome -
          coolersIncome -
          insuranceWreckIncome -
          smokingFines -
          otherIncome) *
        ownerPercent;
      const calculation = part1 + part2 + ownerAddOnIncome;
      return calculation >= 0 ? calculation : 0;
    }
  }

  // Default (should not reach here, but return 0 for safety)
  return 0;
}
