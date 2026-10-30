import { useState } from 'react';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { useWorkspaceContext,type WorkspaceLocation } from '@/hooks/use-workspace-location';
import { buildApiUrl } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
export function HomeLocationPreferenceCard(){
 const context=useWorkspaceContext(),qc=useQueryClient();const[choice,setChoice]=useState<WorkspaceLocation|null>(null),[error,setError]=useState('');
 const save=useMutation({mutationFn:async()=>{const r=await fetch(buildApiUrl('/api/me/workspace-context'),{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({homeLocation:choice??context.data?.homeLocation})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Home location could not be saved.');return data;},onSuccess:async()=>{setError('');setChoice(null);await qc.invalidateQueries({queryKey:['/api/me/workspace-context']});},onError:(e:Error)=>setError(e.message)});
 return <section aria-label="Home location preference" className="rounded-xl border bg-card p-5"><h3 className="font-semibold">Home location</h3><p className="mt-1 text-sm text-muted-foreground">Your default location for the workspace. Changing a filter does not change which team you can access.</p>
 {context.isPending?<p>Loading home location…</p>:context.isError?<p role="alert">Home location could not be loaded.</p>:<div className="mt-3 flex flex-wrap gap-2"><select aria-label="Home location" value={choice??context.data?.homeLocation} disabled={context.data?.impersonating||save.isPending} className="h-11 rounded-md border bg-background px-3 text-base sm:text-sm" onChange={e=>setChoice(e.target.value as WorkspaceLocation)}>{context.data?.allowedLocations.map(loc=><option key={loc} value={loc}>{loc==='slc'?'Utah':'Wilmington'}</option>)}</select><Button className="h-11" disabled={save.isPending||context.data?.impersonating||!choice} onClick={()=>save.mutate()}>{save.isPending?'Saving…':'Save home location'}</Button></div>}
 {context.data?.impersonating&&<p className="mt-2 text-sm">Exit View as to update your own default.</p>}{error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
 </section>;
}
