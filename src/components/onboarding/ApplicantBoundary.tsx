import type {ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Redirect} from 'wouter';
import {applicantUser} from '@/lib/lyc';
import {authMeQueryFn} from '@/lib/queryClient';
import {ServerReconnecting} from '@/components/auth/ServerReconnecting';
/** Do not mount the staff/client shell (or its queries) for restricted accounts. */
export function ApplicantBoundary({children}:{children:ReactNode}) {
  const auth=useQuery({queryKey:['/api/auth/me'],queryFn:authMeQueryFn});
  if(auth.isLoading) return <p className="p-6" role="status">Loading your account…</p>;
  if(auth.error && !auth.data) return <ServerReconnecting error={auth.error} isFetching={auth.isFetching} errorUpdateCount={auth.errorUpdateCount} onRetry={()=>void auth.refetch()}/>;
  return applicantUser(auth.data?.user)?<Redirect to="/lyc/status"/>:<>{children}</>;
}
