import { useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CalendarDays, Car, ClipboardList, Loader2, Search, ShieldCheck } from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { BookingNavigation } from "@/components/shared/BookingNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { directBookingPreviewHref, isBookingKey } from "@/lib/booking-navigation";
import { formatBookingDate } from "@/lib/directBookingPreviewDates";
import { type FleetCalendarEvent, type FleetCalendarResponse, FLEET_SOURCE_LABELS, isCancelledCalendarEvent } from "@/lib/fleetCalendar";
import { addUtcDays, dayKeyToUtcDate, mtDayKey, mtTodayKey, utcDateToDayKey } from "@/lib/mt-datetime";
import { useTimezone } from "@/hooks/use-timezone";

type WorkerEvent = FleetCalendarEvent & { plate?: string | null; guestName?: string | null; ownerName?: string | null };
const normalize = (event: WorkerEvent): WorkerEvent => ({ ...event, plateNumber: event.plateNumber ?? event.plate ?? null });

export default function CarRentalsPage() {
  const timezone = useTimezone(), params = new URLSearchParams(useSearch());
  const requestedKey = params.get("booking");
  const key = requestedKey && isBookingKey(requestedKey) && !requestedKey.startsWith("direct_booking_preview:") ? requestedKey : null;
  const [search, setSearch] = useState("");
  const [showCancelled, setShowCancelled] = useState(true);
  const from = utcDateToDayKey(addUtcDays(dayKeyToUtcDate(mtTodayKey(timezone)), -7));
  const to = utcDateToDayKey(addUtcDays(dayKeyToUtcDate(mtTodayKey(timezone)), 45));
  const events = useQuery<FleetCalendarResponse>({ queryKey: ["/api/internal-calendar/events", from, to, timezone], queryFn: async () => {
    const response = await api.get<FleetCalendarResponse>("/api/internal-calendar/events", { query: { from, to, timezone } });
    if (!Array.isArray(response.events) || !Array.isArray(response.cars) || !Array.isArray(response.warnings)) throw new Error("The fleet records response is incomplete. Please retry.");
    return response;
  }, enabled: !key, retry: false });
  const booking = useQuery<{ event: WorkerEvent; timezone: string }>({ queryKey: ["/api/internal-calendar/bookings", key], queryFn: async () => {
    const response = await api.get<{ event: WorkerEvent; timezone: string }>(`/api/internal-calendar/bookings/${encodeURIComponent(key ?? "")}`);
    if (!response.event || (response.event.bookingKey ?? response.event.id) !== key || !response.timezone) throw new Error("This booking could not be verified. Please retry.");
    return response;
  }, enabled: !!key, retry: false });
  const event = booking.data?.event ? normalize(booking.data.event) : null;
  const displayTimezone = booking.data?.timezone ?? timezone;
  const rows = (events.data?.events ?? []).map(normalize).filter(item => (showCancelled || !isCancelledCalendarEvent(item)) && `${item.title} ${item.carName} ${item.guestName ?? ""} ${item.ownerName ?? ""} ${item.reservationId ?? ""} ${item.plateNumber ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const error = key ? booking.error : events.error;
  return <AdminLayout><div className="min-w-0 space-y-6">
    <Button size="sm" variant="ghost" asChild><Link href="/admin/developer"><ArrowLeft className="mr-2 h-4 w-4" />Back to Developer</Link></Button>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Car rental worker preview</h1><p className="mt-1 text-sm text-muted-foreground">Open a fleet booking and move between its rental details, calendar, and day schedule.</p></div><Badge variant="secondary"><ShieldCheck className="mr-2 h-4 w-4" />Developer only</Badge></div>
    <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-medium">Private worker preview</p><p className="mt-1">Existing fleet records are read only. New direct booking requests are private drafts.</p></div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href={directBookingPreviewHref("worker")}><ClipboardList className="mr-2 h-4 w-4" />Direct booking drafts</Link></Button><Button variant="outline" asChild><Link href={directBookingPreviewHref("customer")}><Car className="mr-2 h-4 w-4" />Customer preview</Link></Button><Button variant="outline" asChild><Link href="/admin/trip-calendar"><CalendarDays className="mr-2 h-4 w-4" />Internal calendar</Link></Button></div>
    {requestedKey && !key && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">This booking link is invalid. Preview drafts can be opened from Direct booking drafts.</div>}
    {error && <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error instanceof Error ? error.message : "Booking records could not be loaded."}</p><Button size="sm" variant="outline" onClick={() => key ? booking.refetch() : events.refetch()}>Retry booking records</Button></div>}
    {(key ? booking.isLoading : events.isLoading) && <p role="status" className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading fleet booking records…</p>}
    {key && event && <Card><CardHeader><CardTitle className="flex flex-wrap items-center gap-3"><Car className="h-5 w-5" /><h2>{event.title || event.carName}</h2><Badge variant={isCancelledCalendarEvent(event) ? "secondary" : "outline"}>{event.status || "Status unavailable"}</Badge></CardTitle></CardHeader><CardContent className="space-y-6">
      <BookingNavigation bookingKey={event.bookingKey ?? key} currentView="rental" developerAccess date={event.start ? mtDayKey(event.start, displayTimezone) : undefined} />
      <dl className="grid gap-5 sm:grid-cols-2"><Detail label="Vehicle" value={event.carName || "Vehicle mapping unavailable"} /><Detail label="Plate" value={event.plateNumber || "Not recorded"} /><Detail label="Booking source" value={FLEET_SOURCE_LABELS[event.source] ?? event.source} /><Detail label="Reservation / record" value={event.reservationId || String(event.sourceId ?? "Not recorded")} /><Detail label="Pickup / start" value={formatBookingDate(event.start, displayTimezone)} /><Detail label="Return / end" value={event.end ? formatBookingDate(event.end, displayTimezone) : "End not recorded — review before booking"} /><Detail label="Guest" value={event.guestName || "Not recorded"} /><Detail label="Owner" value={event.ownerName || "Not recorded"} /><Detail label="Fleet availability" value={isCancelledCalendarEvent(event) ? "Cancelled — does not block availability" : event.blocksAvailability ? "Blocks this vehicle’s availability" : "Does not block availability"} /><Detail label="Timezone" value={displayTimezone} /></dl>
      {event.notes && <div className="rounded-lg bg-muted p-4 text-sm"><h3 className="font-medium">Record notes</h3><p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{event.notes}</p></div>}
      <div className="flex flex-wrap gap-2"><Button disabled variant="outline">Edit booking</Button><Button disabled variant="outline">Charge or refund</Button><Button disabled variant="outline">Send customer message</Button></div>
    </CardContent></Card>}
    {!key && events.data && <Card><CardHeader><CardTitle className="text-lg">Fleet records</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Showing {from} through {to}, in {timezone}. Open the internal calendar to change the date range.</p>
      {(!events.data.complete || !events.data.availabilityComplete) && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">One or more source records need review. Availability is not confirmed.</div>}
      {events.data.warnings?.map((warning, i) => <p key={i} className="text-sm text-amber-800">{warning}</p>)}
      <div className="flex flex-wrap items-center gap-4"><div className="relative min-w-0 max-w-md flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search worker fleet records" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicle, guest, or reservation…" className="pl-9" /></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={showCancelled} onCheckedChange={value => setShowCancelled(value === true)} />Show cancelled trips</label></div>
      {rows.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No fleet records match this view.</p>}
      {rows.map(item => <article key={item.id} className="space-y-3 rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.carName} {item.plateNumber ? `· ${item.plateNumber}` : ""}</p></div><Badge variant="outline">{item.status}</Badge></div><div className="grid gap-2 text-sm sm:grid-cols-2"><p>Start: {formatBookingDate(item.start, timezone)}</p><p>End: {formatBookingDate(item.end, timezone)}</p></div><BookingNavigation bookingKey={item.bookingKey ?? item.id} developerAccess date={item.start ? mtDayKey(item.start, timezone) : undefined} /></article>)}
    </CardContent></Card>}
  </div></AdminLayout>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>; }
