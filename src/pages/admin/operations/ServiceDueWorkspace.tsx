import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch, Link } from 'wouter';
import { CalendarDays, Car, ChevronDown, FileSpreadsheet, Paperclip, RefreshCw, Wrench } from 'lucide-react';
import { buildApiUrl } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CarPhotoCell } from '@/components/admin/dashboard/CarPhotoCell';
import { FleetCalendar } from '@/components/shared/FleetCalendar';
import { operationLocationMatches, useOperationLocationFilter } from './OperationLocationFilter';
import { serviceLabel, serviceDate, safeServiceFile, type ServiceItem, type ServiceCar, type ServiceHistory, type ServiceWorkspace } from '@/lib/serviceWorkspace';

async function request<T>(path: string, method = 'GET'): Promise<T> {
  const res = await fetch(buildApiUrl(path), { method, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || 'Service data could not be loaded.');
  return data;
}
function Status({ service }: { service: ServiceItem }) {
  const colors = service.status === 'overdue' ? 'border-red-200 bg-red-50 text-red-800' : ['due_today', 'due_soon'].includes(service.status) ? 'border-amber-200 bg-amber-50 text-amber-900' : service.status === 'no_data' ? 'border-border bg-muted text-muted-foreground' : 'border-primary/30 bg-primary/10 text-foreground';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${colors}`}>{serviceLabel(service)}</span>;
}
function History({ carId, filter }: { carId: number; filter?: string }) {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['/api/service-workspace/cars', carId, 'history'], queryFn: () => request<{ history: ServiceHistory[] }>(`/api/service-workspace/cars/${carId}/history`) });
  if (isPending) return <p className="text-sm text-muted-foreground">Loading service history & receipts…</p>;
  if (isError) return <p role="alert" className="text-sm text-destructive">History could not be loaded. <button className="underline" onClick={() => refetch()}>Retry</button></p>;
  const rows = data.history.filter(h => !filter || h.kind === (filter === 'registration' ? 'license_registration' : filter));
  return <div className="space-y-2"><h4 className="text-sm font-semibold">Service history & receipts/files</h4>{!rows.length && <p className="text-sm text-muted-foreground">No service history recorded.</p>}{rows.map(h => <article key={h.id} className="min-w-0 rounded-lg border border-border bg-white p-3 text-sm">
    <div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{h.label}</p><p>{serviceDate(h.date)}</p></div>
    <p className="mt-1 text-xs text-muted-foreground">{h.status.replace(/_/g, ' ')} · {h.dateBasis.replace(/_/g, ' ')}{h.amount !== null ? ` · $${h.amount.toFixed(2)}` : ''}</p>
    {h.notes && <p className="mt-2 whitespace-pre-wrap break-words">{h.notes}</p>}
    <div className="mt-2 flex flex-wrap gap-2">{h.files.filter(safeServiceFile).map((url, index) => <a key={`${url}:${index}`} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/30 px-3 text-xs font-medium"><Paperclip className="h-4 w-4" />Receipt / file {index + 1}</a>)}</div>
    {h.year && <Link href={`/admin/cars/${carId}/income-expense?year=${h.year}`} className="mt-2 inline-flex min-h-11 items-center text-xs underline">Open income & expenses</Link>}
  </article>)}</div>;
}
function SheetsPanel() {
  const { toast } = useToast(), client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const search = useSearch();
  const { data, isError } = useQuery({ queryKey: ['/api/service-workspace/sheets'], queryFn: () => request<{ connected: boolean; configured: boolean; canManage: boolean; url: string | null; lastSuccess: string | null; error: string | null }>('/api/service-workspace/sheets'), refetchInterval: 30_000 });
  const connect = async () => { setBusy(true); try { const result = await request<{ url: string }>('/api/service-workspace/sheets/connect', 'POST'); window.location.assign(result.url); } catch (e) { toast({ title: 'Google connection failed', description: (e as Error).message, variant: 'destructive' }); setBusy(false); } };
  const sync = async () => { setBusy(true); try { const result = await request<{ busy?: boolean }>('/api/service-workspace/sheets/sync', 'POST'); await client.invalidateQueries({ queryKey: ['/api/service-workspace/sheets'] }); toast({ title: result.busy ? 'Google Sheet sync is already running' : 'Google Sheet synchronized' }); } catch (e) { toast({ title: 'Sync needs attention', description: (e as Error).message, variant: 'destructive' }); } finally { setBusy(false); } };
  return <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm sm:p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-4 w-4" />Service Google Sheet</p><p className="mt-1 break-all text-xs text-muted-foreground">goldenluxuryauto@gmail.com · Software → Sheet</p></div><div className="flex flex-wrap gap-2">{data?.url && <a className="inline-flex min-h-11 items-center rounded-md border bg-white px-3 font-medium" href={data.url} target="_blank" rel="noopener noreferrer">Open Google Sheet</a>}{data?.canManage && <Button disabled={busy || !data.configured} variant="outline" onClick={connect}>{data.connected ? 'Reconnect Google' : 'Connect Google Sheet'}</Button>}{data?.canManage && data.connected && <Button disabled={busy} onClick={sync}><RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Sync now</Button>}</div></div>
    <p className="mt-2 text-xs text-muted-foreground">{isError ? 'Google Sheet status could not be loaded.' : !data ? 'Checking connection…' : !data.configured ? 'Google OAuth credentials must be configured on the server.' : !data.connected ? 'An admin must connect the Google account once.' : data.lastSuccess ? `Last synced: ${new Date(data.lastSuccess).toLocaleString()}. Automatically updates every 5 minutes.` : 'Connected; waiting for the first successful sync.'}</p>
    {(data?.error || new URLSearchParams(search).get('sheets') === 'connection_failed') && <p role="alert" className="mt-2 text-xs text-destructive">{data?.error || 'Google connection failed. Use goldenluxuryauto@gmail.com and grant Sheets access.'}</p>}
  </div>;
}
export function ServiceDueWorkspace({ editor, registrationEditor }: { editor: (car: ServiceCar, service: ServiceItem, saved: () => void) => ReactNode; registrationEditor: (car: ServiceCar, saved: () => void) => ReactNode }) {
  const client = useQueryClient(), location = useOperationLocationFilter();
  const params = new URLSearchParams(useSearch());
  const linkedCar = params.get('car');
  const [view, setView] = useState(() => { if (linkedCar) return 'cars'; try { const saved = localStorage.getItem('gla-service-due-view'); return saved && ['cars', 'services', 'calendar'].includes(saved) ? saved : 'cars'; } catch { return 'cars'; } });
  const [search, setSearch] = useState(''), [category, setCategory] = useState('all'), [status, setStatus] = useState('all');
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(linkedCar ? [Number(linkedCar)] : []));
  useEffect(() => { if (linkedCar) { setView('cars'); setExpanded(prev => new Set([...prev, Number(linkedCar)])); } }, [linkedCar]);
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['/api/service-workspace'], queryFn: () => request<ServiceWorkspace>('/api/service-workspace'), staleTime: 15_000, refetchInterval: 60_000 });
  const saved = () => { void client.invalidateQueries({ queryKey: ['/api/service-workspace'] }); void client.invalidateQueries({ queryKey: ['/api/service-workspace/cars'] }); void client.invalidateQueries({ queryKey: ['/api/internal-calendar/events'] }); };
  const changeView = (next: string) => { setView(next); try { localStorage.setItem('gla-service-due-view', next); } catch {} };
  const cars = useMemo(() => (data?.cars ?? []).filter(car => (!linkedCar || car.car_id === Number(linkedCar)) && operationLocationMatches(location, [car.locationTag, car.car_name, car.car_plate, car.car_vin]) && [car.car_name, car.car_plate, car.car_vin].join(' ').toLowerCase().includes(search.toLowerCase()) && (status === 'all' || car.car_status === status) && (category === 'all' || car.services.some(s => s.kind === category))), [data, location, search, status, category, linkedCar]);
  const services = cars.flatMap(car => car.services.filter(service => (category === 'all' || service.kind === category) && service.status !== 'not_applicable').map(service => ({ car, service }))).sort((a, b) => (a.service.daysUntil ?? Infinity) - (b.service.daysUntil ?? Infinity) || Number(a.service.status === "no_data") - Number(b.service.status === "no_data") || a.car.car_name.localeCompare(b.car.car_name) || a.service.label.localeCompare(b.service.label));
  const toggle = (id: number) => setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return <div className="min-w-0 space-y-4" data-testid="service-due-workspace">
    <div><h1 className="text-xl font-semibold">Service Due</h1><p className="mt-1 text-sm text-muted-foreground">Overdue first, then the next services due. Missing service dates appear last.</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Service Due views">{[['cars', 'By car', Car], ['services', 'By service', Wrench], ['calendar', 'Service calendar', CalendarDays]].map(([id, label, Icon]) => { const ViewIcon = Icon as typeof Car; return <Button key={String(id)} variant={view === id ? 'default' : 'outline'} aria-pressed={view === id} className="min-h-11" onClick={() => changeView(String(id))}><ViewIcon className="mr-2 h-4 w-4" />{String(label)}</Button>; })}</div>
    <SheetsPanel />
    {view === 'calendar' ? <FleetCalendar calendarScope="services" embedded /> : <>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3"><Input aria-label="Search service vehicles" placeholder="Search vehicle, plate or VIN…" value={search} onChange={e => setSearch(e.target.value)} className="h-11" /><select aria-label="Service type" className="h-11 min-w-0 rounded-md border border-input bg-white px-3 text-sm" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All services</option>{data?.rules.map(r => <option key={r.kind} value={r.kind}>{r.label}</option>)}<option value="registration">Registration expiration</option></select><select aria-label="Vehicle status" className="h-11 rounded-md border border-input bg-white px-3 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All vehicle statuses</option><option value="ACTIVE">Active vehicles</option><option value="INACTIVE">Inactive vehicles</option></select></div>
      {linkedCar && <Link href="/admin/operations?tab=service-due" className="inline-flex min-h-11 items-center text-sm underline">Show all cars</Link>}
      <p className="text-xs text-muted-foreground">Due dates use the existing calendar-day intervals (oil 90 days; tires, brakes and mechanic 180; license renewal 365). Windshield work is as needed. These are reminders, not scheduled appointments.</p>
      {isPending ? <p>Loading services…</p> : isError ? <p role="alert" className="text-destructive">Service Due could not be loaded. <button className="underline" onClick={() => refetch()}>Retry</button></p> : !cars.length ? <p className="py-8 text-center text-muted-foreground">No vehicles match these filters.</p> : view === 'cars' ? <div className="space-y-3">{cars.map(car => <article key={car.car_id} className="overflow-hidden rounded-xl border border-border bg-card">
        <button className="flex min-h-20 w-full items-center gap-3 p-3 text-left sm:p-4" aria-expanded={expanded.has(car.car_id)} aria-controls={`service-car-${car.car_id}`} onClick={() => toggle(car.car_id)}><CarPhotoCell carPhoto={car.car_photo} carName={car.car_name} /><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold sm:text-base">{car.car_name}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{car.car_plate || 'No plate'} · {car.car_status} · {car.locationTag || 'No location'}</p><p className="mt-1 break-all text-xs text-muted-foreground">VIN: {car.car_vin || 'No Data'}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs font-medium">{car.nextService?.label || 'No service dates recorded'}</span>{car.nextService && <Status service={car.nextService} />}</div></div><ChevronDown className={`h-5 w-5 shrink-0 ${expanded.has(car.car_id) ? 'rotate-180' : ''}`} /></button>
        {expanded.has(car.car_id) && <div id={`service-car-${car.car_id}`} className="space-y-4 border-t border-border bg-muted/20 p-3 sm:p-4"><p className="text-sm">Last serviced: <strong>{serviceDate(car.last_any_service)}</strong></p><div className="grid grid-cols-1 gap-2 lg:grid-cols-2">{car.services.filter(s => category === 'all' || s.kind === category).map(service => <div key={service.id} className="rounded-lg border bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{service.label}</span><Status service={service} /></div><p className="mt-2 text-xs text-muted-foreground">Last serviced: {serviceDate(service.lastServiced)}</p><div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">Due: {service.status === 'as_needed' ? 'As needed' : service.status === 'not_applicable' ? 'Not applicable' : serviceDate(service.dueDate)}{service.kind === 'registration' ? registrationEditor(car, saved) : editor(car, service, saved)}</div></div>)}</div><History carId={car.car_id} /></div>}
      </article>)}</div> : <div className="space-y-2">{services.map(({ car, service }) => <details key={service.id} className="rounded-xl border border-border bg-card"><summary className="min-h-16 cursor-pointer p-3 sm:p-4"><span className="inline-flex max-w-full flex-wrap items-center gap-2"><strong className="text-sm">{service.label} · {car.car_name}</strong><span className="text-xs text-muted-foreground">{car.car_plate}</span><Status service={service} /></span><p className="mt-2 text-xs text-muted-foreground">Due {serviceDate(service.dueDate)} · Last serviced {serviceDate(service.lastServiced)}</p></summary><div className="space-y-3 border-t border-border p-3"><div>{service.kind === 'registration' ? registrationEditor(car, saved) : editor(car, service, saved)}</div><History carId={car.car_id} filter={service.kind} /></div></details>)}</div>}
    </>}
  </div>;
}
