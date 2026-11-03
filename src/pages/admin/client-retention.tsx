import {useMemo,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link} from 'wouter';
import {AdminLayout} from '@/components/admin/admin-layout';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {buildApiUrl} from '@/lib/queryClient';
import {lycRequest} from '@/lib/lyc';

export default function ClientRetention(){
  const cache=useQueryClient(),[search,setSearch]=useState(''),[filter,setFilter]=useState('review'),[selected,setSelected]=useState<number|null>(null);
  const [reason,setReason]=useState(''),[decision,setDecision]=useState('keep'),[confirmation,setConfirmation]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const records=useQuery({queryKey:['/api/admin/client-retention'],queryFn:()=>lycRequest('/api/admin/client-retention')});
  const preview=useQuery({queryKey:['client-retention-preview',selected],enabled:selected!==null,queryFn:()=>lycRequest(`/api/admin/client-retention/${selected}/preview`)});
  const rows=useMemo(()=>(records.data?.records||[]).filter((r:any)=>
    (filter==='all'||filter==='requests'&&r.information_requested_at&&!r.information_fulfilled_at||filter==='kept'&&r.review_status==='kept'||filter==='review'&&!r.purged_at&&r.review_status!=='kept'||filter==='completed'&&!!r.purged_at)&&
    `${r.client_fname} ${r.client_lname} ${r.client_email}`.toLowerCase().includes(search.toLowerCase())),[records.data,search,filter]);
  const save=async()=>{setBusy(true);setMessage('');try{const result=await lycRequest(`/api/admin/client-retention/${selected}/decision`,'POST',{decision,reason,version:preview.data?.version,confirmation:Number(confirmation)});setMessage(result.message);await cache.invalidateQueries({queryKey:['/api/admin/client-retention']});setSelected(null);}catch(e:any){setMessage(e.message);}finally{setBusy(false);}};
  return <AdminLayout><div className="space-y-5 p-3 sm:p-6"><Button asChild variant="outline"><Link href="/admin/clients">← Client Database</Link></Button>
    <h1 className="text-2xl font-semibold">Client records retention</h1><p className="text-sm text-muted-foreground">Clients with no active vehicle for two years enter this review queue. Nothing is deleted automatically. A successful notice, at least three days to respond, and completion of any information request are required before removal.</p>
    <div className="grid gap-3 sm:grid-cols-2"><Input aria-label="Search retention records" placeholder="Search client name or email…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Retention view" className="h-11 rounded-md border bg-background px-3" value={filter} onChange={e=>setFilter(e.target.value)}><option value="review">Needs review</option><option value="requests">Information requested</option><option value="kept">Keep exceptions</option><option value="completed">Completed decisions</option><option value="all">All</option></select></div>
    {records.isLoading&&<p role="status">Loading retention records…</p>}{records.error&&<p role="alert">{records.error.message} <button onClick={()=>void records.refetch()}>Retry</button></p>}
    {!records.isLoading&&!records.error&&!rows.length&&<p className="rounded-lg border p-4">No clients match this retention view. Unknown inactivity dates are tracked from the first verified observation, not guessed from account age.</p>}
    {rows.map((row:any)=><article key={row.client_id} className="space-y-3 rounded-xl border p-4"><div><h2 className="font-semibold">{row.client_fname||'Removed client'} {row.client_lname}</h2><p className="break-all text-sm text-muted-foreground">{row.client_email} · Client #{row.client_id}</p></div><p className="text-sm">No active vehicle since {new Date(row.inactive_since).toLocaleDateString()} · {row.notice_sent_at?`Notice sent ${new Date(row.notice_sent_at).toLocaleDateString()}`:'Notice not sent — removal blocked'}</p>
      {row.review_status==='kept'&&<p className="rounded border border-primary/30 bg-primary/10 p-3 text-sm">Keep exception: {row.decision_reason}</p>}
      {row.information_requested_at&&!row.information_fulfilled_at&&<div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3"><p className="font-medium">Information requested — removal paused</p><p className="text-sm whitespace-pre-wrap">{row.information_request}</p><Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{const result=await lycRequest(`/api/admin/client-retention/${row.client_id}/fulfilled`,'POST',{});setMessage(result.message);await records.refetch();}catch(e:any){setMessage(e.message);}finally{setBusy(false);}}}>Mark information provided</Button></div>}
      {row.purged_at&&<div className="space-y-2"><p className="text-sm">Decision: {row.review_status} · {row.decision_reason}</p>{row.review_status==='retain_financial'&&<RetainedContracts clientId={row.client_id}/>}</div>}
      {!row.purged_at&&<Button variant="outline" onClick={()=>{setSelected(row.client_id);setReason('');setDecision('keep');setConfirmation('');setMessage('');}}>Review retention options</Button>}
      {selected===row.client_id&&<div className="space-y-3 border-t pt-4">{preview.isLoading?<p>Inspecting linked records…</p>:preview.error?<p role="alert">{preview.error.message}</p>:<>
        <p className="text-sm">{preview.data?.scope}</p><ul className="list-disc space-y-1 pl-5 text-sm">{preview.data?.groups.map((group:any)=><li key={group.table}>{group.table}: {group.count} records · {group.kind}</li>)}</ul>
        {!![...(preview.data?.blockers||[]),...(preview.data?.decisionBlockers?.[decision]||[])].length&&<div role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm"><p className="font-semibold">Removal needs review</p><ul className="list-disc pl-5">{[...(preview.data?.blockers||[]),...(preview.data?.decisionBlockers?.[decision]||[])].map((text:string)=><li key={text}>{text}</li>)}</ul></div>}
        <label className="block text-sm">Decision<select className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={decision} onChange={e=>setDecision(e.target.value)}><option value="keep">Keep everything — record an exception</option><option value="retain_financial">Remove personal information; keep financials and contracts</option><option value="delete_all">Delete all eligible software records</option></select></label>
        <label className="block text-sm">Reason<textarea className="mt-1 min-h-24 w-full rounded-md border p-3" maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        {decision!=='keep'&&<label className="block text-sm">Enter client ID {row.client_id} to confirm this removal<Input className="mt-1" value={confirmation} onChange={e=>setConfirmation(e.target.value)} inputMode="numeric"/></label>}
        <Button disabled={busy||!reason.trim()||(decision!=='keep'&&(Number(confirmation)!==row.client_id||!!preview.data?.blockers?.length||!!preview.data?.decisionBlockers?.[decision]?.length))} onClick={()=>void save()}>{busy?'Saving…':decision==='keep'?'Save keep exception':'Apply reviewed removal'}</Button>
      </>}</div>}
    </article>)}
    {message&&<p role="status" className="rounded-lg border p-4">{message}</p>}
  </div></AdminLayout>;
}

function RetainedContracts({clientId}:{clientId:number}){
  const [open,setOpen]=useState(false);
  const records=useQuery({queryKey:['retained-contracts',clientId],enabled:open,queryFn:()=>lycRequest(`/api/admin/client-retention/${clientId}/contracts`)});
  const fileLink=(url:string)=>url.startsWith('https://storage.googleapis.com/')?buildApiUrl(`/api/gcs-image-proxy?url=${encodeURIComponent(url)}`):/^https:\/\//.test(url)?url:/^\/(?!\/)/.test(url)?buildApiUrl(url):null;
  return <div className="space-y-2"><Button variant="outline" onClick={()=>setOpen(!open)}>{open?'Hide retained contracts':'View retained contracts'}</Button>{open&&(records.isLoading?<p>Loading retained contracts…</p>:records.error?<p role="alert">{records.error.message}</p>:<ul className="space-y-2 text-sm">{records.data?.contracts.map((row:any)=><li key={row.submissionId}>Application #{row.submissionId} · Signed {new Date(row.contract_signed_at).toLocaleDateString()} {fileLink(row.signed_contract_url)&&<a className="underline" href={fileLink(row.signed_contract_url)!} target="_blank" rel="noopener noreferrer">Open signed contract</a>}</li>)}{!records.data?.contracts.length&&<li>No retained application contracts are recorded.</li>}</ul>)}</div>;
}
