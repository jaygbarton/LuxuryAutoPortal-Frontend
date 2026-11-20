export function rentalMetric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export function rentalMetricTotal(values: unknown[]): number | null {
  const known = values.map(rentalMetric);
  return known.some(value => value === null) ? null : known.reduce<number>((sum,value)=>sum+value!,0);
}
export function rentalMetricText(value: unknown): string { return rentalMetric(value)?.toLocaleString() ?? '—'; }
/**
 * Yearly total of the months whose figure is known, plus the 0-based indexes
 * of the months that are not (no verified Turo activity, or a record needing
 * review). The total is null only when no month is known. Callers must mark a
 * total with missing months as partial so the gap stays visible.
 */
export function rentalMetricKnownTotal(values: unknown[]): { total: number | null; missing: number[] } {
  const known = values.map(rentalMetric);
  const missing = known.flatMap((value, index) => (value === null ? [index] : []));
  if (missing.length === known.length) return { total: null, missing };
  return { total: known.reduce<number>((sum, value) => sum + (value ?? 0), 0), missing };
}
/**
 * Yearly amount per trip over only the months whose trip count is known, so a
 * month with income but unknown trips does not inflate the average. Null when
 * no month's trip count is known.
 */
export function rentalAveragePerKnownTrip(amounts: number[], trips: unknown[]): number | null {
  let amount = 0;
  let count = 0;
  let anyKnown = false;
  trips.forEach((value, index) => {
    const known = rentalMetric(value);
    if (known === null) return;
    anyKnown = true;
    amount += amounts[index] ?? 0;
    count += known;
  });
  if (!anyKnown) return null;
  return count > 0 ? amount / count : 0;
}
