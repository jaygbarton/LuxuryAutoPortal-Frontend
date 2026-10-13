import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, apiJson } from "@/lib/api";
import { useTimezone } from "@/hooks/use-timezone";
import { useToast } from "@/hooks/use-toast";
import { toMtLocalInput } from "@/lib/mt-datetime";
import { previewDateRange, formatBookingDate } from "@/lib/directBookingPreviewDates";
import { MAINTENANCE_APPOINTMENTS_API as ROOT, maintenanceReturnAfterDays, type MaintenanceAppointment, type MaintenanceAppointmentAvailabilityResponse, type MaintenanceAppointmentDetails } from "@/lib/maintenanceAppointments";
import { BookingNavigation } from "@/components/shared/BookingNavigation";

function AppointmentError({ error }: { error: unknown }) {
  return <div role="alert" className="flex gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p className="break-words">{error instanceof Error ? error.message : "This appointment could not be verified. Please retry."}</p></div>;
}

export function MaintenanceAppointmentDialog({ maintenanceId, open, onOpenChange, suggestedDate }: { maintenanceId: number | null; open: boolean; onOpenChange: (open: boolean) => void; suggestedDate?: string | null }) {
  const details = useQuery<MaintenanceAppointmentDetails>({ queryKey: [ROOT, maintenanceId], queryFn: () => api.get(`${ROOT}/${maintenanceId}`), enabled: open && maintenanceId !== null, retry: false, staleTime: 0 });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl overflow-y-auto p-4 sm:p-6">
    <DialogHeader><DialogTitle>Maintenance appointment</DialogTitle><DialogDescription>Choose where the car is going and when it will return. A maintenance need does not become scheduled until availability is checked and you confirm.</DialogDescription></DialogHeader>
    {details.isLoading && <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading appointment…</p>}
    {details.error && <><AppointmentError error={details.error} /><Button variant="outline" onClick={() => details.refetch()}>Reload appointment</Button></>}
    {details.data && <AppointmentEditor key={`${maintenanceId}:${details.data.version}`} details={details.data} suggestedDate={suggestedDate} onReload={() => details.refetch()} onDone={() => onOpenChange(false)} />}
  </DialogContent></Dialog>;
}

function AppointmentEditor({ details, suggestedDate, onReload, onDone }: { details: MaintenanceAppointmentDetails; suggestedDate?: string | null; onReload: () => void; onDone: () => void }) {
  const activeTimezone = useTimezone(), qc = useQueryClient(), { toast } = useToast();
  const existing = details.appointment;
  const confirmed = existing?.status === "confirmed";
  const vehicleChanged = confirmed && existing.carId !== details.task.carId;
  const closedWithoutAppointment = !confirmed && /^(?:completed|resolved|closed|cancelled|canceled|done)$/i.test(details.task.status);
  const [timezone, setTimezone] = useState(existing?.timezone ?? activeTimezone);
  const [start, setStart] = useState(toMtLocalInput(existing?.startAt ?? suggestedDate, existing?.timezone ?? activeTimezone));
  const [end, setEnd] = useState(toMtLocalInput(existing?.endAt, existing?.timezone ?? activeTimezone));
  const [destination, setDestination] = useState(existing?.destination ?? details.task.repairShop ?? "");
  const [days, setDays] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [cancelReview, setCancelReview] = useState(false);
  const [checked, setChecked] = useState<{ signature: string; response: MaintenanceAppointmentAvailabilityResponse; receivedAt: string } | null>(null);
  const dates = previewDateRange(start, end, timezone);
  const validDestination = destination.trim().length >= 3 && !/^(unknown|tbd|n\/?a|none|not set)$/i.test(destination.trim());
  const payload = dates ? { ...dates, timezone, destination: destination.trim(), version: details.version, expectedCarId: details.task.carId } : null;
  const signature = JSON.stringify(payload);
  const currentCheck = checked?.signature === signature ? checked : null;
  const availability = currentCheck?.response.availability;
  const versionMatches = currentCheck?.response.version === details.version;
  const vehicleMatches = currentCheck?.response.carId === details.task.carId;
  const verifiedClear = availability?.status === "clear" && availability.complete && availability.canSchedule && availability.conflicts.length === 0 && versionMatches && vehicleMatches;
  const canConfirm = !!payload && validDestination && details.task.carId !== null && !vehicleChanged && !closedWithoutAppointment && verifiedClear && reviewed;
  useEffect(() => { setReviewed(false); }, [signature]);
  const invalidate = () => {
    for (const key of [ROOT, "/api/operations/maintenance", "/api/internal-calendar/events", "/api/internal-calendar/bookings", "/api/operations/day-schedule", "operations-day-schedule"]) qc.invalidateQueries({ queryKey: [key] });
  };
  const check = useMutation({ mutationFn: async () => {
    if (!dates || !validDestination) throw new Error("Enter a destination and valid start and return times before checking.");
    const response = await api.get<MaintenanceAppointmentAvailabilityResponse>(`${ROOT}/${details.task.id}/availability`, { query: { ...dates, timezone } });
    if (!response.availability || !Array.isArray(response.availability.conflicts) || !Array.isArray(response.availability.warnings)) throw new Error("The availability response is incomplete. Scheduling cannot be confirmed.");
    return { signature, response, receivedAt: new Date().toISOString() };
  }, onSuccess: result => { setChecked(result); setReviewed(false); } });
  const save = useMutation({ mutationFn: () => {
    if (!canConfirm || !payload) throw new Error("Check the current availability and review the appointment before confirming.");
    return api.put<{ appointment: MaintenanceAppointment }>(`${ROOT}/${details.task.id}`, payload);
  }, onSuccess: () => { invalidate(); toast({ title: "Maintenance appointment confirmed", description: "The car’s start and return times are now scheduled." }); onDone(); }, onError: () => { setChecked(null); setReviewed(false); } });
  const cancel = useMutation({ mutationFn: () => apiJson<{ appointment: MaintenanceAppointment }>(`${ROOT}/${details.task.id}`, { method: "DELETE", body: { version: details.version } }), onSuccess: () => { invalidate(); toast({ title: "Appointment cancelled", description: "The maintenance need remains on the Maintenance page." }); onDone(); } });
  const busy = check.isPending || save.isPending || cancel.isPending;
  const durationHours = dates ? (Date.parse(dates.endAt) - Date.parse(dates.startAt)) / 3_600_000 : null;
  const setStartAndDuration = (value: string) => { setStart(value); if (days) { const next = maintenanceReturnAfterDays(value, Number(days)); if (next) setEnd(next); } };
  return <div className="space-y-4">
    <div className="rounded-md bg-muted p-3 text-sm"><p className="font-medium">{details.task.carName}</p><p className="mt-1 text-muted-foreground">Maintenance need #{details.task.id} · {details.task.status}</p></div>
    {confirmed && existing && <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="flex items-center gap-2 font-medium"><CalendarCheck className="h-4 w-4" />Confirmed appointment</p><p>{existing.destination}</p><p>Start: {formatBookingDate(existing.startAt, existing.timezone)}</p><p>Return: {formatBookingDate(existing.endAt, existing.timezone)}</p><BookingNavigation bookingKey={`maintenance:${details.task.id}`} /><p className="text-xs">Changing dates below requires another availability check and confirmation.</p></div>}
    {!confirmed && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{existing?.status === "cancelled" ? "The previous appointment is cancelled. " : ""}This maintenance need has no confirmed appointment.</p>}
    {details.task.carId === null && <AppointmentError error={new Error("Link this maintenance need to an exact vehicle before scheduling an appointment.")} />}
    {vehicleChanged && <AppointmentError error={new Error("This maintenance report is now linked to a different vehicle than its confirmed appointment. Verify the vehicle before rescheduling.")} />}
    {closedWithoutAppointment && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">This maintenance report is closed. A new appointment cannot be scheduled from a closed report.</p>}
    <div><Label htmlFor="appointment-destination" className="flex items-center gap-1"><MapPin className="h-4 w-4" />Destination / repair shop *</Label><Input id="appointment-destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Shop name and location, or where the car is going" maxLength={255} disabled={busy} /><p className="mt-1 text-xs text-muted-foreground">Enter the actual shop or location, then review it even when a repair shop is prefilled.</p></div>
    <div><Label htmlFor="appointment-timezone">Appointment timezone</Label><select id="appointment-timezone" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={timezone} disabled={busy} onChange={e => setTimezone(e.target.value)}>{[...new Set([activeTimezone, existing?.timezone ?? activeTimezone, "America/Denver", "America/New_York", "America/Los_Angeles", "UTC"])].map(tz => <option key={tz}>{tz}</option>)}</select></div>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="appointment-start">Start date & time *</Label><Input id="appointment-start" type="datetime-local" value={start} onChange={e => setStartAndDuration(e.target.value)} disabled={busy} /></div><div><Label htmlFor="appointment-end">Expected return date & time *</Label><Input id="appointment-end" type="datetime-local" value={end} onChange={e => { setEnd(e.target.value); setDays(""); }} disabled={busy} /></div></div>
    <div className="grid items-end gap-3 sm:grid-cols-2"><div><Label htmlFor="appointment-days">Days away (optional)</Label><Input id="appointment-days" type="number" min="1" max="366" step="1" value={days} disabled={busy} onChange={e => { setDays(e.target.value); const next = maintenanceReturnAfterDays(start, Number(e.target.value)); if (next) setEnd(next); }} placeholder="Set the return date from a number of days" /></div>{durationHours !== null && <p className="text-sm text-muted-foreground">Time away: {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(durationHours)} hours. Start and return dates above define the actual appointment.</p>}</div>
    {(start || end) && !dates && <p role="alert" className="text-sm text-amber-900">Enter a return time after the start. Skipped or repeated daylight saving times need a different time.</p>}
    {suggestedDate && !existing && <p className="text-xs text-muted-foreground">The suggested date only prefills this form. It has not booked or blocked the car.</p>}
    <Button variant="outline" onClick={() => { save.reset(); setChecked(null); setReviewed(false); check.mutate(); }} disabled={!dates || !validDestination || details.task.carId === null || vehicleChanged || closedWithoutAppointment || busy}>{check.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4" />}Check appointment availability</Button>
    {check.error && <AppointmentError error={check.error} />}
    {availability && <div className={`space-y-2 rounded-md border p-3 text-sm ${verifiedClear ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-950"}`} role="status">
      <p className="flex items-center gap-2 font-medium">{verifiedClear ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{availability.status === "conflict" ? "This appointment conflicts with existing bookings" : verifiedClear ? "Availability checked — ready for your review" : "Availability cannot be confirmed"}</p>
      {!availability.complete && <p>Some booking or blocked-date records could not be verified. Choose a different time or resolve those records before scheduling.</p>}
      {!versionMatches && <p>This appointment changed in another session. Reload it before confirming a new schedule.</p>}
      {!vehicleMatches && <p>The maintenance record is now linked to a different vehicle. Reload it and verify the vehicle before scheduling.</p>}
      {availability.conflicts.map((conflict, index) => <div key={`${conflict.bookingKey}-${index}`} className="space-y-2 border-t border-current/10 pt-2"><p className="font-medium">{conflict.title}</p><p>{formatBookingDate(conflict.start, timezone)} → {formatBookingDate(conflict.end, timezone)}</p><BookingNavigation bookingKey={conflict.bookingKey} /></div>)}
      {availability.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
      <p className="text-xs">Checked: {formatBookingDate(availability.checkedAt ?? currentCheck?.receivedAt, timezone)}. The server checks again when you confirm.</p>
    </div>}
    {verifiedClear && payload && <div className="space-y-3 rounded-md border p-3 text-sm"><p className="font-medium">Review appointment</p><p>Destination: {payload.destination}</p><p>Start: {formatBookingDate(payload.startAt, timezone)}</p><p>Expected return: {formatBookingDate(payload.endAt, timezone)}</p><label className="flex items-start gap-2"><Checkbox checked={reviewed} disabled={busy} onCheckedChange={value => setReviewed(value === true)} /><span>I have reviewed the destination, start, and return time and want to confirm this appointment.</span></label></div>}
    {save.error && <AppointmentError error={save.error} />}
    <div className="flex flex-wrap gap-2"><Button onClick={() => save.mutate()} disabled={!canConfirm || busy}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{confirmed ? "Confirm rescheduled appointment" : "Confirm appointment"}</Button><Button variant="outline" onClick={onReload} disabled={busy}>Reload appointment</Button></div>
    {confirmed && <div className="space-y-3 border-t pt-4">{cancelReview ? <><p className="text-sm">Cancel this confirmed appointment? The maintenance need, owner approval, and uploaded files will remain.</p>{cancel.error && <AppointmentError error={cancel.error} />}<div className="flex flex-wrap gap-2"><Button variant="destructive" onClick={() => cancel.mutate()} disabled={busy}>{cancel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm appointment cancellation</Button><Button variant="outline" onClick={() => setCancelReview(false)} disabled={busy}>Keep appointment</Button></div></> : <Button variant="outline" onClick={() => setCancelReview(true)} disabled={busy}>Cancel appointment</Button>}</div>}
  </div>;
}
