import { useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { buildApiUrl } from '@/lib/queryClient';
import { useChartManagementAccess } from '@/hooks/use-chart-management-access';
import { useTimezone } from '@/hooks/use-timezone';
import { mtTodayKey } from '@/lib/mt-datetime';
import { useOperationLocationFilter } from './OperationLocationFilter';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ChartEntryReceipts } from './ChartEntryReceipts';
type Decision='auto'|'include'|'force'|'exclude';
type Entry={key:string;sourceId:number|null;adjustmentId:number|null;version:number;kind:'parking'|'gas';date:string;employeeId:number|null;carId:number;amount:number|string;sourceAmount:number|string;name:string;sourceEmployeeName:string;carName:string;returnReference:string;decision:Decision;reason:string;exclusion:string|null;anomaly:boolean;reservation:string|null;tripKey?:string|null;linkNote?:string};
type Form={key?:string;kind:'parking'|'gas';date:string;employeeId:number|null;carId:number;amount:string;returnReference:string;decision:Decision;reason:string;version:number;requestId?:string};
type Data={entries:Entry[];drivers:{employeeId:number;name:string}[];cars:{carId:number;name:string}[]};
const dollars=(v:unknown)=>Number(v).toLocaleString('en-US',{style:'currency',currency:'USD'});
export function DriverChartManagementTab(){
  const access=useChartManagementAccess();
  if(access.isPending)return <p role="status">Checking manager access…</p>;
  if(!access.data?.canManage)return <p role="alert">Manager role required to view chart management.</p>;
  return <Management />;
}
function Management(){
  const tz=useTimezone(),location=useOperationLocationFilter(),qc=useQueryClient(),{toast}=useToast();
  const [month,setMonth]=useState(mtTodayKey(tz).slice(0,7)),[form,setForm]=useState<Form|null>(null),[history,setHistory]=useState<string|null>(null),[error,setError]=useState('');
  const [receiptKey,setReceiptKey]=useState<string|null>(null);
  const [year,m]=month.split('-').map(Number),from=`${month}-01`,to=new Date(Date.UTC(year,m,0)).toISOString().slice(0,10);
  const query=useQuery<Data>({queryKey:['/api/operations/chart-management',month,location],retry:false,queryFn:async()=>{const r=await fetch(buildApiUrl(`/api/operations/chart-management?${new URLSearchParams({from,to,location})}`),{credentials:'include'});const body=await r.json();if(!r.ok||!Array.isArray(body.entries))throw new Error(body.error||'Review data could not be loaded.');return body;}});
  const historyQuery=useQuery<{history:any[]}>({queryKey:['/api/operations/chart-management/history',history],enabled:!!history,retry:false,queryFn:async()=>{const r=await fetch(buildApiUrl(`/api/operations/chart-management/${encodeURIComponent(history!)}/history`),{credentials:'include'});if(!r.ok)throw new Error('History could not be loaded.');return r.json();}});
  const save=useMutation({mutationFn:async()=>{
    if(!form)throw new Error('Choose an entry.');
    if(!form.amount.trim())throw new Error('Enter an amount.');
    const {key,amount,...fields}=form;
    const r=await fetch(buildApiUrl(`/api/operations/chart-management${key?`/${encodeURIComponent(key)}`:''}`),{method:key?'PUT':'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,amount:Number(amount)})});
    const body=await r.json();if(!r.ok)throw new Error(body.error||'Could not save chart entry.');return body;
  },onSuccess:async()=>{setForm(null);setError('');await qc.invalidateQueries({queryKey:['/api/operations/chart-management']});await qc.invalidateQueries({queryKey:['/api/operations/day-schedule/driver-rankings']});toast({title:'Chart entry saved'});},onError:(e:Error)=>setError(e.message)});
  const edit=(entry:Entry)=>{setError('');setForm({key:entry.key,kind:entry.kind,date:entry.date,employeeId:entry.employeeId,carId:entry.carId,amount:String(entry.amount),returnReference:entry.returnReference,decision:entry.decision,reason:entry.reason,version:entry.version});};
  const control='h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base sm:text-sm';
  return <section className="space-y-4" aria-label="Driver chart management">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Driver chart management</h2><p className="text-sm text-muted-foreground">Chart adjustments only. Original receipts, expenses and accounting stay unchanged.</p></div>
      <Button className="h-11" disabled={!query.data} onClick={()=>{setError('');setForm({kind:'parking',date:from,employeeId:null,carId:Number(query.data?.cars[0]?.carId)||0,amount:'',returnReference:'',decision:'exclude',reason:'',version:0,requestId:crypto.randomUUID()});}}>Add chart entry</Button></header>
    <label className="block max-w-xs text-sm">Receipt month<input type="month" value={month} onChange={e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))setMonth(e.target.value);}} className={control}/></label>
    <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950">Parking tickets of $40 or more are excluded automatically from both cost and trip count. Normal inclusion requires a verified airport-return trip. Force include lets a manager override the trip-link and price checks after review, with a reason.</p>
    {query.isPending?<p role="status">Loading chart entries…</p>:query.isError?<div role="alert">{query.error.message} <Button variant="outline" onClick={()=>query.refetch()}>Retry chart entries</Button></div>:<div className="space-y-3">{query.data.entries.length===0?<p className="text-sm text-muted-foreground">No chart receipts or adjustments in this month.</p>:query.data.entries.map(entry=><article key={entry.key} aria-label={`Chart entry ${entry.key}`} className={`rounded-xl border p-4 ${entry.anomaly?'border-red-400 bg-red-50':'bg-card'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{entry.kind==='parking'?'Airport parking':'Gas reimbursed'} · {dollars(entry.amount)}</p><p className="break-words text-sm">{entry.date} · {entry.carName}</p><p className="text-sm">Chart employee: {entry.name}{entry.reservation?` · Reservation ${entry.reservation}`:''}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11" onClick={()=>edit(entry)}>Edit</Button><Button variant="outline" className="h-11" onClick={()=>setReceiptKey(entry.key)}>View receipts</Button><Button variant="ghost" className="h-11" onClick={()=>setHistory(entry.key)}>History</Button></div></div>
      {entry.anomaly&&<p className="mt-2 font-semibold text-red-700">$40+ parking anomaly · original ticket {dollars(entry.sourceAmount)}</p>}
      <p className={`mt-1 text-sm ${entry.exclusion?'text-red-800':'text-green-800'}`}>{entry.exclusion?`Excluded: ${entry.exclusion}`:entry.decision==='force'?'Force included by manager':'Included in chart'}</p>
      {entry.decision==='force'&&entry.kind==='parking'&&!entry.tripKey&&<p className="text-sm text-amber-800">Airport-return link is unverified. This forced entry counts as one trip for the selected chart employee.</p>}
      {entry.kind==='parking'&&entry.linkNote&&<p className="mt-1 text-xs text-muted-foreground">{entry.linkNote}</p>}
      <p className="text-xs text-muted-foreground">{entry.sourceId?`Form employee: ${entry.sourceEmployeeName||'No employee'} · Original amount: ${dollars(entry.sourceAmount)} · Receipt form #${entry.sourceId}`:'Manual chart entry'}{entry.reason?` · ${entry.reason}`:''}</p>
    </article>)}</div>}
    <Dialog open={!!form} onOpenChange={open=>{if(!open&&!save.isPending)setForm(null);}}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{form?.key?'Edit chart entry':'Add chart entry'}</DialogTitle><DialogDescription>Assign a Car Driver, or choose No one to exclude the entry. Changes affect these charts only.</DialogDescription></DialogHeader>
      {form&&<form className="grid min-w-0 gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();save.mutate();}}>
        <label className="text-sm">Chart<select aria-label="Chart" value={form.kind} disabled={!!form.key?.startsWith('receipt:')} onChange={e=>setForm({...form,kind:e.target.value as Form['kind']})} className={control}><option value="parking">Airport parking</option><option value="gas">Gas reimbursed</option></select></label>
        <label className="text-sm">Receipt date<input type="date" aria-label="Chart receipt date" value={form.date} required onChange={e=>setForm({...form,date:e.target.value})} className={control}/></label>
        <label className="text-sm">Employee (charts only)<select aria-label="Chart employee" value={form.employeeId??''} onChange={e=>setForm({...form,employeeId:e.target.value?Number(e.target.value):null,decision:e.target.value?form.decision:'exclude'})} className={control}><option value="">No one — excluded</option>{query.data?.drivers.map(d=><option key={d.employeeId} value={d.employeeId}>{d.name}</option>)}{form.employeeId&&!query.data?.drivers.some(d=>d.employeeId===form.employeeId)&&<option value={form.employeeId}>Current employee — not an active Car Driver</option>}</select></label>
        <label className="text-sm">Vehicle<select aria-label="Chart vehicle" required value={form.carId||''} onChange={e=>setForm({...form,carId:Number(e.target.value)})} className={control}><option value="">Choose a vehicle</option>{query.data?.cars.map(c=><option key={c.carId} value={c.carId}>{c.name}</option>)}</select></label>
        <label className="text-sm">Amount ($)<input type="number" aria-label="Chart amount" required min="0" max="1000000" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className={control}/></label>
        <label className="text-sm">Chart inclusion<select aria-label="Chart inclusion" value={form.decision} onChange={e=>setForm({...form,decision:e.target.value as Form['decision']})} className={control}><option value="auto">Automatic rules</option><option value="include" disabled={!form.employeeId}>Include after review</option><option value="force" disabled={!form.employeeId}>Force include</option><option value="exclude">Exclude</option></select></label>
        {form.decision==='force'&&<p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:col-span-2">Force include assigns this entry to the selected employee's charts only and bypasses the $40 and airport-trip-link checks. An unverified parking entry counts once as a trip. Enter why you are overriding it. The original form and its employee remain unchanged.</p>}
        {form.kind==='parking'&&<label className="text-sm sm:col-span-2">Airport-return trip reference<input aria-label="Airport-return trip reference" value={form.returnReference} onChange={e=>setForm({...form,returnReference:e.target.value})} placeholder="Turo reservation #, turo:ID or owner_rental:ID" className={control}/><span className="text-xs text-muted-foreground">Not verified means the software could not confirm the receipt's airport-return trip link. Force include overrides that check after manager review.</span></label>}
        {form.key&&<div className="sm:col-span-2"><p className="text-sm">{form.key.startsWith('receipt:')?`Form employee: ${query.data?.entries.find(e=>e.key===form.key)?.sourceEmployeeName||'No employee'} (unchanged)`:'Manual chart entry — no original expense form.'}</p><Button type="button" variant="outline" className="mt-2 h-11" onClick={()=>setReceiptKey(form.key!)}>View receipts</Button></div>}
        <label className="text-sm sm:col-span-2">Reason for change<textarea aria-label="Reason for chart change" required maxLength={1000} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} className="min-h-20 w-full rounded-md border bg-background p-3 text-base sm:text-sm"/></label>
        {error&&<p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" className="h-11" disabled={save.isPending}>{save.isPending?'Saving…':'Save chart entry'}</Button><Button type="button" variant="outline" className="h-11" disabled={save.isPending} onClick={()=>setForm(null)}>Cancel</Button></div>
      </form>}
    </DialogContent></Dialog>
    <Dialog open={!!history} onOpenChange={open=>{if(!open)setHistory(null);}}><DialogContent><DialogHeader><DialogTitle>Chart edit history</DialogTitle><DialogDescription>Saved chart revisions and who made them.</DialogDescription></DialogHeader>
      {historyQuery.isPending?<p>Loading history…</p>:historyQuery.isError?<p role="alert">History could not be loaded.</p>:historyQuery.data?.history.length?<ol className="space-y-3">{historyQuery.data.history.map(row=><li key={row.version} className="rounded border p-3 text-xs"><p>Version {row.version} · User #{row.actor_id} · {String(row.created_at)}</p><pre className="mt-1 whitespace-pre-wrap break-words">{typeof row.after_json==='string'?row.after_json:JSON.stringify(row.after_json,null,2)}</pre></li>)}</ol>:<p>No chart edits yet.</p>}
      <DialogClose asChild><Button variant="outline">Close history</Button></DialogClose>
    </DialogContent></Dialog>
    {receiptKey&&<ChartEntryReceipts entryKey={receiptKey} onClose={()=>setReceiptKey(null)}/>}
  </section>;
}
