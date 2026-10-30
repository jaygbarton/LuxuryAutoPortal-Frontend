import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildApiUrl } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type RoleData = { roles: string[]; options: string[] };
export function EmployeeOperationalRoles({ employeeId }: { employeeId: number }) {
  const [selected, setSelected] = useState<string[]>([]), [custom, setCustom] = useState('');
  const id = useId(), qc = useQueryClient(), { toast } = useToast();
  const key = ['/api/employees', employeeId, 'operational-roles'];
  const query = useQuery<RoleData>({ queryKey: key, queryFn: async () => {
    const response = await fetch(buildApiUrl(`/api/employees/${employeeId}/operational-roles`), { credentials: 'include' });
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.roles)) throw new Error(result.error || 'Could not load roles.');
    return result;
  } });
  useEffect(() => { if (query.data) setSelected(query.data.roles); }, [query.data]);
  const save = useMutation({ mutationFn: async () => {
    const response = await fetch(buildApiUrl(`/api/employees/${employeeId}/operational-roles`), {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roles: selected }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save roles.');
    return result as RoleData;
  }, onSuccess: result => {
    qc.setQueryData(key, result);
    void qc.invalidateQueries({ queryKey: ['/api/operations/day-schedule/driver-rankings'] });
    void qc.invalidateQueries({ queryKey: ['/api/operations/chart-management/access'] });
    void qc.invalidateQueries({ queryKey: ['/api/employees', employeeId, 'profile-edit-history'] });
    toast({ title: 'Employee roles saved' });
  }, onError: (error: Error) => toast({ title: 'Could not save roles', description: error.message, variant: 'destructive' }) });
  const options = [...new Set([...(query.data?.options ?? []), ...(query.data?.roles ?? []), ...selected])];
  return <section className="rounded-lg border border-border bg-card p-4" aria-label="Employee operational roles">
    <h3 className="font-semibold text-primary">Employee roles</h3>
    <p className="mt-1 text-xs text-muted-foreground">Choose all the work this employee does. Car Drivers appear in the Day Schedule receipt charts.</p>
    {query.isPending ? <p className="py-2 text-sm">Loading roles…</p> : query.isError ? <div role="alert" className="py-2 text-sm text-destructive">Roles could not be loaded. <Button variant="outline" onClick={() => query.refetch()}>Retry roles</Button></div> : <>
      <div className="my-3 flex flex-wrap gap-x-4 gap-y-1">{options.map((role, index) => <label key={role} htmlFor={`${id}-${index}`} className="flex min-h-11 items-center gap-2 text-sm">
        <input id={`${id}-${index}`} type="checkbox" checked={selected.includes(role)} disabled={save.isPending}
          onChange={event => setSelected(previous => event.target.checked ? [...previous, role] : previous.filter(r => r !== role))} className="h-4 w-4 accent-primary" />{role}
      </label>)}</div>
      <div className="flex min-w-0 gap-2"><input aria-label="Additional employee role" value={custom} onChange={event => setCustom(event.target.value)} maxLength={64} placeholder="Add another role" className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-base sm:text-sm" />
        <Button type="button" variant="outline" className="h-11" disabled={!custom.trim() || save.isPending || selected.length >= 20} onClick={() => { setSelected(previous => [...new Set([...previous, custom.trim()])]); setCustom(''); }}>Add role</Button>
      </div>
      <Button className="mt-3 h-11" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving roles…' : 'Save roles'}</Button>
    </>}
  </section>;
}
