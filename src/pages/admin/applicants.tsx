import { SearchableNativeSelect } from '@/components/ui/searchable-native-select';
import {useMemo,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link} from 'wouter';
import {AdminLayout} from '@/components/admin/admin-layout';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {LycProgress} from '@/components/onboarding/LycProgress';
import {lycRequest} from '@/lib/lyc';

export default function Applicants(){
  const client=useQueryClient(),[search,setSearch]=useState(''),[status,setStatus]=useState('all'),[sort,setSort]=useState('progress');
  const [error,setError]=useState(''),[busy,setBusy]=useState<number|null>(null);
  const accounts=useQuery({queryKey:['/api/onboarding/applicants'],queryFn:()=>lycRequest('/api/onboarding/applicants'),refetchInterval:30000});
  const filtered=useMemo(()=>[...(accounts.data?.accounts || [])].filter((a:any)=>
    (status==='all'||a.stage.key===status)&&`${a.firstName} ${a.lastName} ${a.email} ${a.phone||''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a:any,b:any)=>sort==='name'?`${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`):sort==='newest'?new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime():sort==='activity'?new Date(b.lastActivityAt).getTime()-new Date(a.lastActivityAt).getTime():b.stage.rank-a.stage.rank),[accounts.data,search,status,sort]);
  const promote=async(id:number)=>{setBusy(id);setError('');try{await lycRequest(`/api/onboarding/submissions/${id}/activate-client`,'POST',{});await client.invalidateQueries({queryKey:['/api/onboarding/applicants']});await client.invalidateQueries({queryKey:['clients']});}catch(e:any){setError(e.message);}finally{setBusy(null);}};
  return <AdminLayout><div className="space-y-5 p-3 sm:p-6">
    <nav className="flex flex-wrap gap-2" aria-label="People directories"><Button asChild><Link href="/admin/applicants">Applicants</Link></Button><Button asChild variant="outline"><Link href="/admin/clients">Clients</Link></Button><Button asChild variant="outline"><Link href="/admin/co-hosts">Co-Hosts</Link></Button></nav>
    <div><h1 className="text-2xl font-semibold">Applicants</h1><p className="mt-1 text-sm text-muted-foreground">One account can have several vehicle applications. Closest to client access appears first. Approval and a signed contract are both required before an applicant moves to Clients.</p></div>
    <div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Search applicants" placeholder="Search name, email or phone…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <SearchableNativeSelect aria-label="Applicant status" className="h-11 rounded-md border bg-background px-3" value={status} onChange={e=>setStatus(e.target.value)}>{[['all','All statuses'],['ready','Ready for client access'],['contract','Awaiting signature'],['approved','Approved · contract next'],['review','Awaiting approval'],['pending_vehicle','Pending application · vehicle later'],['in_progress','Application in progress'],['attention','On hold / needs attention'],['created','Account created · not started']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</SearchableNativeSelect>
      <SearchableNativeSelect aria-label="Sort applicants" className="h-11 rounded-md border bg-background px-3" value={sort} onChange={e=>setSort(e.target.value)}><option value="progress">Closest to completion</option><option value="name">Name A–Z</option><option value="newest">Newest accounts</option><option value="activity">Recent activity</option></SearchableNativeSelect>
    </div>
    {(accounts.error||error)&&<p role="alert" className="text-destructive">{error||accounts.error?.message} <button onClick={()=>void accounts.refetch()}>Retry</button></p>}
    {accounts.isLoading?<p role="status">Loading applicants…</p>:<p className="text-sm text-muted-foreground">{filtered.length} applicant accounts</p>}
    {filtered.map((account:any)=><article key={account.id} className="rounded-xl border bg-background p-4">
      <details><summary className="cursor-pointer list-none"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{account.firstName} {account.lastName}</h2><p className="break-all text-sm text-muted-foreground">{account.email}</p><p className="mt-2 text-xs text-muted-foreground">Account created on {new Date(account.createdAt).toLocaleDateString()} · Last activity {new Date(account.lastActivityAt).toLocaleDateString()}</p></div><span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm">{account.stage.label}</span></div><p className="mt-3 text-sm">{account.applications.length} submitted · {account.drafts.length} saved plans · View vehicle applications ▾</p></summary>
      <div className="mt-4 space-y-4 border-t pt-4">
        <div className="flex flex-wrap gap-3 text-sm"><a className="underline" href={`mailto:${account.email}`}>Email {account.firstName}</a>{account.phone&&<a className="underline" href={`tel:${account.phone.replace(/[^\d+]/g,'')}`}>Call {account.phone}</a>}</div>
        {account.representative&&<p className="text-sm">Representative: {account.representative}</p>}
        {!account.applications.length&&!account.drafts.length&&<p className="text-sm">This person has created an account but has not started a vehicle application.</p>}
        {account.drafts.map((draft:any)=><div key={`d${draft.id}`} className="rounded-lg border p-3"><h3 className="font-medium">{[draft.fields.vehicleYear||draft.fields.plannedVehicleYear,draft.fields.vehicleMake||draft.fields.plannedVehicleMake,draft.fields.vehicleModel||draft.fields.plannedVehicleModel].filter(Boolean).join(' ')||`Vehicle plan #${draft.id}`}</h3><p className="mt-1 text-sm">{draft.pendingSubmittedAt?`Pending application submitted ${new Date(draft.pendingSubmittedAt).toLocaleDateString()} · Available for follow-up`:draft.hasVehicle===false?'Waiting for a vehicle':'Saved application'}</p><p className="mt-1 text-sm text-muted-foreground">{draft.pendingSubmittedAt?'Applicant must return and complete the vehicle information and remaining steps before approval.':'Not submitted for approval'}{draft.fields.acquisitionPlan&&` Plan: ${draft.fields.acquisitionPlan}.`}</p></div>)}
        {account.applications.map((app:any)=><div key={app.id} className="space-y-3 rounded-lg border p-3"><h3 className="font-medium">{app.vehicle} · Application #{app.id}</h3><LycProgress steps={app.steps}/><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/admin/forms?section=client-onboarding&item=lyc&submission=${app.id}`}>Review vehicle application</Link></Button>{app.steps[1].done&&app.steps[3].done&&<Button disabled={busy!==null} onClick={()=>void promote(app.id)}>{busy===app.id?'Updating access…':'Move account to Clients'}</Button>}</div></div>)}
      </div></details>
    </article>)}
    <p className="text-xs text-muted-foreground">Vehicle applications and car onboarding/offboarding remain under Forms. Clients can add more vehicles without creating another account.</p>
  </div></AdminLayout>;
}
