/**
 * useFormAmounts
 * -------------------------------------------------------------
 * Aggregates APPROVED expense form submissions for a given car + year
 * into a per-cell lookup so we can show the "Form Amount" side-by-side
 * with the manually-entered I&E value.
 *
 * Key rules (mirrors the product spec):
 *  - Only approved submissions contribute to the form amount
 *    (declined/pending/deleted do not — they're simply absent from the
 *    `/approved-by-car` response, so removing approval automatically
 *    deletes the form contribution).
 *  - Multiple approved submissions for the same (category, field, month)
 *    sum together.
 *  - This hook is read-only; the I&E "manual amount" still lives in
 *    `income_expense` DB rows and is unchanged.
 *
 * The map key is `${category}-${field}-${month}` so it can be looked up
 * cheaply from <EditableCell> and each edit modal without passing data
 * around explicitly.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";

export interface FormAmountEntry {
  amount: number;
  submissionIds: number[];
}

export type FormAmountsMap = Record<string, FormAmountEntry>;

export function formAmountKey(category: string, field: string, month: number) {
  return `${category}-${field}-${month}`;
}

export function useFormAmounts(carId: number | null | undefined, year: string) {
  const enabled = !!carId && !!year;

  const { data, isLoading } = useQuery({
    // Query key is structured under the "/api/expense-form-submissions"
    // prefix so that the broad `invalidateQueries(["/api/expense-form-submissions"])`
    // call from the approve/decline/delete handlers in
    // ExpenseFormApprovalDashboard cascades into this query too, which makes
    // the I&E totals refresh automatically when an approval changes.
    // NOTE: Same queryKey used by FormSubmissionsAndReceipts + FormReceiptInModal
    // so the cache is shared and all three views stay in sync.
    queryKey: ["/api/expense-form-submissions", "approved-by-car", carId ?? 0, year],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/expense-form-submissions/approved-by-car?carId=${carId}&year=${year}`),
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch approved submissions");
      return res.json();
    },
    enabled,
  });

  const byCell = useMemo<FormAmountsMap>(() => {
    const map: FormAmountsMap = {};
    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    for (const sub of list) {
      if (!sub?.category || !sub?.field || sub?.month == null) continue;
      const amount = Number(sub.amount);
      if (!isFinite(amount)) continue;
      const key = formAmountKey(String(sub.category), String(sub.field), Number(sub.month));
      const entry = map[key] ?? { amount: 0, submissionIds: [] };
      entry.amount += amount;
      if (sub.id != null) entry.submissionIds.push(Number(sub.id));
      map[key] = entry;
    }
    return map;
  }, [data]);

  const getFormAmount = (category: string, field: string, month: number): number => {
    return byCell[formAmountKey(category, field, month)]?.amount ?? 0;
  };

  // Sum of form amounts across every field within a single (category, month).
  // Used by IncomeExpenseTable to roll form contributions into the category
  // subtotals (Total COGS, Total Direct Delivery, etc.) so the full cascade
  // (Car Management Split, Net Income, ...) stays consistent with the per-cell
  // totals shown in <EditableCell>.
  const getCategoryMonthFormTotal = (category: string, month: number): number => {
    let sum = 0;
    const suffix = `-${month}`;
    const prefix = `${category}-`;
    for (const [key, entry] of Object.entries(byCell)) {
      if (key.startsWith(prefix) && key.endsWith(suffix)) {
        sum += entry.amount;
      }
    }
    return sum;
  };

  return {
    formAmounts: byCell,
    getFormAmount,
    getCategoryMonthFormTotal,
    isLoading,
  };
}
