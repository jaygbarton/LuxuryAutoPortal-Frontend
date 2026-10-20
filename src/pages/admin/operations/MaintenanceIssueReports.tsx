import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildApiUrl, getProxiedImageUrl } from '@/lib/queryClient';
import { safeServiceFile } from '@/lib/serviceWorkspace';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

interface Report { id: number; trip_id: number | null; reservation_id: string | null; reported_at: string | null; task_description: string | null; notes: string | null; photos: string[] | string | null; assigned_to: string | null; }
function attachments(value: Report['photos']): string[] {
  try { const files = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(files) ? files.filter((file): file is string => typeof file === 'string' && safeServiceFile(file)) : []; } catch { return []; }
}
export function MaintenanceIssueReports({ maintenanceId }: { maintenanceId: number }) {
  const [open,setOpen] = useState(false);
  const { data,isPending,isError,refetch } = useQuery<{ reports: Report[]; tripCount: number }>({
    queryKey: ['/api/service-workspace/maintenance',maintenanceId,'reports'], enabled: open,
    queryFn: async () => { const response = await fetch(buildApiUrl(`/api/service-workspace/maintenance/${maintenanceId}/reports`),{ credentials: 'include' }); if (!response.ok) throw new Error('Reports could not be loaded.'); const result = await response.json(); if (!Array.isArray(result.reports)) throw new Error('Reports are incomplete.'); return result; },
  });
  return <section className="min-w-0 rounded-lg border border-primary/25 bg-primary/5 p-3" aria-label="Reports of this maintenance issue">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-medium">
      <span>Reports of this issue{data ? ` · ${data.reports.length} reports · ${data.tripCount} trips` : ''}</span><ChevronDown className={`h-4 w-4 shrink-0 ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="space-y-2 pt-2">{isError ? <p role="alert" className="text-xs text-destructive">Reports could not be loaded. <Button type="button" variant="ghost" onClick={() => refetch()}>Retry</Button></p> : isPending ? <p className="text-xs text-muted-foreground">Loading reports…</p> : data?.reports.map(report => <article key={report.id} className="min-w-0 rounded-md border bg-card p-3 text-xs">
      <p className="font-semibold">{report.trip_id ? `Trip ${report.reservation_id || `#${report.trip_id}`}` : 'Manual report'} · Report #{report.id}</p>
      <p className="mt-1 text-muted-foreground">Reported: {report.reported_at && Number.isFinite(Date.parse(report.reported_at)) ? new Date(report.reported_at).toLocaleString('en-US',{ timeZone: 'America/Denver', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not recorded'}{report.assigned_to ? ` · ${report.assigned_to}` : ''}</p>
      {report.task_description && <p className="mt-2 break-words">{report.task_description}</p>}{report.notes && <p className="mt-2 whitespace-pre-wrap break-words">{report.notes}</p>}
      <div className="flex flex-wrap gap-2">{attachments(report.photos).map((file,index) => <a key={`${file}:${index}`} className="inline-flex min-h-11 items-center underline" href={getProxiedImageUrl(file)} target="_blank" rel="noopener noreferrer">Report file {index+1}</a>)}</div>
    </article>)}</div>}
  </section>;
}
