import type {ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Redirect} from 'wouter';
import {applicantUser} from '@/lib/lyc';
import {authMeQueryFn} from '@/lib/queryClient';
/** Do not mount the staff/client shell (or its queries) for restricted accounts. */
export function ApplicantBoundary({children}:{children:ReactNode}) {
  const auth=useQuery({queryKey:['/api/auth/me'],queryFn:authMeQueryFn});
  if(auth.isLoading) return <p className="p-6" role="status">Loading your account…</p>;
  if(auth.error && !auth.data) return <div className="p-6" role="alert">Account access could not be checked. <button onClick={()=>void auth.refetch()}>Retry</button></div>;
  return applicantUser(auth.data?.user)?<Redirect to="/lyc/status"/>:<>{children}</>;
}
