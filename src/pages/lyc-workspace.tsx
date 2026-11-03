import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link,Redirect,useLocation} from 'wouter';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {LycProgress} from '@/components/onboarding/LycProgress';
import {applicantUser,lycRequest,personalFields} from '@/lib/lyc';

const displayDate=(value:any)=>value?new Date(value).toLocaleDateString():null;
const labels:Record<string,string>={tshirtSize:'T-shirt size',phoneOwner:'Phone',representative:'GLA representative (or Not sure)',heardAboutUs:'How did you hear about us?',streetAddress:'Street address',city:'City',state:'State',zipCode:'ZIP code',birthday:'Date of birth',emergencyContactName:'Emergency contact name',emergencyContactPhone:'Emergency contact phone'};
export default function LycWorkspace({admin=false}:{admin?:boolean}) {
  const [path,setLocation]=useLocation(),client=useQueryClient();
  const profilePage=path==='/lyc/profile';
  const auth=useQuery({queryKey:['/api/auth/me'],queryFn:()=>lycRequest('/api/auth/me'),staleTime:0,refetchInterval:30000});
  const user=auth.data?.user;
  const permitted=!!user && (!admin || (user.isAdmin && !user.isCoHost && !user.viewAsClient && !user.viewAsEmployee && !user.viewAsCoHost));
  const url=admin?'/api/onboarding/applicant-progress':'/api/lyc/applications';
  const applications=useQuery({queryKey:[url],queryFn:()=>lycRequest(url),enabled:permitted,refetchInterval:30000});
  const profile=useQuery({queryKey:['/api/lyc/profile'],queryFn:()=>lycRequest('/api/lyc/profile'),enabled:!!user && !admin});
  const [values,setValues]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(profile.data) setValues(Object.fromEntries(personalFields.map(key=>[key,profile.data.profile[key] || ''])));},[profile.data]);
  if(auth.isLoading) return <p className="p-6">Loading your account…</p>;
  if(auth.error) return <p role="alert" className="p-6">Could not check your account. <button onClick={()=>void auth.refetch()}>Retry</button></p>;
  if(!user) return <Redirect to="/admin/login?next=%2Flyc%2Fstatus"/>;
  if(!permitted) return <Redirect to="/lyc/status"/>;
  const save=async()=>{setBusy(true);setMessage('');try{await lycRequest('/api/lyc/profile','PATCH',values);await client.invalidateQueries({queryKey:['/api/lyc/profile']});setMessage('Personal information saved.');}catch(e:any){setMessage(e.message);}finally{setBusy(false);}};
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 p-4"><Link href="/"><img src="/logo.png" alt="Golden Luxury Auto" className="h-12 w-40 object-contain"/></Link><Button variant="outline" onClick={async()=>{await lycRequest('/api/auth/logout','POST');client.clear();setLocation('/admin/login');}}>Sign out</Button></div></header>
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">{admin?'LYC applicant progress':`Hello, ${user.firstName}`}</h1>
      <nav aria-label="Your account" className="flex flex-wrap gap-2">
        {admin?<Button asChild variant="outline"><Link href="/admin/forms?section=client-onboarding">Review submissions</Link></Button>:<>
          <Button asChild variant={profilePage?'outline':'default'}><Link href="/lyc/status">LYC program</Link></Button>
          <Button asChild variant={profilePage?'default':'outline'}><Link href="/lyc/profile">My profile</Link></Button>
          {!applicantUser(user)&&<Button asChild variant="outline"><Link href="/dashboard">Dashboard</Link></Button>}
        </>}
      </nav>
      {applicantUser(user)&&<p className="rounded-lg border bg-primary/5 p-3 text-sm">Applicant-only accounts that have never been clients are deleted after six months without activity. Sign in or save a step to keep your account current.</p>}
      {profilePage?<section className="rounded-xl border p-4 sm:p-6">
        <h2 className="text-xl font-semibold">Personal information</h2><dl className="my-4 grid gap-3 rounded-lg bg-primary/5 p-3 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Account created on</dt><dd className="font-medium">{displayDate(profile.data?.account?.accountCreatedAt) || 'Date not recorded'}</dd></div><div><dt className="text-sm text-muted-foreground">Client since</dt><dd className="font-medium">{displayDate(profile.data?.account?.clientSince) || (applicantUser(user)?'Not yet a client':'Date not recorded')}</dd></div></dl><p className="my-2 text-sm text-muted-foreground">{user.firstName} {user.lastName} · {user.email}. Your saved details are reused for each application.</p>
        {profile.error?<p role="alert">Could not load your profile. <button onClick={()=>void profile.refetch()}>Retry</button></p>:<form onSubmit={e=>{e.preventDefault();void save();}} className="grid gap-4 sm:grid-cols-2">
          {personalFields.map(key=><label key={key} className="text-sm">{labels[key]}<Input className="mt-1" type={key==='birthday'?'date':key.includes('Phone')||key==='phoneOwner'?'tel':'text'} value={values[key] || ''} onChange={e=>setValues({...values,[key]:e.target.value})}/></label>)}
          <Button disabled={busy || profile.isLoading} className="sm:col-span-2">{busy?'Saving…':'Save personal information'}</Button><p role="status">{message}</p>
        </form>}
      </section>:<>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{admin?'Applications and saved plans':'Your LYC applications'}</h2><p className="mt-1 text-sm text-muted-foreground">Complete the steps in any order. Submit for approval when every required step is ready.</p></div>{!admin&&<Button asChild><Link href="/onboarding?new=1">Start another application</Link></Button>}</div>
        {applications.isLoading&&<p role="status">Loading your progress…</p>}
        {applications.error&&<p role="alert">Could not load applications. <button onClick={()=>void applications.refetch()}>Retry</button></p>}
        {!applications.isLoading&&!applications.error&&!applications.data?.drafts?.length&&!applications.data?.applications?.length&&<div className="rounded-xl border p-6"><p className="mb-4">You don’t need to own a car yet to get started. We’ll ask a few questions and save your plan.</p><Button asChild><Link href="/onboarding?new=1">Get started</Link></Button></div>}
        {applications.data?.drafts?.map((draft:any)=><article key={`draft-${draft.id}`} className="space-y-3 rounded-xl border p-4 sm:p-5">
          <h3 className="font-semibold">{draft.applicantName&&`${draft.applicantName} · `}{[draft.fields.vehicleYear||draft.fields.plannedVehicleYear,draft.fields.vehicleMake||draft.fields.plannedVehicleMake,draft.fields.vehicleModel||draft.fields.plannedVehicleModel].filter(Boolean).join(' ') || `Vehicle plan #${draft.id}`}</h3>
          <p className="text-sm">{draft.pendingSubmittedAt?'Pending application submitted — GLA can view it and contact you.':draft.hasVehicle===false?'Waiting for vehicle details — your other steps can be completed now.':'Application in progress'}</p>
          {draft.pendingSubmittedAt&&<p className="text-sm">Return to this application when you have the car information, check your saved details and submit for approval.</p>}
          <p className="text-sm text-muted-foreground">{draft.fields.acquisitionPlan&&`Plan: ${draft.fields.acquisitionPlan}. `}Saved {new Date(draft.updatedAt).toLocaleDateString()} · {draft.pendingSubmittedAt?`Submitted as pending ${new Date(draft.pendingSubmittedAt).toLocaleDateString()}`:'Not yet submitted for approval'}</p>
          {!admin&&<div className="flex flex-wrap gap-2"><Button asChild><Link href={`/onboarding?draft=${draft.id}`}>Continue steps</Link></Button><Button asChild variant="outline"><Link href={`/onboarding?draft=${draft.id}&step=vehicle`}>Add vehicle details</Link></Button></div>}
        </article>)}
        {applications.data?.applications?.map((item:any)=><article key={item.id} className="space-y-4 rounded-xl border p-4 sm:p-5"><div><h3 className="text-lg font-semibold">{item.vehicle}</h3><p className="text-sm text-muted-foreground">Application #{item.id} · {item.vin} · {String(item.status).replaceAll('_',' ')}</p></div><LycProgress steps={item.steps}/>
          {item.status==='approved'&&!item.steps[3]?.done&&<p className="text-sm">Check your email for the contract. Approval alone does not complete signing.</p>}
          {item.canDropOff&&!admin&&<Button asChild><Link href="/admin/forms?section=client-onboarding&item=car-on">Complete vehicle drop-off form</Link></Button>}
          {['rejected','on-hold'].includes(item.status)&&<p className="text-sm">Please contact GLA to review the next steps for this application.</p>}
        </article>)}
      </>}
    </main>
  </div>;
}
