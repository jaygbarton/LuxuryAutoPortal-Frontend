import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildApiUrl } from '@/lib/queryClient';
import { useTimezone } from '@/hooks/use-timezone';
import { mtTodayKey } from '@/lib/mt-datetime';
import { useOperationLocationFilter } from './OperationLocationFilter';
import { Button } from '@/components/ui/button';

type DriverRow = { employeeId: number; name: string; total: number; receipts: number; pending: number; trips?: number; average?: number | null; unlinked?: number };
type Rankings = { parking: DriverRow[]; gas: DriverRow[] };
const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export function DayScheduleDriverRankings() {
  const timezone = useTimezone(), location = useOperationLocationFilter();
  const currentMonth = mtTodayKey(timezone).slice(0,7);
  const [month, setMonth] = useState(currentMonth);
  const from = `${month}-01`, [year, monthNumber] = month.split('-').map(Number);
  const to = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0,10);
  const query = useQuery<Rankings>({ queryKey: ['/api/operations/day-schedule/driver-rankings', month, location],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/operations/day-schedule/driver-rankings?${new URLSearchParams({ from, to, location })}`), { credentials: 'include' });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.parking) || !Array.isArray(result.gas)) throw new Error(result.error || 'Could not load driver charts.');
      return result;
    }, refetchInterval: 60_000, retry: false,
  });
  const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${from}T12:00:00Z`));
  return <aside className="min-w-0 space-y-3" aria-label="Driver receipt charts">
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">Driver receipt charts</h3>
      <label className="mt-3 block text-xs font-medium" htmlFor="driver-chart-month">Month</label>
      <input id="driver-chart-month" type="month" value={month} min="2000-01" max="2100-12"
        onChange={event => { if (/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value); }}
        className="mt-1 h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base sm:text-sm" />
      {month !== currentMonth && <Button variant="ghost" className="mt-1 h-11 w-full text-xs" onClick={() => setMonth(currentMonth)}>Current month</Button>}
      <p className="mt-2 text-xs text-muted-foreground">{label} · {location === 'all' ? 'All locations' : location === 'slc' ? 'SLC' : 'Wilmington'}</p>
      <p className="mt-1 text-xs text-muted-foreground">Car Drivers only. Submitted receipts, including pending approval; declined forms excluded.</p>
    </div>
    {query.isPending ? <p role="status" className="p-3 text-sm text-muted-foreground">Loading driver charts…</p> : query.isError ? <div role="alert" className="rounded-xl border p-4 text-sm">Driver charts could not be loaded. <Button variant="outline" className="mt-2 h-11" onClick={() => query.refetch()}>Retry driver charts</Button></div> : <>
      <Ranking title="Airport parking average" caption="Lowest average first · total parking cost ÷ trips" rows={query.data.parking} parking />
      <Ranking title="Gas reimbursed" caption="Highest submitted reimbursement total first" rows={query.data.gas} />
      {query.data.parking.some(row => row.unlinked) && <p className="px-1 text-xs text-muted-foreground">Forms without a linked trip count as one trip each.</p>}
    </>}
  </aside>;
}
function Ranking({ title, caption, rows, parking = false }: { title: string; caption: string; rows: DriverRow[]; parking?: boolean }) {
  const largest = Math.max(1, ...rows.map(row => parking ? row.average ?? 0 : row.total));
  return <section className="overflow-hidden rounded-xl border bg-card p-4" aria-label={title}>
    <h4 className="text-sm font-semibold">{title}</h4><p className="mb-3 mt-1 text-xs text-muted-foreground">{caption}</p>
    {!rows.length ? <p className="text-sm text-muted-foreground">No Car Drivers assigned yet. Set employee roles in HR → Employees → Job and Pay.</p> : <ol className="space-y-4">{rows.map((row, index) => <li key={row.employeeId} data-ranked-employee={row.employeeId} className="min-w-0">
      <div className="flex items-start justify-between gap-2 text-xs"><span className="min-w-0 break-words font-medium">{index + 1}. {row.name}</span><span className="shrink-0 font-semibold">{row.receipts ? money(parking ? row.average! : row.total) : 'No data'}</span></div>
      {row.receipts > 0 && <>
        <div className="my-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(1, (parking ? row.average ?? 0 : row.total) / largest * 100)}%` }} /></div>
        <p className="text-[11px] text-muted-foreground">{parking ? `${money(row.total)} ÷ ${row.trips} ${row.trips === 1 ? 'trip' : 'trips'}` : `${row.receipts} ${row.receipts === 1 ? 'receipt' : 'receipts'}`}{row.pending ? ` · ${row.pending} pending` : ''}</p>
      </>}
    </li>)}</ol>}
  </section>;
}
