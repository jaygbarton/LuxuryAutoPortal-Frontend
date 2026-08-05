type DateInput = string | number | Date | null | undefined;

function parseDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatMonthDayYear(value: DateInput, fallback = "—"): string {
  if (typeof value === "string") {
    const plainDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (plainDate) {
      return `${plainDate[2]}/${plainDate[3]}/${plainDate[1]}`;
    }
  }

  const date = parseDate(value);
  if (!date) return fallback;
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
}

export function formatMonthDayYearTime(value: DateInput, fallback = "—"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  return `${formatMonthDayYear(date, fallback)} ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function formatMonthYear(value: DateInput, fallback = "—"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  return `${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
