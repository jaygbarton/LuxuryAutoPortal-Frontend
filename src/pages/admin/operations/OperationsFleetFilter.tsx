import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildApiUrl } from '@/lib/queryClient';
import { operationVehicleMatches, type OperationsFleetFilter, type OperationsVehicle } from '@/lib/operationsFleet';

const Context = createContext({ fleet: 'all' as OperationsFleetFilter, matches: (_row: any): boolean => true });

export function OperationsFleetProvider({ children, activeOnly = false, showFilter = true }: { children: ReactNode; activeOnly?: boolean; showFilter?: boolean }) {
  const [selectedFleet, setFleet] = useState<OperationsFleetFilter>('active');
  const fleet = activeOnly ? 'active' : selectedFleet;
  const query = useQuery<OperationsVehicle[]>({
    queryKey: ['/api/operations/fleet-vehicles'], staleTime: 15_000, refetchOnWindowFocus: 'always', refetchInterval: 60_000,
    queryFn: async () => {
      const response = await fetch(buildApiUrl('/api/operations/fleet-vehicles'), { credentials: 'include' });
      if (!response.ok) throw new Error('Vehicle status could not be loaded.');
      const body = await response.json();
      if (!Array.isArray(body.data) || body.data.some((car: any) => !Number.isSafeInteger(car.carId) || typeof car.carName !== 'string' || !('carStatus' in car))) throw new Error('Vehicle status response is incomplete.');
      return body.data;
    },
  });
  const value = useMemo(() => ({ fleet, matches: (row: any) => operationVehicleMatches(row, query.data ?? [], fleet) }), [fleet, query.data]);
  return <Context.Provider value={value}>
    {showFilter && <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="operations-fleet">Vehicles</label>
      {activeOnly ? <span>Active vehicles only</span> : <select id="operations-fleet" aria-label="Operations fleet" className="min-h-11 rounded-lg border bg-card px-3 sm:min-h-9" value={fleet} onChange={e => setFleet(e.target.value as OperationsFleetFilter)}>
        <option value="active">Active vehicles</option><option value="all">All vehicles / records</option><option value="inactive">Inactive vehicles</option>
      </select>}
      {fleet !== 'all' && query.isPending && <span role="status">Loading vehicle status…</span>}
      {fleet !== 'all' && query.isError && <span role="alert">Vehicle status could not be loaded. <button className="underline" onClick={() => void query.refetch()}>Retry</button>{!activeOnly && " or choose All vehicles to review records."}</span>}
      {!activeOnly && <span className="text-xs text-muted-foreground">Unmatched vehicle records can be reviewed under All vehicles / records.</span>}
    </div>}
    {(!showFilter || fleet === 'all' || query.data) && children}
  </Context.Provider>;
}

export const useOperationsFleet = () => useContext(Context);
export function useOperationFleetRows<T>(rows: T[], identify?: (row: T) => unknown): T[] {
  const { matches } = useOperationsFleet();
  return rows.filter(row => matches(identify ? identify(row) : row));
}
