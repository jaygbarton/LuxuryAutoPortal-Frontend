import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Fuel, Gauge, Loader2, Lock, MapPin, Search, ShieldCheck, SlidersHorizontal, Users, X } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PriceCalendar } from "@/components/direct-rental/PriceCalendar";
import { PriceBreakdown } from "@/components/direct-rental/PriceBreakdown";
import { getProxiedImageUrl } from "@/lib/queryClient";
import { PLACEHOLDER_IMG, SEAT_OPTIONS, cleanVal, seatBucket, toggleValue, vehicleType } from "@/lib/fleetFilters";
import { PUBLIC_LOCATIONS } from "@/lib/location-config";
import { useNoIndex } from "@/hooks/use-no-index";
import {
  RENTAL_OFFICE_PHONE, TIME_OPTIONS, addDays, clock, milesLine, money, rentalApi, shortDay, toDay,
  type BookingView, type CalendarDay, type Quote, type RentalRules, type SearchVehicle, type VehicleDetail,
} from "@/lib/directRental";

const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const photo = (url: string | undefined, size: number) => (url ? getProxiedImageUrl(url, size) : PLACEHOLDER_IMG);
const fallbackImage = (e: React.SyntheticEvent<HTMLImageElement>) => { if (e.currentTarget.src !== PLACEHOLDER_IMG) e.currentTarget.src = PLACEHOLDER_IMG; };

/** Trip dates and times, kept in the address bar so a search can be shared or reloaded. */
function useTrip() {
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const s = initial.get("start") ?? "", e = initial.get("end") ?? "";
  const [startDay, setStartDay] = useState(WALL.test(s) ? s.slice(0, 10) : "");
  const [endDay, setEndDay] = useState(WALL.test(s) && WALL.test(e) ? e.slice(0, 10) : "");
  const [startTime, setStartTime] = useState(WALL.test(s) ? s.slice(11) : "10:00");
  const [endTime, setEndTime] = useState(WALL.test(e) ? e.slice(11) : "10:00");
  const [carId, setCarId] = useState<number | null>(Number(initial.get("car")) || null);
  const start = startDay ? `${startDay}T${startTime}` : "", end = endDay ? `${endDay}T${endTime}` : "";
  useEffect(() => {
    const params = new URLSearchParams();
    if (carId) params.set("car", String(carId));
    if (start && end) { params.set("start", start); params.set("end", end); }
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [carId, start, end]);
  return { startDay, endDay, startTime, endTime, start, end, carId, setCarId, setStartTime, setEndTime,
    setDays: (a: string, b: string) => { setStartDay(a); setEndDay(b); }, complete: !!(start && end) };
}
type Trip = ReturnType<typeof useTrip>;

function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs font-medium text-[#686868]">{label}
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="mt-1 block h-11 w-full rounded-md border border-[#DCD5C7] bg-white px-3 text-sm text-[#262626]">
        {TIME_OPTIONS.map(t => <option key={t} value={t}>{clock(t)}</option>)}
      </select>
    </label>
  );
}

function DatesFilter({ trip, minDay, maxDay }: { trip: Trip; minDay: string; maxDay: string }) {
  const [open, setOpen] = useState(false);
  const label = trip.startDay && trip.endDay ? `${shortDay(trip.startDay)} → ${shortDay(trip.endDay)}` : trip.startDay ? `${shortDay(trip.startDay)} → return day` : "Add trip dates";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" data-dates-filter className={`min-h-12 justify-start border-[#DCD5C7] bg-white text-left md:min-w-[260px] ${trip.complete ? "border-[#96712D]" : ""}`}>
          <CalendarDays className="mr-2 h-4 w-4 text-[#87632C]" />{label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[94vw] p-4">
        <p className="mb-3 text-sm font-semibold">When do you need the car?</p>
        <PriceCalendar start={trip.startDay} end={trip.endDay} onChange={trip.setDays} minDay={minDay} maxDay={maxDay} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <TimeSelect label="Pick-up time" value={trip.startTime} onChange={trip.setStartTime} />
          <TimeSelect label="Return time" value={trip.endTime} onChange={trip.setEndTime} />
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => trip.setDays("", "")} disabled={!trip.startDay}>Clear dates</Button>
          <Button size="sm" className="bg-[#D3BC8D] text-[#211B11] hover:bg-[#E3CCA0]" onClick={() => setOpen(false)}>{trip.complete ? "Show available cars" : "Done"}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function priceLine(car: SearchVehicle) {
  if (car.trip && car.available !== false) return <><span className="text-lg font-semibold text-[#211B11]">{money(car.trip.averageDailyCents, 0)}</span><span className="text-[#686868]"> /day · {money(car.trip.tripTotalCents, 0)} total</span></>;
  return <><span className="text-[#686868]">From </span><span className="text-lg font-semibold text-[#211B11]">{money(car.fromDailyCents, 0)}</span><span className="text-[#686868]"> /day</span></>;
}

function CarCard({ car, onBook }: { car: SearchVehicle; onBook: () => void }) {
  const details = [car.trim, car.color].map(cleanVal).filter(Boolean).join(" · ");
  const type = vehicleType(car);
  return (
    <article data-book-card className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E3DACA] bg-white shadow-[0_8px_28px_rgba(36,37,30,0.04)]">
      <button type="button" onClick={onBook} className="relative block aspect-[4/3] overflow-hidden bg-[#E8E2D7] text-left" aria-label={`View ${car.name}`}>
        <img src={photo(car.photos[0], 720)} alt={car.name} loading="lazy" onError={fallbackImage} className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105" />
        <span className="absolute left-4 top-4 rounded-full bg-[#FAF8F2]/95 px-3 py-1.5 text-xs font-medium text-[#544228]">{type === "Other" ? "GLA collection" : type}</span>
        {car.year != null && <span className="absolute bottom-4 right-4 rounded-md bg-black/60 px-3 py-1 text-xs font-semibold text-white">{car.year}</span>}
      </button>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-serif text-3xl leading-tight">{car.name}</h3>
        {details && <p className="mt-2 text-sm leading-6 text-[#686868]">{details}</p>}
        <div className="mt-5 flex flex-wrap gap-4 border-t border-[#E8E1D5] pt-4 text-xs text-[#686868]">
          {car.seats != null && <span className="flex items-center gap-2"><Users className="h-4 w-4 text-[#87632C]" />{car.seats} seats</span>}
          {cleanVal(car.fuelType) && <span>{car.fuelType}</span>}
        </div>
        <p className="mb-5 mt-4 text-sm">{priceLine(car)}</p>
        {car.available === false && <p className="-mt-3 mb-4 text-xs text-[#9A4A2E]">{car.reason}</p>}
        <button type="button" onClick={onBook} className="mt-auto flex min-h-12 items-center justify-between gap-3 rounded-lg bg-[#D3BC8D] px-5 py-3 text-sm font-semibold text-[#211B11] hover:bg-[#E3CCA0]">
          Book<ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function CarRow({ car, selected, onSelect }: { car: SearchVehicle; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" data-book-row aria-pressed={selected} onClick={onSelect}
      className={`flex w-full items-center gap-4 rounded-xl border bg-white p-3 text-left transition-colors ${selected ? "border-[#96712D] ring-1 ring-[#96712D]" : "border-[#E3DACA] hover:border-[#C9B98F]"} ${car.available === false ? "opacity-60" : ""}`}>
      <img src={photo(car.photos[0], 256)} alt="" loading="lazy" onError={fallbackImage} className="h-20 w-28 shrink-0 rounded-lg object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-xl leading-tight">{car.name}</span>
        <span className="mt-0.5 block truncate text-xs text-[#686868]">{[car.year, car.seats ? `${car.seats} seats` : null, cleanVal(car.fuelType)].filter(Boolean).join(" · ")}</span>
        <span className="mt-1.5 block text-sm">{car.available === false ? <span className="text-[#9A4A2E]">{car.reason}</span> : priceLine(car)}</span>
      </span>
    </button>
  );
}

function Gallery({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [photos]);
  const count = Math.max(1, photos.length), go = (step: number) => setIndex(i => (i + step + count) % count);
  return (
    <div data-book-gallery>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#E8E2D7]">
        <img key={index} src={photo(photos[index], 1280)} alt={`${name}, photo ${index + 1} of ${count}`} onError={fallbackImage} className="h-full w-full object-cover" />
        {count > 1 && <>
          <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label="Next photo" onClick={() => go(1)} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"><ChevronRight className="h-5 w-5" /></button>
          <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white">{index + 1} / {count}</span>
        </>}
      </div>
      {count > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button key={url} type="button" aria-label={`Show photo ${i + 1}`} aria-current={i === index} onClick={() => setIndex(i)}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-[#96712D]" : "border-transparent opacity-70 hover:opacity-100"}`}>
              <img src={photo(url, 256)} alt="" loading="lazy" onError={fallbackImage} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VehiclePanel({ carId, trip, minDay, maxDay, onBack }: { carId: number; trip: Trip; minDay: string; maxDay: string; onBack: () => void }) {
  const [, setLocation] = useLocation();
  const [locationId, setLocationId] = useState<number | null>(null);
  const [extras, setExtras] = useState<Record<number, number>>({});
  useEffect(() => { setLocationId(null); setExtras({}); }, [carId]);

  const detail = useQuery({ queryKey: ["/api/direct-rentals/vehicles", carId], queryFn: () => rentalApi<{ vehicle: VehicleDetail; rules: RentalRules }>(`/api/direct-rentals/vehicles/${carId}`), retry: false });
  const calendar = useQuery({ queryKey: ["/api/direct-rentals/vehicles", carId, "calendar", minDay, maxDay], staleTime: 30_000,
    queryFn: () => rentalApi<{ days: CalendarDay[] }>(`/api/direct-rentals/vehicles/${carId}/calendar?from=${minDay}&to=${maxDay}`) });
  const chosenExtras = Object.entries(extras).filter(([, q]) => q > 0).map(([id, quantity]) => ({ id: Number(id), quantity }));
  const tripInput = { carId, start: trip.start, end: trip.end, ...(locationId ? { locationId } : {}), ...(chosenExtras.length ? { extras: chosenExtras } : {}) };
  const quote = useQuery({ queryKey: ["/api/direct-rentals/quote", tripInput], enabled: trip.complete, retry: false, staleTime: 15_000,
    queryFn: () => rentalApi<{ available: boolean; reason: string | null; quote: Quote }>("/api/direct-rentals/quote", "POST", tripInput) });
  const book = useMutation({
    mutationFn: () => rentalApi<{ booking: BookingView }>("/api/direct-rentals/bookings", "POST", tripInput),
    onSuccess: ({ booking }) => setLocation(`/book/checkout/${booking.token}`),
  });

  if (detail.isLoading) return <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[#E3DACA] bg-white" role="status"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading vehicle…</div>;
  if (detail.isError || !detail.data) return <div role="alert" className="rounded-2xl border border-[#DCD5C7] bg-white p-8 text-center"><p>{(detail.error as Error)?.message || "This vehicle could not be loaded."}</p><Button variant="outline" className="mt-4" onClick={onBack}>Back to all vehicles</Button></div>;
  const { vehicle, rules } = detail.data;
  const specs = [vehicle.seats ? { icon: Users, text: `${vehicle.seats} seats` } : null, cleanVal(vehicle.fuelType) ? { icon: Fuel, text: vehicle.fuelType! } : null,
    vehicle.cityMpg && vehicle.hwyMpg ? { icon: Gauge, text: `${vehicle.cityMpg} / ${vehicle.hwyMpg} mpg` } : null, vehicle.city ? { icon: MapPin, text: [vehicle.city, vehicle.state].filter(Boolean).join(", ") } : null].filter(Boolean) as { icon: typeof Users; text: string }[];
  const problem = quote.isError ? (quote.error as Error).message : quote.data && !quote.data.available ? quote.data.reason : null;

  return (
    <div data-book-panel className="min-w-0 space-y-8 rounded-2xl border border-[#E3DACA] bg-white p-4 sm:p-6">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 text-sm font-medium text-[#87632C] lg:hidden"><ArrowLeft className="h-4 w-4" />All vehicles</button>
      <Gallery photos={vehicle.photos} name={vehicle.name} />

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#87632C]">{[vehicle.year, cleanVal(vehicle.trim)].filter(Boolean).join(" · ")}</p>
        <h2 className="mt-1 font-serif text-4xl leading-tight">{vehicle.name}</h2>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#4A4438]">{specs.map(({ icon: Icon, text }) => <span key={text} className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#87632C]" />{text}</span>)}</div>
      </header>

      {vehicle.description && <p className="whitespace-pre-line text-sm leading-7 text-[#4A4438]">{vehicle.description}</p>}
      {vehicle.features.length > 0 && (
        <section aria-label="Features"><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#686868]">Features</h3>
          <ul className="flex flex-wrap gap-2">{vehicle.features.map(f => <li key={f} className="rounded-full border border-[#E3DACA] bg-[#FAF8F2] px-3 py-1.5 text-xs">{f}</li>)}</ul></section>
      )}

      <section aria-label="What's included" className="grid gap-3 rounded-xl bg-[#FAF8F2] p-4 text-sm sm:grid-cols-2">
        {[`${rules.includedMilesPerDay} miles included per day, or add Unlimited Miles`, `Drivers ${rules.minimumDriverAge}+ with a valid license`,
          `${money(rules.depositCents, 0)} deposit, returned 10 to 21 days after return`, "Vehicle stays in Utah unless we approve otherwise"].map(text => <p key={text} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#87632C]" />{text}</p>)}
      </section>

      {vehicle.guidelines && <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#686868]">Guidelines</h3><p className="whitespace-pre-line text-sm leading-7 text-[#4A4438]">{vehicle.guidelines}</p></section>}
      {vehicle.faq.length > 0 && (
        <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#686868]">Questions</h3>
          {vehicle.faq.map(item => <details key={item.question} className="border-b border-[#E8E1D5] py-3 text-sm"><summary className="cursor-pointer font-medium">{item.question}</summary><p className="mt-2 whitespace-pre-line leading-7 text-[#4A4438]">{item.answer}</p></details>)}</section>
      )}

      <section aria-labelledby="book-dates-heading" id="book-dates" className="scroll-mt-24 border-t border-[#E8E1D5] pt-8">
        <h3 id="book-dates-heading" className="font-serif text-2xl">Trip dates and daily prices</h3>
        <p className="mt-1 text-sm text-[#686868]">Tap your pick-up day, then your return day. Each day shows that day's price.</p>
        <div className="mt-4 overflow-x-auto">
          {calendar.isError ? <p role="alert" className="text-sm text-red-700">Prices could not be loaded. <button type="button" className="underline" onClick={() => void calendar.refetch()}>Retry</button></p>
            : <PriceCalendar start={trip.startDay} end={trip.endDay} onChange={trip.setDays} days={calendar.data?.days ?? []} minDay={minDay} maxDay={maxDay} months={2} />}
        </div>
        <div className="mt-5 grid max-w-md grid-cols-2 gap-3">
          <TimeSelect label={`Pick-up time${trip.startDay ? ` · ${shortDay(trip.startDay)}` : ""}`} value={trip.startTime} onChange={trip.setStartTime} />
          <TimeSelect label={`Return time${trip.endDay ? ` · ${shortDay(trip.endDay)}` : ""}`} value={trip.endTime} onChange={trip.setEndTime} />
        </div>
        {vehicle.discounts.length > 0 && <p className="mt-3 text-xs text-[#686868]">Longer trips cost less: {vehicle.discounts.map(d => `${d.percent}% off ${d.minDays}+ days`).join(", ")}.</p>}
      </section>

      {(vehicle.locations.length > 1 || vehicle.extras.length > 0) && (
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {vehicle.locations.length > 1 && (
            <label className="text-sm font-medium">Pick-up and return location
              <select aria-label="Pick-up and return location" value={locationId ?? vehicle.locations.find(l => l.isHome)?.id ?? vehicle.locations[0].id} onChange={e => setLocationId(Number(e.target.value))}
                className="mt-1 block h-11 w-full rounded-md border border-[#DCD5C7] bg-white px-3 text-sm font-normal">
                {vehicle.locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.feeCents ? ` (+${money(l.feeCents, l.feeCents % 100 ? 2 : 0)})` : ""}</option>)}
              </select>
            </label>
          )}
          {vehicle.extras.length > 0 && (
            <fieldset><legend className="text-sm font-medium">Extras</legend>
              <div className="mt-2 space-y-2">
                {vehicle.extras.map(extra => (
                  <label key={extra.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#E3DACA] p-3 text-sm">
                    {extra.maxQuantity > 1
                      ? <select aria-label={`${extra.label} quantity`} value={extras[extra.id] ?? 0} onChange={e => setExtras(current => ({ ...current, [extra.id]: Number(e.target.value) }))}
                          className="h-9 shrink-0 rounded-md border border-[#DCD5C7] bg-white px-1.5 text-sm">{Array.from({ length: extra.maxQuantity + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}</select>
                      : <Checkbox className="mt-0.5" checked={!!extras[extra.id]} onCheckedChange={checked => setExtras(current => ({ ...current, [extra.id]: checked ? 1 : 0 }))} />}
                    <span><span className="font-medium">{extra.label}</span> <span className="text-[#686868]">{money(extra.unitCents, extra.unitCents % 100 ? 2 : 0)} {extra.perDay ? "per day" : "per trip"}{extra.maxQuantity > 1 ? " each" : ""}</span>{extra.description && <span className="block text-xs text-[#8A8275]">{extra.description}</span>}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </section>
      )}

      <details data-trip-charges className="rounded-xl border border-[#E3DACA] bg-[#FAF8F2] p-4 text-sm">
        <summary className="cursor-pointer font-medium">Charges that can apply during your trip</summary>
        <ul className="mt-3 space-y-2 leading-6 text-[#4A4438]">
          <li><strong>Extra miles:</strong> {rules.includedMilesPerDay} miles a day are included. Each mile beyond that costs your trip's daily price divided by {rules.includedMilesPerDay}{quote.data?.quote.additionalMileCents && !quote.data.quote.unlimitedMiles ? ` (${money(quote.data.quote.additionalMileCents)} a mile for these dates)` : ""}. Unlimited Miles removes the limit.</li>
          <li><strong>Fuel:</strong> return the car with the fuel or charge it had at pick-up. If it's lower, you pay for what's missing plus a {money(rules.tripCharges.refuelFeeCents, 0)} refueling fee. Prepaid Fuel covers this.</li>
          <li><strong>Tolls, parking and tickets:</strong> charged at the amount billed.</li>
          <li><strong>Cleaning:</strong> usually {money(rules.tripCharges.cleaningViolationCents, 0)}, and up to {money(rules.tripCharges.cleaningViolationMaxCents, 0)} depending on how severe it is, if the car needs more than a standard clean (for example major stains, heavy mud or a lot of pet hair).</li>
          <li><strong>Smoking or vaping:</strong> {money(rules.tripCharges.smokingViolationCents, 0)}.</li>
          <li><strong>Late return:</strong> no charge under {rules.tripCharges.lateGraceMinutes} minutes. Up to two hours late is half a day. After that it's a full day plus {money(rules.tripCharges.lateFeeCents, 0)}.</li>
        </ul>
      </details>

      <section aria-label="Price and booking" className="border-t border-[#E8E1D5] pt-8">
        {!trip.complete ? <p className="rounded-xl bg-[#FAF8F2] p-4 text-sm text-[#4A4438]">Choose your pick-up and return days above to see the full price.</p>
          : quote.isLoading ? <p role="status" className="flex items-center text-sm text-[#686868]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Pricing your trip…</p>
          : quote.data ? <><p className="mb-4 text-sm font-medium">{shortDay(trip.startDay)} at {clock(trip.startTime)} → {shortDay(trip.endDay)} at {clock(trip.endTime)} · {quote.data.quote.days} day{quote.data.quote.days === 1 ? "" : "s"} · {milesLine(quote.data.quote)}</p><PriceBreakdown quote={quote.data.quote} /></> : null}
        {problem && <p role="alert" className="mt-4 rounded-lg border border-[#E7C4B5] bg-[#FBF1EC] p-3 text-sm text-[#8A3A1E]">{problem}</p>}
        {book.isError && <p role="alert" className="mt-4 rounded-lg border border-[#E7C4B5] bg-[#FBF1EC] p-3 text-sm text-[#8A3A1E]">{(book.error as Error).message}</p>}
        <Button data-book-car size="lg" disabled={!trip.complete || !quote.data?.available || book.isPending} onClick={() => book.mutate()}
          className="mt-6 min-h-14 w-full bg-[#D3BC8D] text-base font-semibold text-[#211B11] hover:bg-[#E3CCA0]">
          {book.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}Book car
        </Button>
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#686868]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#87632C]" />
          Next you'll enter your details in our secure booking area, verify your license and insurance, sign the rental agreement and pay. We hold the car for you while you finish. Nothing is charged yet.</p>
      </section>
    </div>
  );
}

export default function BookPage() {
  useNoIndex();
  const trip = useTrip();
  const location = PUBLIC_LOCATIONS.slc;
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [seats, setSeats] = useState<string[]>([]);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const listRef = useRef<HTMLElement>(null);
  const minDay = useMemo(() => toDay(new Date()), []), maxDay = useMemo(() => addDays(minDay, 365), [minDay]);

  const vehicles = useQuery({ queryKey: ["/api/direct-rentals/vehicles", trip.complete ? trip.start : "", trip.complete ? trip.end : ""], staleTime: 30_000, retry: false,
    queryFn: () => rentalApi<{ vehicles: SearchVehicle[] }>(`/api/direct-rentals/vehicles${trip.complete ? `?start=${encodeURIComponent(trip.start)}&end=${encodeURIComponent(trip.end)}` : ""}`) });
  const all = vehicles.data?.vehicles ?? [];
  const vehicleTypes = useMemo(() => Array.from(new Set(all.map(vehicleType))).sort(), [all]);
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter(car => (showUnavailable || car.available !== false || car.id === trip.carId)
      && (!term || `${car.name} ${car.trim ?? ""} ${car.year ?? ""}`.toLowerCase().includes(term))
      && (!types.length || types.includes(vehicleType(car)))
      && (!seats.length || (seatBucket(car.seats) != null && seats.includes(seatBucket(car.seats)!))))
      .sort((a, b) => Number(b.available !== false) - Number(a.available !== false) || a.name.localeCompare(b.name));
  }, [all, search, types, seats, showUnavailable, trip.carId]);
  const hiddenCount = all.filter(car => car.available === false).length;
  const filterCount = types.length + seats.length;
  const select = (id: number | null) => { trip.setCarId(id); requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const selected = trip.carId != null;

  return (
    <div className="min-h-screen bg-[#FAF8F2] text-[#262626]">
      <Navbar />
      <main className="public-page pt-[68px]">
        <section className="relative overflow-hidden bg-[#171717] text-white">
          <div className="absolute inset-0">
            <img src="/homepage-hero-escalade.jpg" alt="" aria-hidden="true" className="h-full w-full object-cover object-center" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
          </div>
          <div className="relative mx-auto flex min-h-[340px] max-w-[1440px] items-center px-5 py-14 sm:px-8">
            <div className="max-w-xl">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-[#D3BC8D]">Book direct · {location.name}</p>
              <h1 className="font-serif text-4xl font-light leading-[1.08] sm:text-5xl">Book your car<br /><span className="italic text-[#DFC899]">directly with us.</span></h1>
              <p className="mt-5 text-base leading-8 text-white/75">Pick your dates, choose a vehicle from the Golden Luxury Auto collection, and book it here in a few minutes.</p>
            </div>
          </div>
        </section>

        <section ref={listRef} id="book-list" aria-labelledby="book-heading" className="mx-auto max-w-[1920px] scroll-mt-20 px-5 py-12 sm:px-8 lg:py-16">
          <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#87632C]">Find your drive</p><h2 id="book-heading" className="font-serif text-4xl sm:text-5xl">Choose dates and a car.</h2></div>
            <p className="max-w-sm text-sm leading-7 text-[#686868]">Prices include every fee. Questions? Call {RENTAL_OFFICE_PHONE}.</p>
          </div>

          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#E3DACA] bg-white p-4 sm:p-5 md:flex-row md:items-center">
            <DatesFilter trip={trip} minDay={minDay} maxDay={maxDay} />
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#87632C]" />
              <Input aria-label="Search vehicles" placeholder="Search vehicles..." value={search} onChange={e => setSearch(e.target.value)} className="min-h-12 border-[#E3DACA] bg-[#FAF8F2] pl-10" />
            </div>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" className="min-h-12 border-[#DCD5C7] bg-white"><SlidersHorizontal className="mr-2 h-4 w-4" />Filters{filterCount > 0 && <span className="ml-2 rounded-full bg-[#D3BC8D] px-2 py-0.5 text-xs text-[#211B11]">{filterCount}</span>}</Button></PopoverTrigger>
              <PopoverContent align="end" className="w-[min(92vw,360px)] p-4">
                <div className="grid grid-cols-2 gap-5">
                  {[{ title: "Type", options: vehicleTypes, value: types, set: setTypes }, { title: "Seats", options: SEAT_OPTIONS as string[], value: seats, set: setSeats }].map(group => (
                    <div key={group.title}><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                      <div className="space-y-2">{group.options.map(option => <label key={option} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={group.value.includes(option)} onCheckedChange={() => group.set(current => toggleValue(current, option))} />{option}</label>)}</div></div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {(filterCount > 0 || search) && <Button variant="ghost" className="min-h-12" onClick={() => { setTypes([]); setSeats([]); setSearch(""); }}><X className="mr-1 h-4 w-4" />Clear</Button>}
          </div>

          <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-sm text-[#686868]" role="status">
              {vehicles.isLoading ? "Checking availability…" : trip.complete ? `${shown.filter(c => c.available !== false).length} available ${shortDay(trip.startDay)} to ${shortDay(trip.endDay)}` : `Showing ${shown.length} ${shown.length === 1 ? "vehicle" : "vehicles"}. Add dates to see what's available.`}
            </p>
            {trip.complete && hiddenCount > 0 && <label className="flex cursor-pointer items-center gap-2 text-sm text-[#686868]"><Checkbox checked={showUnavailable} onCheckedChange={v => setShowUnavailable(!!v)} />Show {hiddenCount} unavailable</label>}
          </div>

          {vehicles.isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading vehicles">{[1, 2, 3].map(n => <div key={n} className="overflow-hidden rounded-2xl border border-[#E3DACA] bg-white"><div className="aspect-[4/3] animate-pulse bg-[#E8E2D7]" /><div className="h-40" /></div>)}</div>
          ) : vehicles.isError ? (
            <div role="alert" className="rounded-2xl border border-[#DCD5C7] bg-white p-10 text-center"><p>{(vehicles.error as Error).message}</p><Button variant="outline" className="mt-5" onClick={() => void vehicles.refetch()}>Try again</Button></div>
          ) : selected ? (
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(300px,5fr)_minmax(0,8fr)] xl:gap-8" data-book-split>
              <div className="hidden space-y-3 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1" aria-label="Vehicles">
                {shown.map(car => <CarRow key={car.id} car={car} selected={car.id === trip.carId} onSelect={() => select(car.id)} />)}
                {shown.length === 0 && <p className="rounded-xl border border-[#DCD5C7] bg-white p-6 text-sm">No vehicles match.</p>}
              </div>
              <VehiclePanel carId={trip.carId!} trip={trip} minDay={minDay} maxDay={maxDay} onBack={() => select(null)} />
            </div>
          ) : shown.length > 0 ? (
            <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 lg:gap-8" data-book-grid>{shown.map(car => <CarCard key={car.id} car={car} onBook={() => select(car.id)} />)}</div>
          ) : (
            <div className="rounded-2xl border border-[#DCD5C7] bg-white px-6 py-16 text-center">
              <p className="font-serif text-2xl">{all.length === 0 ? "No vehicles can be booked online right now." : trip.complete ? "Nothing is available for those dates." : "No vehicles match your search."}</p>
              {trip.complete && <Button variant="outline" className="mt-5" onClick={() => trip.setDays("", "")}>Try other dates</Button>}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
