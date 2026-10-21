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
