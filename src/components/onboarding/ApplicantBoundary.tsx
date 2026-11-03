import type {ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Redirect} from 'wouter';
import {applicantUser,lycRequest} from '@/lib/lyc';
/** Do not mount the staff/client shell (or its queries) for restricted accounts. */
export function ApplicantBoundary({children}:{children:ReactNode}) {
  const auth=useQuery({queryKey:['/api/auth/me'],queryFn:()=>lycRequest('/api/auth/me')});
  if(auth.isLoading) return <p className="p-6" role="status">Loading your account…</p>;
  if(auth.error) return <div className="p-6" role="alert">Account access could not be checked. <button onClick={()=>void auth.refetch()}>Retry</button></div>;
  return applicantUser(auth.data?.user)?<Redirect to="/lyc/status"/>:<>{children}</>;
}
