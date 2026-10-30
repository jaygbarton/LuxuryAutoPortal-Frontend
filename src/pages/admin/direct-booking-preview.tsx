import { useHomeDefaultFilter } from "@/hooks/use-workspace-location";
import { operationLocationMatches } from "./operations/OperationLocationFilter";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Car, CheckCircle2, ClipboardList, CreditCard, Loader2, MapPin, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { BookingNavigation } from "@/components/shared/BookingNavigation";
import { VehiclePhoto } from "@/components/shared/VehiclePhoto";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { directBookingPreviewHref, isBookingKey, type DirectBookingPreviewView } from "@/lib/booking-navigation";
import { formatBookingDate, previewDateRange } from "@/lib/directBookingPreviewDates";
import { DIRECT_BOOKING_PREVIEW_API as ROOT, type PreviewAvailability, type PreviewDraft, type PreviewDraftInput, type PreviewDraftStatus, type PreviewVehicle, type PreviewVehicleDetails } from "@/lib/directBookingPreview";
import { mtDayKey, mtTodayKey, toMtLocalInput } from "@/lib/mt-datetime";
import { useTimezone } from "@/hooks/use-timezone";
import { TripReceiptDialog } from "./operations/TripReceiptDialog";

const VIEWS = [
  { id: "customer", label: "Customer booking page", description: "Browse cars and create a test request.", icon: Car },
  { id: "worker", label: "Manage requests", description: "Review and edit saved test requests.", icon: ClipboardList },
  { id: "calendar", label: "Booking calendar", description: "See saved test requests in date order.", icon: CalendarDays },
  { id: "day-schedule", label: "Daily schedule", description: "View test requests for a selected day.", icon: ClipboardList },
] as const;
const STATUS_LABELS: Record<PreviewDraftStatus, string> = { draft: "Draft", ready_for_review: "Ready for review", cancelled: "Cancelled preview" };
const money = (amount: number | null) => amount === null || !Number.isFinite(amount) ? "Rate pending" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p className="min-w-0 flex-1 break-words">{error instanceof Error ? error.message : "Could not load this preview. Please retry."}</p>
    {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>}
  </div>;
}
function Loading({ text }: { text: string }) {
  return <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{text}</p>;
}
function AvailabilityNotice({ availability, isLoading, error }: { availability?: PreviewAvailability; isLoading?: boolean; error?: unknown }) {
  if (isLoading) return <Loading text="Checking current fleet records…" />;
  if (error) return <ErrorNotice error={error} />;
  if (!availability) return <p className="text-sm text-muted-foreground">Choose a vehicle and valid dates to check current records.</p>;
  const clear = availability.status === "clear" && availability.complete;
  return <div className={`space-y-2 rounded-lg border p-4 text-sm ${clear ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`} role="status">
    <p className="flex items-center gap-2 font-medium">{clear ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{clear ? "No conflict found in current records" : availability.status === "conflict" ? "Scheduling conflicts found" : "Availability needs review"}</p>
    {!availability.complete && <p>One or more sources could not be verified. This vehicle’s availability is not confirmed.</p>}
    {availability.conflicts.map((conflict, i) => <div className="space-y-1 border-t border-current/10 pt-2" key={`${conflict.eventId}-${i}`}>
      <p className="font-medium">{conflict.title}</p>
      <BookingNavigation bookingKey={conflict.bookingKey} developerAccess />
    </div>)}
    {availability.issues.map((issue, i) => <p key={`${issue.code}-${i}`}>{issue.message}</p>)}
    <p className="text-xs">Preview checks do not hold a vehicle or confirm a booking.</p>
  </div>;
}
function CarPhoto({ vehicle, className, size = 800 }: { vehicle: PreviewVehicle | undefined; className?: string; size?: number }) {
  if (!vehicle) return null;
  return <VehiclePhoto carPhoto={vehicle.photo} carName={vehicle.name} size={size}
    className={cn("flex aspect-[16/9] items-center justify-center rounded-none border-0 bg-slate-100", className)}
    fallback={<Car className="h-10 w-10 text-slate-300" aria-label="Vehicle photo unavailable" />} />;
}

function savedPreviewKey(error: unknown): string | null {
  if (!isApiError(error) || !error.body || typeof error.body !== "object") return null;
  const id = (error.body as { savedDraftId?: unknown }).savedDraftId;
  const key = typeof id === "string" ? `direct_booking_preview:${id}` : "";
  return isBookingKey(key) ? key : null;
}

function CustomerPreview({ vehicles, onCreated }: { vehicles: PreviewVehicle[]; onCreated: () => void }) {
  const initialTimezone = useTimezone();
  const [timezone, setTimezone] = useState(initialTimezone);
  const [search, setSearch] = useState("");
  const [carId, setCarId] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState<PreviewDraft | null>(null);
  const [savedDraftKey, setSavedDraftKey] = useState<string | null>(null);
  const requestHeading = useRef<HTMLHeadingElement>(null);
  const vehicleSearch = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (carId === null || !window.matchMedia("(max-width: 1023px)").matches) return;
    requestHeading.current?.focus({ preventScroll: true });
    requestHeading.current?.closest("section")?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [carId]);
  const dates = previewDateRange(start, end, timezone);
  const selected = vehicles.find(vehicle => vehicle.carId === carId);
  const cities = [...new Set(vehicles.map(vehicle => [vehicle.city, vehicle.state].filter(Boolean).join(", ")).filter(Boolean))].sort();
  const [city,setCity]=useHomeDefaultFilter<string>(home=>cities.find(value=>operationLocationMatches(home,[value]))??"","");
  const filtered = vehicles.filter(vehicle => (!city || [vehicle.city, vehicle.state].filter(Boolean).join(", ") === city) && `${vehicle.name} ${vehicle.make ?? ""} ${vehicle.specs ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const details = useQuery<{ vehicle: PreviewVehicleDetails }>({ queryKey: [ROOT, "vehicles", carId], queryFn: () => api.get(`${ROOT}/vehicles/${carId}`), enabled: carId !== null, retry: false });
  const availability = useQuery<{ availability: PreviewAvailability }>({
    queryKey: [ROOT, "availability", carId, dates?.startAt, dates?.endAt, timezone],
    queryFn: () => api.get(`${ROOT}/availability`, { query: { carId, ...dates, timezone } }),
    enabled: carId !== null && dates !== null, retry: false, staleTime: 0,
  });
  const save = useMutation({
    mutationFn: () => {
      if (!carId || !dates) throw new Error("Select a vehicle and valid pickup and return times.");
      return api.post<{ draft: PreviewDraft }>(`${ROOT}/drafts`, { carId, ...dates, timezone, customerName, customerEmail, customerPhone, notes, status: "draft" } satisfies PreviewDraftInput);
    },
    onSuccess: ({ draft }) => { setSaved(draft); onCreated(); },
    onError: error => { const key = savedPreviewKey(error); if (key) { setSavedDraftKey(key); onCreated(); } },
  });
  return <div className="space-y-4 sm:space-y-6">
    <section className="rounded-xl bg-[#161817] p-4 text-white sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7bd82]">Golden Luxury Auto · Customer preview</p>
      <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Your next drive starts here.</h2>
      <p className="mt-2 max-w-xl text-sm text-slate-300">Explore vehicles, pickup options, and your trip dates. This private preview saves a request for the team to review.</p>
      <div className="mt-4 grid gap-3 rounded-lg bg-white p-3 text-foreground sm:mt-6 sm:gap-4 sm:p-4 md:grid-cols-2 xl:grid-cols-4">
        <div><Label htmlFor="preview-city">Pickup city</Label><select id="preview-city" className="mt-1 h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={city} onChange={e => setCity(e.target.value)}><option value="">All locations</option>{cities.map(value => <option key={value}>{value}</option>)}</select></div>
        <div><Label htmlFor="preview-start">Pickup date & time</Label><Input id="preview-start" type="datetime-local" value={start} onChange={e => { setStart(e.target.value); setSaved(null); }} className="mt-1 min-w-0" /></div>
        <div><Label htmlFor="preview-end">Return date & time</Label><Input id="preview-end" type="datetime-local" value={end} onChange={e => { setEnd(e.target.value); setSaved(null); }} className="mt-1 min-w-0" /></div>
        <div><Label htmlFor="preview-timezone">Trip timezone</Label><select id="preview-timezone" className="mt-1 h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm" value={timezone} onChange={e => { setTimezone(e.target.value); setSaved(null); }}>{[...new Set([initialTimezone, "America/Denver", "America/New_York", "America/Los_Angeles", "UTC"])].map(tz => <option key={tz}>{tz}</option>)}</select></div>
      </div>
    </section>
    {(start || end) && !dates && <p role="alert" className="text-sm text-amber-800">Choose a return time after pickup. Times that are skipped or repeated during daylight saving changes need a different time.</p>}
    <div className={cn("relative max-w-md", selected && "hidden lg:block")}><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input ref={vehicleSearch} aria-label="Search preview vehicles" placeholder="Search make or model…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
      <section aria-label="Preview vehicles" className={cn("min-w-0 space-y-4", selected && "hidden lg:block")}>
        <p className="text-sm text-muted-foreground">{filtered.length} vehicle{filtered.length === 1 ? "" : "s"} · Availability is checked after selection</p>
        {filtered.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No vehicles match these filters.</CardContent></Card>}
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(vehicle => <Card key={vehicle.carId} className={`overflow-hidden ${selected?.carId === vehicle.carId ? "ring-2 ring-primary" : ""}`}>
            <CarPhoto vehicle={vehicle} />
            <CardContent className="space-y-3 p-4">
              <h3 className="font-semibold">{vehicle.name}</h3>
              <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{[vehicle.city, vehicle.state].filter(Boolean).join(", ") || "Pickup location pending"}</p>
              <p className="text-sm">{money(vehicle.baseDailyRate)}{vehicle.baseDailyRate !== null && <span className="text-muted-foreground"> / day, before review</span>}</p>
              {!vehicle.isListed && <Badge variant="secondary">Listing setup needed</Badge>}
              <Button className="w-full" variant={selected?.carId === vehicle.carId ? "default" : "outline"} onClick={() => { setCarId(vehicle.carId); setSaved(null); }} aria-label={`Select ${vehicle.name}`}>{selected?.carId === vehicle.carId ? "Selected" : "View trip options"}<ArrowRight className="ml-2 h-4 w-4" /></Button>
            </CardContent>
          </Card>)}
        </div>
      </section>
      <section aria-label="Trip request preview" className={cn("min-w-0 space-y-4", !selected && "hidden lg:block")}>
        {selected && <Button type="button" variant="ghost" className="lg:hidden" onClick={() => { setCarId(null); requestAnimationFrame(() => { vehicleSearch.current?.focus({ preventScroll: true }); vehicleSearch.current?.scrollIntoView({ block: "start", behavior: "instant" }); }); }}><ArrowLeft className="h-4 w-4" />Back to vehicles</Button>}
        <Card>
          <CardHeader><h2 ref={requestHeading} tabIndex={-1} className="scroll-mt-4 text-lg font-semibold leading-tight outline-none">{selected ? selected.name : "Your trip preview"}</h2></CardHeader>
          <CardContent className="space-y-5">
            {!selected ? <p className="text-sm text-muted-foreground">Choose a vehicle to explore its features and save a preview request.</p> : <>
              {details.isLoading ? <Loading text="Loading vehicle details…" /> : details.error ? <ErrorNotice error={details.error} onRetry={() => details.refetch()} /> : details.data && <VehicleDetails vehicle={details.data.vehicle} />}
              <AvailabilityNotice availability={availability.data?.availability} isLoading={availability.isFetching} error={availability.error} />
              <div className="rounded-lg bg-muted p-4 text-sm"><p className="font-medium">Quote pending review</p><p className="mt-1 text-muted-foreground">The final total, taxes, delivery, extras, deposit, and protection are not configured for direct booking yet.</p></div>
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
                <div><Label htmlFor="preview-name">Guest name</Label><Input id="preview-name" value={customerName} onChange={e => { setCustomerName(e.target.value); setSaved(null); }} autoComplete="off" maxLength={150} /></div>
                <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="preview-email">Email</Label><Input id="preview-email" type="email" value={customerEmail} onChange={e => { setCustomerEmail(e.target.value); setSaved(null); }} autoComplete="off" maxLength={254} /></div><div><Label htmlFor="preview-phone">Phone</Label><Input id="preview-phone" type="tel" value={customerPhone} onChange={e => { setCustomerPhone(e.target.value); setSaved(null); }} autoComplete="off" maxLength={40} /></div></div>
                <div><Label htmlFor="preview-notes">Pickup preference or request</Label><Textarea id="preview-notes" value={notes} onChange={e => { setNotes(e.target.value); setSaved(null); }} placeholder="Pickup location, delivery questions, or requested extras" maxLength={5000} /></div>
                {save.error && <ErrorNotice error={save.error} />}
                {savedDraftKey && <Button variant="outline" asChild><Link href={directBookingPreviewHref("worker", savedDraftKey)}>Open the saved draft<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
                {saved ? <div role="status" className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="font-medium text-emerald-900">Preview request saved. No booking was placed.</p><Button variant="outline" asChild><Link href={directBookingPreviewHref("worker", saved.bookingKey)}>Open worker preview<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div> : <Button type="submit" className="w-full" disabled={!dates || save.isPending || savedDraftKey !== null}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save preview request</Button>}
              </form>
              <Button className="w-full whitespace-normal" disabled variant="outline"><CreditCard className="mr-2 h-4 w-4" />Payments & booking confirmation unavailable</Button>
            </>}
          </CardContent>
        </Card>
      </section>
    </div>
  </div>;
}

function VehicleDetails({ vehicle }: { vehicle: PreviewVehicleDetails }) {
  return <div className="space-y-3 text-sm">
    <CarPhoto vehicle={vehicle} className="rounded-lg" />
    {vehicle.description && <p className="whitespace-pre-wrap text-muted-foreground">{vehicle.description}</p>}
    {vehicle.features.length > 0 && <div className="flex flex-wrap gap-2">{vehicle.features.map((feature, i) => <Badge key={`${feature}-${i}`} variant="secondary">{feature}</Badge>)}</div>}
    {vehicle.locations.length > 0 && <details><summary className="cursor-pointer font-medium">Pickup & delivery options</summary><ul className="mt-2 space-y-1 text-muted-foreground">{vehicle.locations.map(location => <li key={location.id}>{location.name}{location.fee ? ` · ${location.fee}` : ""}</li>)}</ul></details>}
    {vehicle.extras.length > 0 && <details><summary className="cursor-pointer font-medium">Available extras</summary><ul className="mt-2 space-y-2 text-muted-foreground">{vehicle.extras.map(extra => <li key={extra.id}><p>{extra.type} · {money(extra.price)}</p>{extra.description && <p>{extra.description}</p>}</li>)}</ul></details>}
    {vehicle.guidelines && <details><summary className="cursor-pointer font-medium">Vehicle guidelines</summary><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{vehicle.guidelines}</p></details>}
    {vehicle.faq.length > 0 && <details><summary className="cursor-pointer font-medium">Frequently asked questions</summary><div className="mt-2 space-y-3">{vehicle.faq.map((faq, i) => <div key={i}><p className="font-medium">{faq.question}</p><p className="text-muted-foreground">{faq.answer}</p></div>)}</div></details>}
  </div>;
}

function DraftEditor({ draft, vehicles, onUpdated }: { draft: PreviewDraft; vehicles: PreviewVehicle[]; onUpdated: () => void }) {
  const [customerName, setName] = useState(draft.customerName);
  const [customerEmail, setEmail] = useState(draft.customerEmail);
  const [customerPhone, setPhone] = useState(draft.customerPhone);
  const [notes, setNotes] = useState(draft.notes);
  const [carId, setCarId] = useState(draft.carId);
  const [start, setStart] = useState(toMtLocalInput(draft.startAt, draft.timezone));
  const [end, setEnd] = useState(toMtLocalInput(draft.endAt, draft.timezone));
  const [status, setStatus] = useState(draft.status);
  const [saved, setSaved] = useState(false);
  const dates = previewDateRange(start, end, draft.timezone);
  const availability = useQuery<{ availability: PreviewAvailability }>({ queryKey: [ROOT, "availability", carId, dates?.startAt, dates?.endAt, draft.timezone], queryFn: () => api.get(`${ROOT}/availability`, { query: { carId, ...dates, timezone: draft.timezone } }), enabled: dates !== null, retry: false, staleTime: 0 });
  const save = useMutation({ mutationFn: () => {
    if (!dates) throw new Error("Use valid pickup and return times.");
    return api.patch<{ draft: PreviewDraft }>(`${ROOT}/drafts/${draft.id}`, { carId, ...dates, timezone: draft.timezone, customerName, customerEmail, customerPhone, notes, status, version: draft.version });
  }, onSuccess: () => { setSaved(true); onUpdated(); }, onError: error => { if (savedPreviewKey(error)) onUpdated(); } });
  return <Card><CardHeader><CardTitle className="text-lg">Preview request details</CardTitle></CardHeader><CardContent className="space-y-5">
    <CarPhoto vehicle={vehicles.find(car => car.carId === carId)} className="max-w-sm rounded-lg" />
    <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{STATUS_LABELS[draft.status]}</Badge><span className="text-xs text-muted-foreground">Preview only · Revision {draft.version}</span></div>
    <BookingNavigation bookingKey={draft.bookingKey} developerAccess currentView="rental" />
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }} onChange={() => setSaved(false)}>
      <div><Label htmlFor="worker-car">Vehicle</Label><select id="worker-car" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={carId} onChange={e => setCarId(Number(e.target.value))}>{!vehicles.some(car => car.carId === carId) && <option value={carId}>Vehicle #{carId} · currently unavailable</option>}{vehicles.map(car => <option value={car.carId} key={car.carId}>{car.name}</option>)}</select></div>
      <p className="text-xs text-muted-foreground">All trip times: {draft.timezone}</p>
      <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="worker-start">Pickup</Label><Input id="worker-start" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></div><div><Label htmlFor="worker-end">Return</Label><Input id="worker-end" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></div></div>
      {!dates && <p role="alert" className="text-sm text-amber-800">Review the dates and daylight saving transition times.</p>}
      <div><Label htmlFor="worker-name">Guest name</Label><Input id="worker-name" value={customerName} onChange={e => setName(e.target.value)} maxLength={150} /></div>
      <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="worker-email">Email</Label><Input id="worker-email" type="email" value={customerEmail} onChange={e => setEmail(e.target.value)} maxLength={254} /></div><div><Label htmlFor="worker-phone">Phone</Label><Input id="worker-phone" type="tel" value={customerPhone} onChange={e => setPhone(e.target.value)} maxLength={40} /></div></div>
      <div><Label htmlFor="worker-notes">Staff notes & request</Label><Textarea id="worker-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={5000} /></div>
      <div><Label htmlFor="worker-status">Preview status</Label><select id="worker-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={e => setStatus(e.target.value as PreviewDraftStatus)}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
      <AvailabilityNotice availability={availability.data?.availability} isLoading={availability.isFetching} error={availability.error} />
      <div className="rounded-lg bg-muted p-4 text-sm"><p className="font-medium">Price & payment review</p><p className="mt-1">Base daily rate: {money(draft.quote.baseDailyRate)}</p><p className="mt-1 text-muted-foreground">{draft.quote.reason}</p><p className="mt-1 text-muted-foreground">Final total is unavailable. Nothing has been charged or reserved.</p></div>
      {save.error && <ErrorNotice error={save.error} onRetry={onUpdated} />}
      {saved && <p role="status" className="text-sm text-emerald-800">Preview changes saved.</p>}
      <Button type="submit" disabled={!dates || save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save preview changes</Button>
    </form>
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled>Confirm reservation</Button><Button variant="outline" disabled>Charge or refund</Button><Button variant="outline" disabled>Send guest email</Button></div>
  </CardContent></Card>;
}

function DraftSchedule({ drafts, vehicles, view, selectedKey }: { drafts: PreviewDraft[]; vehicles: PreviewVehicle[]; view: "calendar" | "day-schedule"; selectedKey: string | null }) {
  const [fuelDraft, setFuelDraft] = useState<PreviewDraft | null>(null);
  const userTimezone = useTimezone();
  const selected = drafts.find(draft => draft.bookingKey === selectedKey);
  const [day, setDay] = useState(() => selected ? mtDayKey(selected.startAt, selected.timezone) : mtTodayKey(userTimezone));
  const [includeCancelled, setIncludeCancelled] = useState(false);
  useEffect(() => { if (selected) setDay(mtDayKey(selected.startAt, selected.timezone)); }, [selected?.id]);
  const rows = drafts.filter(draft => (includeCancelled || draft.status !== "cancelled") && (view === "calendar" || mtDayKey(draft.startAt, userTimezone) <= day && mtDayKey(draft.endAt, userTimezone) >= day)).sort((a, b) => a.startAt.localeCompare(b.startAt));
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg">{view === "calendar" ? <CalendarDays className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}{view === "calendar" ? "Preview booking calendar" : "Preview day schedule"}</CardTitle></CardHeader><CardContent className="space-y-4">
    {fuelDraft && <TripReceiptDialog kind="gas" bookingKey={fuelDraft.bookingKey} onClose={() => setFuelDraft(null)} />}
    <p className="text-sm text-muted-foreground">Private draft bookings stay in this preview. They are not included in the operational calendar or Google Calendar.</p>
    <div className="flex flex-wrap items-center gap-4">{view === "day-schedule" && <div><Label htmlFor="draft-schedule-day">Schedule date ({userTimezone})</Label><Input id="draft-schedule-day" type="date" value={day} onChange={e => setDay(e.target.value)} /></div>}<label className="flex items-center gap-2 text-sm"><Checkbox checked={includeCancelled} onCheckedChange={value => setIncludeCancelled(value === true)} />Show cancelled previews</label></div>
    {rows.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No preview bookings match this view.</p>}
    {rows.map(draft => <article key={draft.id} className={`space-y-3 rounded-lg border p-4 ${draft.bookingKey === selectedKey ? "border-primary bg-primary/5" : ""}`}>
      <CarPhoto vehicle={vehicles.find(car => car.carId === draft.carId)} className="w-40 rounded-lg" size={320} />
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{vehicles.find(car => car.carId === draft.carId)?.name ?? `Vehicle #${draft.carId}`}</h3><Badge variant={draft.status === "cancelled" ? "secondary" : "outline"}>{STATUS_LABELS[draft.status]}</Badge></div>
      <p className="text-sm text-muted-foreground">{draft.customerName || "Guest details pending"}</p>
      <div className="grid gap-2 text-sm sm:grid-cols-2"><p>Pickup: {formatBookingDate(draft.startAt, userTimezone)}</p><p>Return: {formatBookingDate(draft.endAt, userTimezone)}</p></div>
      {view === "day-schedule" && draft.status !== "cancelled" && mtDayKey(draft.endAt, userTimezone) === day && <Button variant="outline" className="min-h-11" onClick={() => setFuelDraft(draft)}>Refuel</Button>}
      <BookingNavigation bookingKey={draft.bookingKey} currentView={view} developerAccess />
    </article>)}
  </CardContent></Card>;
}

export default function DirectBookingPreviewPage() {
  const search = useSearch(), qc = useQueryClient();
  const params = new URLSearchParams(search), requestedView = params.get("view"), rawKey = params.get("booking");
  const view = VIEWS.some(item => item.id === requestedView) ? requestedView as DirectBookingPreviewView : "customer";
  const selectedKey = rawKey && isBookingKey(rawKey) && rawKey.startsWith("direct_booking_preview:") ? rawKey : null;
  const [draftSearch, setDraftSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const vehicles = useQuery<{ vehicles: PreviewVehicle[] }>({ queryKey: [ROOT, "vehicles"], queryFn: () => api.get(`${ROOT}/vehicles`), retry: false });
  const drafts = useQuery<{ drafts: PreviewDraft[] }>({ queryKey: [ROOT, "drafts"], queryFn: () => api.get(`${ROOT}/drafts`), retry: false });
  const selectedId = selectedKey?.split(":")[1];
  const selectedDraft = useQuery<{ draft: PreviewDraft }>({ queryKey: [ROOT, "drafts", selectedId], queryFn: () => api.get(`${ROOT}/drafts/${selectedId}`), enabled: !!selectedId && view === "worker", retry: false });
  const workerDetails = useRef<HTMLElement>(null);
  useEffect(() => {
    if (view !== "worker" || !selectedDraft.data?.draft || !window.matchMedia("(max-width: 1279px)").matches) return;
    workerDetails.current?.focus({ preventScroll: true });
    workerDetails.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [view, selectedId, selectedDraft.data?.draft.id]);
  const refreshDrafts = () => { qc.invalidateQueries({ queryKey: [ROOT, "drafts"] }); qc.invalidateQueries({ queryKey: [ROOT, "availability"] }); };
  const visibleDrafts = useMemo(() => (drafts.data?.drafts ?? []).filter(draft => (filter === "all" || draft.status === filter) && `${draft.customerName} ${draft.customerEmail} ${vehicles.data?.vehicles.find(car => car.carId === draft.carId)?.name ?? ""}`.toLowerCase().includes(draftSearch.trim().toLowerCase())), [drafts.data, vehicles.data, filter, draftSearch]);
  return <AdminLayout><div className="min-w-0 space-y-4 sm:space-y-6">
    <Button size="sm" variant="ghost" asChild><Link href="/admin/developer"><ArrowLeft className="mr-2 h-4 w-4" />Back to Developer</Link></Button>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Direct booking previews</h1><p className="mt-1 text-sm text-muted-foreground">Customer and worker workflows rebuilt from the legacy rental pages.</p></div><Badge variant="secondary"><ShieldCheck className="mr-1.5 h-4 w-4" />Developer only</Badge></div>
    <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Private preview — direct bookings are not live.</p><p className="mt-1">Saving or editing a draft does not reserve a vehicle, charge a card, email a customer, or add a Google Calendar event.</p></div>
    <section aria-labelledby="preview-navigation-heading" className="space-y-3">
      <div><h2 id="preview-navigation-heading" className="text-base font-semibold">Choose a testing view</h2><p className="text-sm text-muted-foreground">These views share the same saved test requests.</p></div>
      <nav aria-label="Direct booking preview areas" className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {VIEWS.map(item => {
          const active = view === item.id, Icon = item.icon;
          return <Link key={item.id} href={directBookingPreviewHref(item.id, selectedKey ?? undefined)}
            aria-current={active ? "page" : undefined}
            className={cn("flex min-h-16 min-w-0 items-center gap-2 rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:items-start sm:gap-3 sm:p-4", active ? "border-primary bg-primary/10 ring-1 ring-primary" : "bg-background hover:bg-muted")}>
            <Icon className="h-4 w-4 shrink-0 sm:mt-0.5 sm:h-5 sm:w-5" />
            <span className="min-w-0"><span className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:text-sm">{item.label}{active && <span className="hidden rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground sm:inline">Current view</span>}</span><span className="mt-1 hidden text-xs leading-relaxed text-muted-foreground sm:block">{item.description}</span></span>
          </Link>;
        })}
      </nav>
      <p className="text-xs text-muted-foreground sm:hidden">{VIEWS.find(item => item.id === view)?.description}</p>
    </section>
    {rawKey && !selectedKey && <ErrorNotice error={new Error("This is not a valid preview booking link.")} />}
    {vehicles.isLoading ? <Loading text="Loading preview vehicles…" /> : vehicles.error ? <ErrorNotice error={vehicles.error} onRetry={() => vehicles.refetch()} /> : view === "customer" ? <CustomerPreview vehicles={vehicles.data?.vehicles ?? []} onCreated={refreshDrafts} /> : <>
      {drafts.isLoading ? <Loading text="Loading saved preview requests…" /> : drafts.error ? <ErrorNotice error={drafts.error} onRetry={() => drafts.refetch()} /> : view === "worker" ? <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1fr)]">
        <Card className={cn(selectedId && "hidden xl:block")}><CardHeader><h2 className="text-lg font-semibold leading-tight">Preview requests</h2></CardHeader><CardContent className="space-y-4">
          <Input aria-label="Search preview requests" placeholder="Search guest or vehicle…" value={draftSearch} onChange={e => setDraftSearch(e.target.value)} />
          <select aria-label="Filter preview request status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All preview statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {visibleDrafts.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No preview requests found.</p>}
          {visibleDrafts.map(draft => <Link key={draft.id} href={directBookingPreviewHref("worker", draft.bookingKey)} className={`block rounded-lg border p-3 transition-colors hover:bg-muted ${draft.bookingKey === selectedKey ? "border-primary bg-primary/5" : ""}`}>
            <CarPhoto vehicle={vehicles.data?.vehicles.find(car => car.carId === draft.carId)} className="mb-2 w-28 rounded-md" size={240} />
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{draft.customerName || "Guest details pending"}</p><Badge variant="outline">{STATUS_LABELS[draft.status]}</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">{vehicles.data?.vehicles.find(car => car.carId === draft.carId)?.name ?? `Vehicle #${draft.carId}`}</p><p className="mt-1 text-xs text-muted-foreground">{formatBookingDate(draft.startAt, draft.timezone)}</p>
          </Link>)}
        </CardContent></Card>
        <section ref={workerDetails} tabIndex={-1} aria-label="Selected preview request" className={cn("min-w-0 scroll-mt-4 space-y-3 outline-none", !selectedId && "hidden xl:block")}>
          {selectedId && <Button variant="ghost" className="xl:hidden" asChild><Link href={directBookingPreviewHref("worker")}><ArrowLeft className="h-4 w-4" />Back to requests</Link></Button>}
          {selectedId ? selectedDraft.isLoading ? <Loading text="Loading preview request…" /> : selectedDraft.error ? <ErrorNotice error={selectedDraft.error} onRetry={() => selectedDraft.refetch()} /> : selectedDraft.data ? <DraftEditor key={`${selectedDraft.data.draft.id}:${selectedDraft.data.draft.version}`} draft={selectedDraft.data.draft} vehicles={vehicles.data?.vehicles ?? []} onUpdated={refreshDrafts} /> : null : <Card><CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground"><ClipboardList className="h-10 w-10" /><p>Select a request to review or edit its private draft.</p><Button variant="outline" asChild><Link href={directBookingPreviewHref("customer")}>Create a preview request</Link></Button></CardContent></Card>}
        </section>
      </div> : <DraftSchedule drafts={drafts.data?.drafts ?? []} vehicles={vehicles.data?.vehicles ?? []} view={view} selectedKey={selectedKey} />}
    </>}
  </div></AdminLayout>;
}
