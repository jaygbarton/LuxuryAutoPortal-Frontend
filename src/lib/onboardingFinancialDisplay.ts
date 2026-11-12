/** Display the whole submitted amount; never silently truncate a formatted string. */
export function formatOnboardingFinancial(value: unknown, kind: 'money' | 'percent' = 'money'): string {
  const original = String(value ?? '').trim();
  if (!original) return 'Not provided';
  const numeric = kind === 'money'
    ? original.replace(/^(?:USD\s*\$?|\$)\s*/i, '')
    : original.replace(/\s*%$/, '');
  if (!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/.test(numeric)) return original;
  const amount = Number(numeric.replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER) return original;
  return kind === 'money'
    ? amount.toLocaleString('en-US', {style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2})
    : `${numeric.replace(/,/g, '')}%`;
}
