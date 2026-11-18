/**
 * Day-by-day availability for the owner block-off calendar.
 *
 * Times are local wall-clock strings ("YYYY-MM-DD HH:MM"), the same form the
 * server returns Turo trips and block-offs in and stores block-offs in.
 */
export interface BusyWindow { start: string; end: string | null; /** "direct" for a rental booked on our own website; absent for a Turo trip. */ kind?: "direct" }

export type DayStatus = "free" | "turo_full" | "turo_partial" | "blocked";

const dayStart = (day: string) => `${day} 00:00`;
const nextDay = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * "turo_full": a Turo trip covers the whole day, so it cannot be picked.
 * "turo_partial": a trip starts or ends that day; the day can be picked, and
 * the chosen times are checked against the trip.
 * "blocked": another block-off already covers the whole day.
 */
export function dayStatus(day: string, trips: BusyWindow[], blockOffs: BusyWindow[]): DayStatus {
  const from = dayStart(day), to = dayStart(nextDay(day));
  const covers = (w: BusyWindow) => w.start <= from && (w.end === null || w.end >= to);
  const touches = (w: BusyWindow) => w.start < to && (w.end === null || w.end > from);
  if (trips.some(covers)) return "turo_full";
  if (blockOffs.some(covers)) return "blocked";
  if (trips.some(touches)) return "turo_partial";
  return "free";
}

/** Every day from start to end inclusive ("YYYY-MM-DD"). */
export function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end && days.length < 800; d = nextDay(d)) days.push(d);
  return days;
}

/** The first Turo trip a block-off from start to end would overlap. */
export function overlappingTrip(start: string, end: string, trips: BusyWindow[]): BusyWindow | null {
  const s = start.replace("T", " ").slice(0, 16), e = end.replace("T", " ").slice(0, 16);
  return trips.find((t) => t.start < e && (t.end === null || t.end > s)) ?? null;
}

/** "Nov 18, 10:00 AM" */
export function formatWallTime(value: string): string {
  const [d, t = "00:00"] = value.replace("T", " ").split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = t.split(":").map(Number);
  const month = new Date(Date.UTC(y, m - 1, day)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} ${day}, ${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
