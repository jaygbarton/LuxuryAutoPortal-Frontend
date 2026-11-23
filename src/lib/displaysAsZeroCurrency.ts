/** True when a currency amount would display as $0.00 (blank/invalid counts as zero). */
export function displaysAsZeroCurrency(value: unknown): boolean {
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  return !Number.isFinite(num) || Math.round(Math.abs(num) * 100) === 0;
}
