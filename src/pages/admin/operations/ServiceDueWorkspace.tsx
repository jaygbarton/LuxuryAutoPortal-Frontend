import { MaintenanceIssueReports } from './MaintenanceIssueReports';
import { ServiceMileageReading } from '@/components/shared/ServiceMileageReading';
import { AddServiceRecordDialog } from './AddServiceRecordDialog';
import { ServiceReceiptViewer } from './ServiceReceiptViewer';
import { useEffect, useMemo, useState, Fragment, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch, useLocation, Link } from 'wouter';
import { CalendarDays, Car, ChevronDown, Download, FileSpreadsheet, Paperclip, RefreshCw, Wrench } from 'lucide-react';
import { buildApiUrl } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CarPhotoCell } from '@/components/admin/dashboard/CarPhotoCell';
import { FleetCalendar } from '@/components/shared/FleetCalendar';
import { operationLocationMatches, useOperationLocationFilter } from './OperationLocationFilter';
import { getProxiedImageUrl } from '@/lib/queryClient';
import { compareServiceUrgency, serviceLabel, serviceDate, safeServiceFile, type ServiceItem, type ServiceCar, type ServiceHistory, type ServiceWorkspace } from '@/lib/serviceWorkspace';

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
    {h.maintenanceId && (h.reportCount ?? 0) > 1 ? <MaintenanceIssueReports maintenanceId={h.maintenanceId} reportCount={h.reportCount} tripCount={h.reportTripCount} /> : h.notes && <p className="mt-2 whitespace-pre-wrap break-words">{h.notes}</p>}
    <div className="mt-2 flex flex-wrap gap-2">{h.files.filter(safeServiceFile).map((url, index) => <a key={`${url}:${index}`} href={getProxiedImageUrl(url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/30 px-3 text-xs font-medium"><Paperclip className="h-4 w-4" />Receipt / file {index + 1}</a>)}</div>
    {/^receipt:\d+$/.test(h.id) && <Link className="mt-2 mr-3 inline-flex min-h-11 items-center text-xs underline" href={`/admin/forms?section=employee-forms&category=cogs`}>Open service forms</Link>}
    {h.year && <Link href={`/admin/cars/${carId}/income-expense?year=${h.year}`} className="mt-2 inline-flex min-h-11 items-center text-xs underline">Open income & expenses</Link>}
  </article>)}</div>;
}
function ServiceGrid({ rows, editor, registrationEditor, licenseEditor, onSaved, onAddRecord, canOpenCarFiles }: {
  rows: { car: ServiceCar; service: ServiceItem }[];
  editor: (car: ServiceCar, service: ServiceItem, saved: () => void) => ReactNode;
  registrationEditor: (car: ServiceCar, saved: () => void) => ReactNode;
  licenseEditor: (car: ServiceCar, service: ServiceItem, saved: () => void) => ReactNode;
  onSaved: () => void;
  onAddRecord: (car: ServiceCar) => void;
  canOpenCarFiles?: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return <><p className="text-xs text-muted-foreground md:hidden">Swipe across the grid to see service dates, status, mileage and records.</p><div className="max-h-[70dvh] overflow-auto rounded-xl border border-border" role="region" aria-label="Service spreadsheet, scroll to view all columns" tabIndex={0}>
    <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-sm" aria-label="Service due spreadsheet">
      <thead className="sticky top-0 z-20 bg-muted">
        <tr>{['Vehicle', 'Service', 'Last serviced', 'Next due', 'Status', 'Current mileage', 'Records'].map((label, index) => <th key={label} scope="col" className={`border-b border-r border-border bg-muted px-3 py-3 text-xs font-semibold ${index === 0 ? 'sticky left-0 z-30 min-w-[220px]' : ''}`}>{label}</th>)}</tr>
      </thead>
      <tbody>{rows.map(({ car, service }) => <Fragment key={service.id}>
        <tr data-service-row className="group">
          <th scope="row" className="sticky left-0 z-10 max-w-[260px] border-b border-r border-border bg-white p-3 font-normal group-hover:bg-muted">
            <div className="flex min-w-0 items-center gap-3"><div className="shrink-0"><CarPhotoCell carPhoto={car.car_photo} carName={car.car_name} className="h-12 w-16" size={192} /></div><div className="min-w-0"><p className="break-words font-semibold">{car.car_name}</p><p className="mt-1 text-xs text-muted-foreground">{car.car_plate || 'No plate'}</p></div></div>
          </th>
          <td className="border-b border-r border-border bg-white p-3 group-hover:bg-muted/30">{service.label}</td>
          <td className="border-b border-r border-border bg-white p-3 group-hover:bg-muted/30"><div className="flex items-center gap-2"><span>{serviceDate(service.lastServiced)}</span>{service.kind !== 'registration' && editor(car, service, onSaved)}</div></td>
          <td className="border-b border-r border-border bg-white p-3 group-hover:bg-muted/30"><div className="flex items-center gap-2"><span>{service.status === 'as_needed' ? 'As needed' : serviceDate(service.dueDate)}</span>{service.kind === 'registration' && registrationEditor(car, onSaved)}{service.kind === 'license_registration' && licenseEditor(car, service, onSaved)}</div>{service.nextServiceOdometer != null && <p className="mt-1 text-xs text-muted-foreground">At {service.nextServiceOdometer.toLocaleString()} miles</p>}{service.milesRemaining != null && <p className="mt-1 text-xs text-muted-foreground">{Math.abs(service.milesRemaining).toLocaleString()} miles {service.milesRemaining < 0 ? 'overdue' : 'remaining'}</p>}</td>
          <td className="border-b border-r border-border bg-white p-3 group-hover:bg-muted/30"><Status service={service} />{service.mileageWarning && <p className="mt-1 max-w-52 text-xs text-amber-900">{service.mileageWarning}</p>}</td>
          <td className="min-w-[230px] border-b border-r border-border bg-white p-3 group-hover:bg-muted/30"><ServiceMileageReading reading={car.currentMileage} /></td>
          <td className="border-b border-border bg-white p-3 group-hover:bg-muted/30"><Button variant="outline" className="min-h-11 whitespace-nowrap" aria-expanded={expanded === service.id} aria-controls={`service-grid-details-${service.id}`} onClick={() => setExpanded(expanded === service.id ? null : service.id)}>History &amp; files</Button></td>
        </tr>
        {expanded === service.id && <tr><td colSpan={7} id={`service-grid-details-${service.id}`} className="border-b border-border bg-muted/20 p-3 sm:p-4"><div className="sticky left-0 max-w-[calc(100vw-3rem)] space-y-3 md:max-w-none"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{car.car_name} · {service.label}</p><div className="flex flex-wrap items-center gap-3">{canOpenCarFiles && <Link href={`/admin/cars/${car.car_id}/records`} className="inline-flex min-h-11 items-center underline">Open car Records &amp; Files</Link>}<Button className="min-h-11" onClick={() => onAddRecord(car)}>Add service record</Button></div></div><History carId={car.car_id} filter={service.kind} /></div></td></tr>}
      </Fragment>)}</tbody>
    </table>
  </div></>;
}
function LegacyServiceRecoveryPanel() {
  const { toast } = useToast();
  const { data, isError, refetch } = useQuery({ queryKey: ['/api/service-workspace/legacy'], queryFn: () => request<{ status: string; records: number; vehicles: number; canRecover: boolean; carFiles?: { records: number; files: number; pending: number; needReview: number } | null; error?: string; summary?: { scanned: number; skippedVehicle: number; unresolvedFiles: number; unsupportedTables: string[] } }>('/api/service-workspace/legacy'), refetchInterval: query => query.state.data?.status === 'processing' || query.state.data?.carFiles?.pending ? 10_000 : 60_000 });
  const [busy, setBusy] = useState(false);
  async function recover() { setBusy(true); try { await request('/api/service-workspace/legacy/recover','POST'); await refetch(); } catch (error) { toast({ title: 'Recovery could not start', description: (error as Error).message, variant: 'destructive' }); } finally { setBusy(false); } }
  return <details className="rounded-xl border bg-card p-3 text-sm">
    <summary className="cursor-pointer font-medium">Legacy service recovery · {isError ? 'Could not load status' : !data ? 'Checking…' : `${data.records} records · ${data.vehicles} current vehicles · ${data.status === 'ready' ? 'scan complete' : data.status.replace(/_/g,' ')}`}</summary>
    <p className="mt-2 text-xs text-muted-foreground">Only uniquely matched full VINs in the current fleet are imported. Recovered service details and receipts are added to each car’s Records &amp; Files. Original amounts remain historical and do not create new expenses. Unconfirmed dates/statuses remain labelled.</p>
    {data?.carFiles && <p className="mt-2 text-xs text-muted-foreground">Car Records &amp; Files: {data.carFiles.records} records · {data.carFiles.files} receipts/files copied · {data.carFiles.pending} pending · {data.carFiles.needReview} need source or destination access review.</p>}
    {data?.carFiles === null && <p className="mt-2 text-xs text-amber-900">Car-file integration status is unavailable. Recovered service history remains accessible.</p>}
    {data?.summary && <p className="mt-2 text-xs text-muted-foreground">{data.summary.scanned} rows reviewed · {data.summary.skippedVehicle} unmatched or off-fleet rows skipped · {data.summary.unresolvedFiles} unresolved file references · {data.summary.unsupportedTables?.length || 0} source tables need review.</p>}
    {!!data?.summary?.unsupportedTables?.length && <p className="mt-2 break-words text-xs text-amber-900">Tables needing review: {data.summary.unsupportedTables.join(', ')}</p>}
    {data?.error && <p className="mt-2 text-xs text-destructive" role="alert">{data.error}</p>}
    {data?.canRecover && <Button className="mt-2 min-h-11" variant="outline" disabled={busy || data.status === 'processing'} onClick={recover}>{busy ? 'Starting…' : 'Scan uploaded backups again'}</Button>}
    {isError && <Button variant="outline" className="mt-2" onClick={() => refetch()}>Retry status</Button>}
  </details>;
}
function ExportServiceData() {
  const { toast } = useToast();
  const [busy,setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const response = await fetch(buildApiUrl('/api/service-workspace/export'),{ credentials: 'include' });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || 'The service export could not be downloaded.'); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)/i)?.[1] || 'GLA-Service-Due.xlsx';
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url),30_000);
    } catch (error) { toast({ title: 'Export could not be downloaded',description: error instanceof Error ? error.message : 'Please retry.',variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return <Button variant="outline" onClick={download} disabled={busy} className="min-h-11" title="Download all active fleet vehicles, services, history and receipt links, regardless of search filters."><Download className="mr-2 h-4 w-4" />{busy ? 'Preparing export…' : 'Export all data'}</Button>;
}
function SheetsPanel() {
  const { toast } = useToast(), client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const search = useSearch();
  const { data, isError } = useQuery({ queryKey: ['/api/service-workspace/sheets'], queryFn: () => request<{ connected: boolean; configured: boolean; canManage: boolean; url: string | null; lastSuccess: string | null; error: string | null }>('/api/service-workspace/sheets'), refetchInterval: 30_000 });
  const connect = async () => { setBusy(true); try { const result = await request<{ url: string }>('/api/service-workspace/sheets/connect', 'POST'); window.location.assign(result.url); } catch (e) { toast({ title: 'Google connection failed', description: (e as Error).message, variant: 'destructive' }); setBusy(false); } };
  const sync = async () => { setBusy(true); try { const result = await request<{ busy?: boolean }>('/api/service-workspace/sheets/sync', 'POST'); await client.invalidateQueries({ queryKey: ['/api/service-workspace/sheets'] }); toast({ title: result.busy ? 'Google Sheet sync is already running' : 'Google Sheet synchronized' }); } catch (e) { toast({ title: 'Sync needs attention', description: (e as Error).message, variant: 'destructive' }); } finally { setBusy(false); } };
  return <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm sm:p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-4 w-4" />Service Google Sheet</p><p className="mt-1 break-all text-xs text-muted-foreground">goldenluxuryauto@gmail.com · Software → Sheet</p></div><div className="flex flex-wrap gap-2"><ExportServiceData />{data?.url && <a className="inline-flex min-h-11 items-center rounded-md border bg-white px-3 font-medium" href={data.url} target="_blank" rel="noopener noreferrer">Open Google Sheet</a>}{data?.canManage && <Button disabled={busy || !data.configured} variant="outline" onClick={connect}>{data.connected ? 'Reconnect Google' : 'Connect Google Sheet'}</Button>}{data?.canManage && data.connected && <Button disabled={busy} onClick={sync}><RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Sync now</Button>}</div></div>
    <p className="mt-2 text-xs text-muted-foreground">{isError ? 'Google Sheet status could not be loaded.' : !data ? 'Checking connection…' : !data.configured ? 'Google OAuth credentials must be configured on the server.' : !data.connected ? 'An admin must connect the Google account once.' : data.lastSuccess ? `Last synced: ${new Date(data.lastSuccess).toLocaleString()}. Automatically updates every 5 minutes.` : 'Connected; waiting for the first successful sync.'}</p>
    {(data?.error || new URLSearchParams(search).get('sheets') === 'connection_failed') && <p role="alert" className="mt-2 text-xs text-destructive">{data?.error || 'Google connection failed. Use goldenluxuryauto@gmail.com and grant Sheets access.'}</p>}
  </div>;
}
export function ServiceDueWorkspace({ editor, registrationEditor, licenseEditor }: { editor: (car: ServiceCar, service: ServiceItem, saved: () => void) => ReactNode; registrationEditor: (car: ServiceCar, saved: () => void) => ReactNode; licenseEditor: (car: ServiceCar, service: ServiceItem, saved: () => void) => ReactNode }) {
  const client = useQueryClient(), location = useOperationLocationFilter();
  const [,setLocation] = useLocation();
  const params = new URLSearchParams(useSearch());
  const linkedCar = params.get('car');
  const [view, setView] = useState(() => { if (linkedCar) return 'cars'; try { const saved = localStorage.getItem('gla-service-due-view'); return saved && ['cars', 'services', 'calendar'].includes(saved) ? saved : 'cars'; } catch { return 'cars'; } });
  const [recordCar, setRecordCar] = useState<ServiceCar | null>(null);
  const [search, setSearch] = useState(''), [category, setCategory] = useState('all');
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(linkedCar ? [Number(linkedCar)] : []));
  useEffect(() => { if (linkedCar) { setView('cars'); setExpanded(prev => new Set([...prev, Number(linkedCar)])); } }, [linkedCar]);
  const { data, error, isPending, isError, refetch } = useQuery({ queryKey: ['/api/service-workspace'], queryFn: () => request<ServiceWorkspace>('/api/service-workspace'), staleTime: 15_000, refetchInterval: 60_000 });
  const saved = () => { void client.invalidateQueries({ queryKey: ['/api/service-workspace'] }); void client.invalidateQueries({ queryKey: ['/api/service-workspace/cars'] }); void client.invalidateQueries({ queryKey: ['/api/internal-calendar/events'] }); };
  const changeView = (next: string) => { setView(next); try { localStorage.setItem('gla-service-due-view', next); } catch {} };
  const cars = useMemo(() => (data?.cars ?? []).filter(car => car.car_status === 'ACTIVE' && (!linkedCar || car.car_id === Number(linkedCar)) && operationLocationMatches(location, [car.locationTag, car.car_name, car.car_plate, car.car_vin]) && [car.car_name, car.car_plate, car.car_vin].join(' ').toLowerCase().includes(search.toLowerCase()) && (category === 'all' || car.services.some(s => s.kind === category))), [data, location, search, category, linkedCar]);
  const services = cars.flatMap(car => car.services.filter(service => (category === 'all' || service.kind === category) && service.status !== 'not_applicable').map(service => ({ car, service }))).sort((a,b) => compareServiceUrgency(a.service,b.service) || a.car.car_name.localeCompare(b.car.car_name));
  const toggle = (id: number) => setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return <div className="min-w-0 space-y-4" data-testid="service-due-workspace">
    <div><h1 className="text-xl font-semibold">Service Due</h1><p className="mt-1 text-sm text-muted-foreground">Overdue first, then the next services due. Missing service dates appear last.</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Service Due views">{[['cars', 'By car', Car], ['services', 'By service', Wrench], ['calendar', 'Service calendar', CalendarDays]].map(([id, label, Icon]) => { const ViewIcon = Icon as typeof Car; return <Button key={String(id)} variant={view === id ? 'default' : 'outline'} aria-pressed={view === id} className="min-h-11" onClick={() => changeView(String(id))}><ViewIcon className="mr-2 h-4 w-4" />{String(label)}</Button>; })}</div>
    <SheetsPanel />
    {params.get('receipt') && params.get('file') && <ServiceReceiptViewer carId={Number(linkedCar)} recordId={params.get('receipt')!} fileKey={params.get('file')!} onClose={() => {
      const next = new URLSearchParams(params); next.delete('receipt'); next.delete('file'); setLocation(`${window.location.pathname}?${next}`,{ replace: true });
    }} />}
    <LegacyServiceRecoveryPanel />
    {view === 'calendar' ? <FleetCalendar calendarScope="services" embedded activeVehiclesOnly /> : <>
      <div className={`grid min-w-0 grid-cols-1 gap-2 ${view === 'cars' ? 'sm:grid-cols-2' : ''}`}>
        <Input aria-label="Search service vehicles" placeholder="Search vehicle, plate or VIN…" value={search} onChange={e => setSearch(e.target.value)} className="h-11" />
        {view === 'cars' && <select aria-label="Service type" className="h-11 min-w-0 rounded-md border border-input bg-white px-3 text-sm" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All services</option>{data?.rules.map(r => <option key={r.kind} value={r.kind}>{r.label}</option>)}<option value="registration">Registration expiration</option></select>}
      </div>
      {view === 'services' && <div role="group" aria-label="Service categories" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1">
        {[{ kind: 'all', label: 'All services' }, ...(data?.rules ?? []), { kind: 'registration', label: 'Registration expiration' }].map(rule => <Button key={rule.kind} aria-pressed={category === rule.kind} variant={category === rule.kind ? 'default' : 'ghost'} className="min-h-11 shrink-0 whitespace-nowrap" onClick={() => setCategory(rule.kind)}>{rule.kind === 'reported_service' ? 'Reported service' : rule.label}</Button>)}
      </div>}
      <p className="text-xs text-muted-foreground">Active vehicles only.</p>
      {linkedCar && <Link href="/admin/operations?tab=service-due" className="inline-flex min-h-11 items-center text-sm underline">Show all cars</Link>}
      <p className="text-xs text-muted-foreground">Oil changes use the existing 90-day reminder or a recorded mileage target. Brakes, towing, battery, mechanic work, tires, lost keys and windshield work are as needed; their reported dates are not deadlines. Only a confirmed appointment gives those services a due date. License and registration require a known due or expiration date. Explicit next-service dates or mileage limits still apply. These are reminders, not scheduled appointments.</p>
      {isPending ? <p>Loading services…</p> : isError ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>Service Due could not be loaded. <button className="underline" onClick={() => refetch()}>Retry</button></p><p className="break-words">{error instanceof Error ? error.message : 'The service request failed.'}</p></div> : !cars.length ? <p className="py-8 text-center text-muted-foreground">No vehicles match these filters.</p> : view === 'cars' ? <div className="space-y-3">{cars.map(car => <article key={car.car_id} className="overflow-hidden rounded-xl border border-border bg-card">
        <button className="flex min-h-20 w-full items-center gap-3 p-3 text-left sm:p-4" aria-expanded={expanded.has(car.car_id)} aria-controls={`service-car-${car.car_id}`} onClick={() => toggle(car.car_id)}><CarPhotoCell carPhoto={car.car_photo} carName={car.car_name} /><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold sm:text-base">{car.car_name}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{car.car_plate || 'No plate'} · {car.car_status} · {car.locationTag || 'No location'}</p><p className="mt-1 break-all text-xs text-muted-foreground">VIN: {car.car_vin || 'No Data'}</p><ServiceMileageReading reading={car.currentMileage} /><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs font-medium">{car.nextService?.label || 'No service deadline set'}</span>{car.nextService && <Status service={car.nextService} />}</div></div><ChevronDown className={`h-5 w-5 shrink-0 ${expanded.has(car.car_id) ? 'rotate-180' : ''}`} /></button>
        {expanded.has(car.car_id) && <div id={`service-car-${car.car_id}`} className="space-y-4 border-t border-border bg-muted/20 p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">Last serviced: <strong>{serviceDate(car.last_any_service)}</strong></p><div className="flex flex-wrap items-center gap-2">{data?.canOpenCarFiles && <Link href={`/admin/cars/${car.car_id}/records`} className="inline-flex min-h-11 items-center text-sm underline">Open car Records &amp; Files</Link>}<Button className="min-h-11" onClick={() => setRecordCar(car)}>Add service record</Button></div></div><div className="grid grid-cols-1 gap-2 lg:grid-cols-2">{car.services.filter(s => category === 'all' || s.kind === category).map(service => <div key={service.id} className="rounded-lg border bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{service.label}</span><Status service={service} /></div><div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">Last serviced: {serviceDate(service.lastServiced)}{service.kind !== 'registration' && editor(car, service, saved)}</div>{(service.nextServiceOdometer != null || service.milesUntilNext != null) && <p className="mt-1 text-xs text-muted-foreground">{service.nextServiceOdometer != null ? `Next service at ${service.nextServiceOdometer.toLocaleString()} miles` : `Next service after ${service.milesUntilNext?.toLocaleString()} miles`}{service.odometerAtService != null ? ` · Recorded at ${service.odometerAtService.toLocaleString()} miles` : ''}</p>}<div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">{service.milesRemaining != null ? `${service.milesRemaining < 0 ? 'Overdue by' : 'At last reading'} ${Math.abs(service.milesRemaining).toLocaleString()} miles${service.milesRemaining >= 0 ? ' to service' : ''} · ` : ''}Due date: {service.status === 'as_needed' ? 'As needed' : service.status === 'not_applicable' ? 'Not applicable' : serviceDate(service.dueDate)}{service.kind === 'registration' ? registrationEditor(car, saved) : service.kind === 'license_registration' ? licenseEditor(car, service, saved) : null}</div>{service.mileageWarning && <p className="mt-2 text-xs text-amber-900">{service.mileageWarning}</p>}</div>)}</div><History carId={car.car_id} /></div>}
      </article>)}</div> : <ServiceGrid rows={services} editor={editor} registrationEditor={registrationEditor} licenseEditor={licenseEditor} onSaved={saved} onAddRecord={setRecordCar} canOpenCarFiles={data?.canOpenCarFiles} />}
    </>}
    {recordCar && <AddServiceRecordDialog car={recordCar} onClose={() => setRecordCar(null)} onSaved={saved} />}
  </div>;
}
