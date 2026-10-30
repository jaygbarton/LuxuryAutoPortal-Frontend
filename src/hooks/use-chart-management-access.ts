import { useQuery } from '@tanstack/react-query';
import { authMeQueryFn,buildApiUrl } from '@/lib/queryClient';
export function useChartManagementAccess(){
  const auth=useQuery({queryKey:['/api/auth/me'],queryFn:authMeQueryFn,staleTime:60000});
  return useQuery<{canManage:boolean}>({queryKey:['/api/operations/chart-management/access',auth.data?.user?.id,auth.data?.user?.viewAsEmployee?.employeeId,auth.data?.user?.viewAsCoHost?.coHostId],
    enabled:!!auth.data?.user&&(auth.data.user.isAdmin||auth.data.user.isEmployee),retry:false,staleTime:15000,
    queryFn:async()=>{const r=await fetch(buildApiUrl('/api/operations/chart-management/access'),{credentials:'include'});if(!r.ok)throw new Error('Manager access could not be verified.');const value=await r.json();return{canManage:value.canManage===true};}});
}
