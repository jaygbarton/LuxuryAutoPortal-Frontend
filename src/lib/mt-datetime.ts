// Helpers for round-tripping `<input type="datetime-local">` values through a
// MySQL DATETIME column that the backend pool reads with `timezone: "Z"`.
// The convention everywhere else in the app (time sheets, etc.) is to display
// in Mountain Time — these helpers keep modal date inputs consistent with that.

/** Convert a UTC ISO string (or any value `new Date()` accepts) to the
 *  `YYYY-MM-DDTHH:mm` string a `datetime-local` input expects, projected into
 *  Mountain Time. Returns "" for nullish input or an unparseable date. */
export function toMtLocalInput(iso: string | undefined | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .reduce<Record<string, string>>((a, p) => {
        if (p.type !== "literal") a[p.type] = p.value;
        return a;
      }, {});
    const h = parts.hour === "24" ? "00" : parts.hour;
    return `${parts.year}-${parts.month}-${parts.day}T${h}:${parts.minute}`;
  } catch {
    return "";
  }
}

/** Interpret a `datetime-local` value as Mountain Time and return a
 *  `YYYY-MM-DD HH:MM:SS` UTC string that mysql2 will store unchanged in a
 *  DATETIME column. Returns null for empty / malformed input. */
export function mtLocalInputToUtcDbString(local: string): string | null {
  if (!local) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const naiveUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? "0"),
    0,
  );
  // Reverse-engineer the MT offset at this wall time: pretend our components
  // are UTC, see what they look like in MT, take the gap. One iteration is
  // exact except across the spring/fall DST hour — a second iteration settles
  // that edge case.
  const offset = (t: number): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(t))
      .reduce<Record<string, string>>((a, p) => {
        if (p.type !== "literal") a[p.type] = p.value;
        return a;
      }, {});
    const hour = parts.hour === "24" ? "00" : parts.hour;
    const asUtcOfWall = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return asUtcOfWall - t;
  };
  let utc = naiveUtc - offset(naiveUtc);
  utc = naiveUtc - offset(utc);
  const dt = new Date(utc);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())} ` +
    `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}`
  );
}
