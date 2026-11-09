import { SearchableNativeSelect } from '@/components/ui/searchable-native-select';
import { useQuery } from '@tanstack/react-query';
import { authMeQueryFn, buildApiUrl } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';

export type TaskDriverMode = 'employee' | 'uber' | 'na' | null;

export function TaskDriverSelect({ value, assignmentType, onChange, disabled = false }: {
  value: number | null | undefined;
  assignmentType?: string | null;
  disabled?: boolean;
  onChange: (mode: TaskDriverMode, id: number | null, name: string | null) => void;
}) {
  const auth = useQuery({ queryKey: ['/api/auth/me'], queryFn: authMeQueryFn, staleTime: 60_000 });
  const user = auth.data?.user;
  const employees = useQuery({ queryKey: ['/api/employees/picker', 'driver-options', user?.id, user?.viewAsCoHost?.coHostId, user?.viewAsEmployee?.employeeId], enabled: !!user, queryFn: async () => {
    // The HR employee-management endpoint is admin-only. This existing picker
    // supplies only active employee IDs/names and keeps the caller's team scope.
    const response = await fetch(buildApiUrl('/api/employees/picker'), { credentials: 'include' });
    if (!response.ok) throw new Error('Employee drivers could not be loaded.');
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error('Employee drivers could not be loaded.');
    const rows = body.data as { employee_aid: number; fullname: string }[];
    return [...rows].sort((a, b) => (a.fullname || '').localeCompare(b.fullname || '', undefined, { sensitivity: 'base' }));
  }, staleTime: 30_000, retry: false });
  const ownEmployee=useQuery<number|null>({queryKey:['/api/me/employee','driver-identity',user?.id,user?.viewAsEmployee?.employeeId,user?.viewAsCoHost?.coHostId],enabled:!!user,queryFn:async()=>{
    const response=await fetch(buildApiUrl('/api/me/employee'),{credentials:'include'});
    if(response.status===404)return null;
    if(!response.ok)throw new Error('Your employee identity could not be verified.');
    const body=await response.json();const id=Number(body.data?.employee_aid);
    if(!Number.isSafeInteger(id)||id<=0)throw new Error('Your employee identity could not be verified.');return id;
  },retry:false,staleTime:30_000});
  const identityReady=ownEmployee.isSuccess && !(user?.isEmployee && ownEmployee.data===null);
  const selected = assignmentType === 'uber' || assignmentType === 'na' ? assignmentType : value ? String(value) : '';
  return <div className="min-w-0">
    <label className="flex flex-col gap-1 text-sm"><span>Driver</span>
      <SearchableNativeSelect aria-label="Task driver" className="h-11 w-full min-w-0 rounded-md border bg-white px-2 text-base sm:text-sm" value={selected} disabled={disabled} onChange={e => {
        if(e.target.value===''){onChange(null,null,null);return;}
        if (e.target.value === 'uber' || e.target.value === 'na') { onChange(e.target.value, null, null); return; }
        if(!identityReady || Number(e.target.value)===ownEmployee.data)return;
        const employee = employees.data?.find(employee => Number(employee.employee_aid) === Number(e.target.value));
        onChange(employee ? 'employee' : null, employee ? Number(employee.employee_aid) : null, employee?.fullname || null);
      }}>
        <option value="">Select driver</option>
        <option value="uber">Uber</option>
        <option value="na">N/A</option>
        {employees.isLoading && <option disabled>Loading employee drivers…</option>}
        {employees.data?.filter(employee=>Number(employee.employee_aid)!==ownEmployee.data).map(employee => <option disabled={!identityReady} key={employee.employee_aid} value={employee.employee_aid}>{employee.fullname || `Employee #${employee.employee_aid}`}</option>)}
      </SearchableNativeSelect>
    </label>
    {!identityReady&&!ownEmployee.isPending&&<p role="alert" className="text-sm text-destructive">Your employee identity could not be verified. <button type="button" className="underline" onClick={()=>void ownEmployee.refetch()}>Retry identity</button></p>}
    {employees.isError && <div role="alert" className="mt-1 space-y-1 text-sm text-destructive"><p>Employee drivers could not be loaded. Retry the list, or select Uber or N/A if appropriate.</p><Button type="button" variant="outline" className="h-11" disabled={disabled || employees.isFetching} onClick={() => void employees.refetch()}>Retry drivers</Button></div>}
  </div>;
}
