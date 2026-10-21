import type { QueryClient } from '@tanstack/react-query';
/** A report edit can change its group, service needs and vehicle history. */
export function invalidateMaintenanceReports(client: QueryClient) {
  const keys = new Set(['/api/operations/maintenance', '/api/service-workspace', '/api/service-workspace/cars', '/api/service-workspace/maintenance', '/api/internal-calendar/events']);
  return client.invalidateQueries({ predicate: query => keys.has(String(query.queryKey[0])) });
}
