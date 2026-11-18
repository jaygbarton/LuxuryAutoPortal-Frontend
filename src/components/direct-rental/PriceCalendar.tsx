import { useMemo, useState } from "react";
import { DayPicker, type DayContentProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type CalendarDay, fromDay, money, rangeIsOpen, toDay } from "@/lib/directRental";

/**
 * A month calendar for choosing trip dates: tap the pick-up day, then the
 * return day. With `days` it shows each day's price, crosses out days the
 * car is already committed, and outlines days a commitment starts or ends.
 */
export function PriceCalendar({ start, end, onChange, days, months = 1, minDay, maxDay }: {
  start: string; end: string; onChange: (start: string, end: string) => void;
  days?: CalendarDay[]; months?: 1 | 2; minDay: string; maxDay?: string;
}) {
  const [notice, setNotice] = useState("");
  const byDay = useMemo(() => new Map((days ?? []).map(d => [d.day, d])), [days]);
  const blocked = (day: string) => day < minDay || (!!maxDay && day > maxDay) || byDay.get(day)?.status === "full" || byDay.get(day)?.status === "past";

  const pick = (date: Date) => {
    const day = toDay(date);
    setNotice("");
    if (blocked(day)) return;
    if (!start || end || day <= start) { onChange(day, ""); return; }
    if (!rangeIsOpen(start, day, byDay)) { setNotice("Those dates include days this vehicle is already booked. Pick a new start day."); onChange(day, ""); return; }
    onChange(start, day);
  };
  const DayContent = ({ date }: DayContentProps) => {
    const info = byDay.get(toDay(date));
    return (
      <span data-day={toDay(date)} className="flex flex-col items-center leading-tight">
        <span>{date.getDate()}</span>
        {days && <span className="text-[10px] font-normal opacity-80">{info && info.status !== "full" && info.status !== "past" ? money(info.cents, 0) : " "}</span>}
      </span>
    );
  };
  const cell = days ? "h-12 w-10 sm:w-11" : "h-10 w-10";
  return (
    <div data-price-calendar>
      <DayPicker
        mode="range" numberOfMonths={months} showOutsideDays={false}
        selected={start ? { from: fromDay(start), to: end ? fromDay(end) : undefined } : undefined}
        onDayClick={pick}
        defaultMonth={fromDay(start || minDay)} fromDate={fromDay(minDay)} toDate={maxDay ? fromDay(maxDay) : undefined}
        disabled={date => blocked(toDay(date))}
        modifiers={{ booked: date => byDay.get(toDay(date))?.status === "full", edge: date => byDay.get(toDay(date))?.status === "partial" }}
        modifiersClassNames={{ booked: "!opacity-100 bg-[#F1ECE1] text-[#A39A88] line-through", edge: "ring-1 ring-inset ring-[#D3BC8D]" }}
        components={{ DayContent, IconLeft: () => <ChevronLeft className="h-4 w-4" />, IconRight: () => <ChevronRight className="h-4 w-4" /> }}
        classNames={{
          months: "flex flex-col gap-6 sm:flex-row", month: "space-y-3", caption: "relative flex items-center justify-center pt-1", caption_label: "text-sm font-semibold",
          nav: "flex items-center gap-1", nav_button: "inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E3DACA] bg-white hover:bg-[#FAF8F2] disabled:opacity-40",
          nav_button_previous: "absolute left-0", nav_button_next: "absolute right-0",
          table: "border-collapse", head_row: "flex", head_cell: `${days ? "w-10 sm:w-11" : "w-10"} text-[11px] font-medium uppercase text-[#8A8275]`,
          row: "mt-1 flex", cell: `${cell} p-0 text-center text-sm`,
          day: `${cell} rounded-md font-medium hover:bg-[#F1ECE1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#96712D]`,
          day_range_start: "!bg-[#211B11] !text-white hover:!bg-[#211B11]", day_range_end: "!bg-[#211B11] !text-white hover:!bg-[#211B11]", day_range_middle: "!bg-[#E8DCC0] !text-[#211B11] rounded-none",
          day_today: "underline underline-offset-4", day_disabled: "cursor-not-allowed opacity-40 hover:bg-transparent", day_hidden: "invisible",
        }}
      />
      {days && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#686868]" aria-label="Calendar legend">
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-[#211B11]" /> Your trip</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-[#F1ECE1]" /> Booked</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm ring-1 ring-[#D3BC8D]" /> Partly booked: times are checked</span>
        </div>
      )}
      {notice && <p role="alert" className="mt-2 text-sm text-red-700">{notice}</p>}
    </div>
  );
}
