import { useQuery } from '@tanstack/react-query';
import { authMeQueryFn, buildApiUrl } from '@/lib/queryClient';

export function TaskDriverSelect({ value, onChange }: { value: number | null | undefined; onChange: (id: number | null, name: string | null) => void }) {
  const auth = useQuery({ queryKey: ['/api/auth/me'], queryFn: authMeQueryFn, staleTime: 60_000 });
  const user = auth.data?.user;
  const employees = useQuery({ queryKey: ['/api/employees', 'driver-options', user?.id, user?.viewAsCoHost?.coHostId, user?.viewAsEmployee?.employeeId], enabled: !!user, queryFn: async () => {
    const response = await fetch(buildApiUrl('/api/employees?limit=1000'), { credentials: 'include' });
    if (!response.ok) throw new Error('Drivers could not be loaded. Reopen this task to retry.');
    const body = await response.json();
    return (body.data || []).filter((employee: any) => Number(employee.employee_is_active ?? 1) === 1 && !['offboarded', 'separated'].includes(employee.employee_status)) as { employee_aid: number; employee_first_name: string; employee_last_name: string }[];
  }, staleTime: 30_000, retry: false });
  return <div className="min-w-0">
    <label className="flex flex-col gap-1 text-sm"><span>Driver</span>
      <select aria-label="Task driver" className="h-11 w-full min-w-0 rounded-md border bg-white px-2 text-base sm:text-sm" value={value || ''} disabled={employees.isLoading || employees.isError} onChange={e => {
        const employee = employees.data?.find(employee => Number(employee.employee_aid) === Number(e.target.value));
        onChange(employee ? Number(employee.employee_aid) : null, employee ? [employee.employee_first_name, employee.employee_last_name].filter(Boolean).join(' ') : null);
      }}>
        <option value="">Select driver</option>
        {employees.data?.map(employee => <option key={employee.employee_aid} value={employee.employee_aid}>{[employee.employee_first_name, employee.employee_last_name].filter(Boolean).join(' ') || `Employee #${employee.employee_aid}`}</option>)}
      </select>
    </label>
    {employees.isError && <p role="alert" className="text-sm text-destructive">{employees.error.message}</p>}
  </div>;
}
