import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authMeQueryFn,buildApiUrl } from '@/lib/queryClient';
export type WorkspaceLocation='slc'|'wilmington';
export type WorkspaceContext={homeLocation:WorkspaceLocation;allowedLocations:WorkspaceLocation[];coHostScoped:boolean;impersonating:boolean};
export function useWorkspaceContext(){
 const auth=useQuery({queryKey:['/api/auth/me'],queryFn:authMeQueryFn,staleTime:60000});
 const identity=`${auth.data?.user?.id??''}:${auth.data?.user?.viewAsEmployee?.employeeId??''}:${auth.data?.user?.viewAsCoHost?.coHostId??''}`;
 const query=useQuery<WorkspaceContext>({queryKey:['/api/me/workspace-context',identity],enabled:!!auth.data?.user?.id,retry:false,staleTime:60000,
 queryFn:async()=>{const r=await fetch(buildApiUrl('/api/me/workspace-context'),{credentials:'include'});const data=await r.json();if(!r.ok||!['slc','wilmington'].includes(data.homeLocation)||!Array.isArray(data.allowedLocations))throw new Error('Home location could not be loaded.');return data;}});
 return{...query,identity};
}
export function useHomeDefaultFilter<T>(map:(location:WorkspaceLocation)=>T,fallback:T):[T,(value:T)=>void]{
 const context=useWorkspaceContext();const key=`${context.identity}:${context.data?.homeLocation??''}`;
 const [choice,setChoice]=useState<{key:string;value:T}|null>(null);
 const value=choice?.key===key?choice.value:context.data?map(context.data.homeLocation):fallback;
 return[value,(value:T)=>setChoice({key,value})];
}
