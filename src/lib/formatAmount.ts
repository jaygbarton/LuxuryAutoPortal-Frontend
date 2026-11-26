/**
 * Money as shown on Income & Expenses, Earnings and their pop-ups: thousands
 * separators and two decimals, e.g. 1238313.37 -> "1,238,313.37" (Cathy,
 * 2026-11-26). The caller adds "$", sign or parentheses. Not for CSV export,
 * where a comma would split the column.
 */
export function formatAmount(value: number | null | undefined): string {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
