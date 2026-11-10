import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link,Redirect} from 'wouter';
import {Button} from '@/components/ui/button';
import {lycRequest} from '@/lib/lyc';
import {authMeQueryFn} from '@/lib/queryClient';
export default function ClientRecordsRequest(){
  const auth=useQuery({queryKey:['/api/auth/me'],queryFn:authMeQueryFn,staleTime:0});
  const state=useQuery({queryKey:['/api/lyc/retention'],queryFn:()=>lycRequest('/api/lyc/retention'),enabled:!!auth.data?.user?.isClient});
  const [message,setMessage]=useState(''),[result,setResult]=useState(''),[busy,setBusy]=useState(false);
  if(auth.isLoading)return <p className="p-6">Loading your account…</p>;
  if(!auth.data?.user)return <Redirect to="/admin/login?next=%2Flyc%2Frecords"/>;
  const submit=async()=>{setBusy(true);try{const response=await lycRequest('/api/lyc/retention/request','POST',{message});setResult(response.message);await state.refetch();}catch(e:any){setResult(e.message);}finally{setBusy(false);}};
  return <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-8"><Link href="/dashboard"><img src="/logo.png" alt="Golden Luxury Auto" className="h-16 w-52 object-contain"/></Link><h1 className="text-2xl font-semibold">Request your records</h1><p className="text-sm text-muted-foreground">Clients with no active vehicle for two years are reviewed by an administrator. You can request copies of information before any removal.</p>
    {state.error&&<p role="alert">{state.error.message}</p>}
    {state.isLoading?<p>Loading your record status…</p>:state.data?.record?.notice_sent_at?<><p className="rounded-lg border bg-primary/5 p-3 text-sm">{state.data.record.information_requested_at&&!state.data.record.information_fulfilled_at?'Your request is awaiting the GLA team. Removal is paused.':`Your records are eligible for review. No removal before ${new Date(state.data.record.deletion_due_at).toLocaleDateString()}.`}</p><form onSubmit={e=>{e.preventDefault();void submit();}} className="space-y-4"><label className="block text-sm">Which information would you like a copy of?<textarea required maxLength={2000} className="mt-2 min-h-32 w-full rounded-lg border p-3" value={message} onChange={e=>setMessage(e.target.value)}/></label><Button disabled={busy}>{busy?'Sending request…':'Request information & pause removal'}</Button></form></>:<p>There is no pending retention notice for your account.</p>}
    {result&&<p role="status">{result}</p>}<Button asChild variant="outline"><Link href="/dashboard">Back to dashboard</Link></Button>
  </main>;
}
