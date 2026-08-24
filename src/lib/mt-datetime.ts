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
  const dt = mtLocalInputToUtcDate(local);
  if (!dt) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())} ` +
    `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}`
  );
}

/**
 * Same conversion as `mtLocalInputToUtcDbString`, but returns a full ISO-8601
 * string with the `Z` suffix (`2026-08-24T15:00:00.000Z`).
 *
 * Use this for anything sent over the wire as JSON. The `Z` is load-bearing:
 * the backend parses these with `new Date(value)`, and a string without an
 * explicit offset — `"2026-08-24 15:00:00"` or a bare `...T15:00:00` — is
 * interpreted in the *server's* timezone, so the same payload would mean
 * different instants depending on where it was parsed. Only `Z` pins it.
 */
export function mtLocalInputToUtcIso(local: string): string | null {
  return mtLocalInputToUtcDate(local)?.toISOString() ?? null;
}

/**
 * Midnight Mountain Time on a `YYYY-MM-DD` day, as a UTC ISO string.
 *
 * For date-only form fields. `new Date("2026-08-24").toISOString()` treats the
 * value as UTC midnight, which is 6-7 hours before the MT day actually starts —
 * enough to file the record under the previous day.
 */
export function mtDayStartToUtcIso(dayKey: string): string | null {
  if (!dayKey) return null;
  return mtLocalInputToUtcIso(`${dayKey.slice(0, 10)}T00:00`);
}

/**
 * Shared core: a `YYYY-MM-DDTHH:mm[:ss]` wall time read as Mountain Time,
 * returned as the UTC instant it denotes. Kept in one place so the DST
 * reverse-engineering below only ever has one implementation to get right.
 */
function mtLocalInputToUtcDate(local: string): Date | null {
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
  return new Date(utc);
}

/**
 * The Mountain-Time calendar day a UTC instant falls on, as `YYYY-MM-DD`.
 *
 * `new Date(iso)` followed by `setHours(0,0,0,0)` truncates in the *browser's*
 * timezone, which is only the same as Mountain Time for viewers who happen to
 * sit in it. A booking ending 2026-08-31 04:00 UTC is Aug 30, 10:00 PM in Salt
 * Lake City, but bucketed east of Denver it lands on Aug 31 — which is how the
 * trips calendar drew a bar one column past the end date its own detail panel
 * displayed. Everything that decides "which day column is this?" must go
 * through here so the grid and the panel can never disagree.
 */
export function mtDayKey(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  // en-CA formats as YYYY-MM-DD, so no part juggling is needed.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Today's date in Mountain Time as `YYYY-MM-DD`. */
export function mtTodayKey(): string {
  return mtDayKey(new Date());
}

/**
 * A `YYYY-MM-DD` day key as a *timezone-neutral* Date pinned to UTC midnight.
 *
 * Day-grid arithmetic (indexing columns, stepping a week) must not run on
 * local-midnight Dates: across a DST boundary two local midnights are 23 or 25
 * hours apart, so a fixed 86.4e6 division drifts by a whole column. UTC
 * midnights are always exactly a day apart, making the index math exact.
 */
export function dayKeyToUtcDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** `YYYY-MM-DD` for a UTC-pinned day Date produced by dayKeyToUtcDate. */
export function utcDateToDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Add whole days to a UTC-pinned day Date. */
export function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
