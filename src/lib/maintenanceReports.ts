import { buildApiUrl } from "@/lib/queryClient";
import type { QueryClient } from '@tanstack/react-query';
/** A report edit can change its group, service needs and vehicle history. */
export function invalidateMaintenanceReports(client: QueryClient) {
  const keys = new Set(['/api/operations/maintenance', '/api/service-workspace', '/api/service-workspace/cars', '/api/service-workspace/maintenance', '/api/internal-calendar/events']);
  return client.invalidateQueries({ predicate: query => keys.has(String(query.queryKey[0])) });
}

/** Use the saved report identity; it may be inside an older reservation card. */
export function maintenanceMoveUrl(body: unknown): string {
  const rows = (body as { data?: unknown })?.data;
  if (!Array.isArray(rows) || !rows.length || rows.some(row => !Number.isSafeInteger(Number(row?.id)) || Number(row.id) <= 0)) {
    throw new Error('The saved maintenance reports could not be verified. Please retry.');
  }
  return `/admin/operations?tab=maintenance&report=${Number(rows[0].id)}`;
}

/** The filters run across the fleet, not just the first server page. */
export async function fetchMaintenanceRecords<T extends { id: number }>(params = new URLSearchParams(), signal?: AbortSignal): Promise<{ data: T[]; total: number }> {
  const data: T[] = [];
  const seen = new Set<number>();
  let total = 0, offset = 0;
  do {
    const page = new URLSearchParams(params);
    page.set('limit', '5000'); page.set('offset', String(offset));
    const response = await fetch(buildApiUrl(`/api/operations/maintenance?${page}`), { credentials: 'include', signal });
    if (!response.ok) throw new Error('Maintenance records could not be loaded. Please retry.');
    const body = await response.json();
    total = Number(body.total);
    if (!Array.isArray(body.data) || !Number.isSafeInteger(total) || total < 0 || body.data.some((row: T) => !Number.isSafeInteger(Number(row?.id)) || Number(row.id) <= 0)) throw new Error('The maintenance response is incomplete. Please retry.');
    let added = 0;
    for (const row of body.data as T[]) {
      const id = Number(row.id);
      if (!seen.has(id)) { data.push({ ...row, id }); seen.add(id); added++; }
    }
    offset += body.data.length;
    if (offset < total && !added) throw new Error('The maintenance list changed while loading. Please retry.');
  } while (offset < total);
  return { data, total: data.length };
}
