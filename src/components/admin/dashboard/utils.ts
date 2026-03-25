// Utility helpers for the admin dashboard

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatShortMonth(month: number): string {
  return MONTH_LABELS[(month - 1) % 12];
}

export function formatFullMonth(month: number): string {
  return MONTH_FULL[(month - 1) % 12];
}

export function sumField<T>(arr: T[], field: keyof T): number {
  return arr.reduce((sum, item) => {
    const val = item[field];
    return sum + (typeof val === "number" ? val : 0);
  }, 0);
}
