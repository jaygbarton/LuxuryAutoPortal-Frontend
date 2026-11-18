import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildApiUrl } from "@/lib/queryClient";
import { daysBetween, dayStatus, formatWallTime, overlappingTrip, type BusyWindow } from "@/lib/blockOffAvailability";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (day: string) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (day: string, n: number) => { const d = parseDay(day); d.setDate(d.getDate() + n); return ymd(d); };

/** Turo-style explainer: the block runs as one duration across the chosen days. */
function HowItWorks({ startDay, endDay, start, end }: { startDay: string; endDay: string; start: string; end: string }) {
  const days = startDay && endDay ? daysBetween(startDay, endDay) : startDay ? [startDay] : [];
  const shown = days.length > 7 ? [...days.slice(0, 3), "…", ...days.slice(-3)] : days;
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950" data-block-off-how-it-works>
      <p className="font-semibold">How it works</p>
      <p className="mt-1">
        {!startDay ? "Tap your pick-up day, then your drop-off day. You'll block one duration across the selected days."
          : !endDay ? "Now tap your drop-off day."
          : `You'll block the car from ${formatWallTime(start)} to ${formatWallTime(end)}. Tap a new day to start over.`}
      </p>
      {shown.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-md border border-blue-200 bg-white px-3 py-2" aria-hidden="true">
          <div className="flex">
            {shown.map((d, i) => <div key={`${d}-${i}`} className="flex flex-1 justify-center text-[11px] text-blue-900/70">{d === "…" ? "…" : formatWallTime(`${d} 00:00`).split(",")[0]}</div>)}
          </div>
          <div className="relative mt-2 h-3">
            <div className={`absolute top-1/2 h-0.5 -translate-y-1/2 bg-blue-900/50 ${shown.length > 1 ? "left-[8%] right-[8%]" : "left-1/2 right-1/2"}`} />
            <span className="absolute left-[8%] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-900" />
            {shown.length > 1 && endDay && <span className="absolute right-[8%] top-1/2 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-900" />}
          </div>
        </div>
      )}
    </div>
  );
}

interface Availability { turoTrips: BusyWindow[]; blockOffs: Array<BusyWindow & { id: number }> }

/**
 * Hotel-style block-off dates: tap the start day, then the end day. Days a
 * Turo trip fully covers are crossed out and cannot be chosen; days a trip
 * starts or ends on stay selectable and the chosen times are checked. The
 * availability is read live, so a cancelled or changed trip updates it.
 */
export function BlockOffDatePicker({ carId, start, end, onChange, allowPast = false, excludeBlockOffId }: {
  carId: string;
  start: string; // "YYYY-MM-DDTHH:MM" or ""
  end: string;
  onChange: (start: string, end: string) => void;
  allowPast?: boolean;
  excludeBlockOffId?: number;
}) {
  const today = ymd(new Date());
  const from = addDays(today, -60), to = addDays(today, 400);
  const [notice, setNotice] = useState("");
  const availability = useQuery<Availability>({
    queryKey: ["/api/car-block-off/availability", carId, from, to],
    enabled: !!carId,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/car-block-off/availability?${new URLSearchParams({ carId, from, to })}`), { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || "Availability could not be loaded.");
      return body.data;
    },
  });
  const trips = availability.data?.turoTrips ?? [];
  const blocks = useMemo(() => (availability.data?.blockOffs ?? []).filter((b) => b.id !== excludeBlockOffId), [availability.data, excludeBlockOffId]);

  const startDay = start.slice(0, 10), endDay = end.slice(0, 10);
  const startTime = start.slice(11, 16) || "10:00", endTime = end.slice(11, 16) || "10:00";
  const statusOf = (day: string) => dayStatus(day, trips, blocks);
  const unavailable = (day: string) => ["turo_full", "blocked"].includes(statusOf(day)) || (!allowPast && day < today);

  const selected: DateRange | undefined = startDay ? { from: parseDay(startDay), to: endDay ? parseDay(endDay) : undefined } : undefined;

  const pick = (range: DateRange | undefined, clicked: Date) => {
    setNotice("");
    const day = ymd(clicked);
    // A first tap, or a tap after a full range, starts a new selection.
    if (!startDay || endDay || day < startDay) { onChange(`${day}T${startTime}`, ""); return; }
    const blocked = daysBetween(startDay, day).find(unavailable);
    if (blocked) {
      setNotice(statusOf(blocked) === "blocked"
        ? "Your dates can't include days that are already blocked off. Pick a new start day."
        : "Your dates can't include a booked trip. Pick a new start day.");
      onChange(`${day}T${startTime}`, "");
      return;
    }
    void range;
    onChange(`${startDay}T${startTime}`, `${day}T${endTime}`);
  };

  const conflict = startDay && endDay ? overlappingTrip(`${startDay} ${startTime}`, `${endDay} ${endTime}`, trips) : null;
  const tripsInView = trips.filter((t) => (t.end ?? "9999") >= `${today} 00:00`).slice(0, 6);

  if (!carId) return <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Choose a car to see its available dates.</p>;

  return (
    <div className="space-y-3" data-block-off-date-picker>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Calendar
          mode="range"
          numberOfMonths={1}
          selected={selected}
          onSelect={(range, day) => pick(range, day)}
          defaultMonth={startDay ? parseDay(startDay) : new Date()}
          fromDate={allowPast ? undefined : new Date()}
          disabled={(date) => unavailable(ymd(date))}
          modifiers={{
            turo: (date) => statusOf(ymd(date)) === "turo_full",
            turoPartial: (date) => statusOf(ymd(date)) === "turo_partial",
            blocked: (date) => statusOf(ymd(date)) === "blocked",
          }}
          modifiersClassNames={{
            turo: "!opacity-100 bg-amber-100 text-amber-900/70 line-through",
            turoPartial: "ring-1 ring-inset ring-amber-400",
            blocked: "!opacity-100 bg-slate-200 text-slate-500 line-through",
          }}
          className="mx-auto w-fit"
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Calendar legend">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-amber-100" /> Unavailable: booked trip</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm ring-1 ring-amber-400" /> A booked trip starts or ends that day</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-slate-200" /> Already blocked off</span>
      </div>

      {availability.isLoading && <p role="status" className="text-xs text-muted-foreground">Loading booked trips…</p>}
      {availability.isError && <p role="alert" className="text-xs text-red-700">Booked trips couldn't be loaded, so unavailable days aren't shown. <button type="button" className="underline" onClick={() => void availability.refetch()}>Retry</button></p>}
      {tripsInView.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-900">
          {tripsInView.map((t) => <li key={`${t.start}|${t.end}`}>Unavailable ({t.kind === "direct" ? "direct rental" : "Turo trip"}): {formatWallTime(t.start)} to {t.end ? formatWallTime(t.end) : "open"}</li>)}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm text-muted-foreground">Pick up {startDay ? `· ${formatWallTime(`${startDay} 00:00`).split(",")[0]}` : ""}</Label>
          <Input type="time" aria-label="Pick up time" value={startTime} disabled={!startDay}
            onChange={(e) => onChange(`${startDay}T${e.target.value || "10:00"}`, end)} className="bg-card" />
        </div>
        <div>
          <Label className="text-sm text-muted-foreground">Drop off {endDay ? `· ${formatWallTime(`${endDay} 00:00`).split(",")[0]}` : ""}</Label>
          <Input type="time" aria-label="Drop off time" value={endTime} disabled={!endDay}
            onChange={(e) => onChange(start, `${endDay}T${e.target.value || "10:00"}`)} className="bg-card" />
        </div>
      </div>
      <HowItWorks startDay={startDay} endDay={endDay} start={`${startDay} ${startTime}`} end={`${endDay} ${endTime}`} />
      {notice && <p role="alert" className="text-sm text-red-700">{notice}</p>}
      {conflict && <p role="alert" className="text-sm text-red-700">These times overlap a {conflict.kind === "direct" ? "direct rental" : "Turo trip"} ({formatWallTime(conflict.start)} to {conflict.end ? formatWallTime(conflict.end) : "open"}). Adjust your times or dates.</p>}
    </div>
  );
}
