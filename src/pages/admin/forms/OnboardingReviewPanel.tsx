import { lycRequest } from '@/lib/lyc';
import { LycProgress } from '@/components/onboarding/LycProgress';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { wizardSteps } from '@/lib/onboardingSteps';

const labels: Record<string,string> = { firstNameOwner:'Owner first name',lastNameOwner:'Owner last name',phoneOwner:'Owner phone',emailOwner:'Owner email',vinNumber:'VIN',ssn:'SSN',ein:'EIN',tshirtSize:'T-shirt size',carManufacturerWebsite:'Vehicle account website',carManufacturerUsername:'Vehicle account username',password:'Vehicle account password',vehicleFeatures:'Vehicle features (comma separated)',date:'Application date' };
const dates = new Set(['date','birthday','registrationExpiration','lastOilChange','insuranceExpiration']);
const secrets = new Set(['routingNumber','accountNumber','ssn','ein','password']);
const label = (field:string) => labels[field] || field.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase());
const display = (field:string,value:any) => secrets.has(field) ? '' : Array.isArray(value) ? value.join(', ') : dates.has(field) && value ? String(value).slice(0,10) : String(value ?? '');
const root = '/api/onboarding/submissions';
async function request(path:string,body?:any,method='POST') {
  return lycRequest(path,method,body);
}

/** Uses the existing admin-only review dialog and signed document viewer below it. */
export function OnboardingReviewPanel({submission}:{submission:Record<string,any>}) {
  const id = submission.id;
  const queryClient = useQueryClient();
  const [editing,setEditing] = useState(false);
  const [changes,setChanges] = useState<Record<string,string>>({});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [confirmCreate,setConfirmCreate] = useState(false);
  const state = useQuery({queryKey:['onboarding-review',id],queryFn:()=>request(`${root}/${id}/review`,undefined,'GET'),retry:false});
  const workflow = state.data?.data;
  const version = submission.reviewVersion;
  const identityLocked = submission.contractStatus === 'signed' || submission.userId || workflow?.clientId;
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({queryKey:['onboarding-submission',id]}),
      queryClient.invalidateQueries({queryKey:['onboarding-submissions']}),
      queryClient.invalidateQueries({queryKey:['onboarding-review',id]}),
      queryClient.invalidateQueries({queryKey:['/api/cars']}),
      queryClient.invalidateQueries({queryKey:['cars-onboarding']}),
      queryClient.invalidateQueries({queryKey:['sidebar-badges']}),
    ]);
  };
  const action = async (kind:'save'|'approve'|'pending'|'create'|'contract'|'activate'|'reconcile') => {
    setBusy(true); setError(''); setMessage('');
    try {
      let result:any;
      if (kind === 'save') {
        const payload:Record<string,unknown> = {...changes};
        if ('vehicleFeatures' in payload) payload.vehicleFeatures = JSON.stringify(String(payload.vehicleFeatures).split(',').map(item=>item.trim()).filter(Boolean));
        result = await request(`${root}/${id}/review`,{version,changes:payload},'PATCH');
        setEditing(false); setChanges({}); setMessage('Review changes saved.');
      } else if (kind === 'approve') {
        result = await request(`${root}/${id}/approve`,{version});
        setMessage(result.data?.notificationWarnings?.length ? `Approved. Delivery needs checking: ${result.data.notificationWarnings.join(', ')}.` : 'Approved. The vehicle is in Cars and remains off fleet until Car Onboarding is completed. Account instructions have been requested.');
      } else if (kind === 'pending') {
        result = await request(`${root}/${id}/status`,{status:'pending',version},'PATCH');
        setMessage('Returned to Pending. Review and approve again after making changes.');
      } else if(kind==='reconcile'){
        result=await request(`${root}/${id}/reconcile`,{version});setMessage(result.data.message+(result.data.alreadySent?' The instructions were already sent; no duplicate email was requested.':''));
      } else if(kind==='activate'){
        result=await request(`${root}/${id}/activate-client`,{});setMessage('Signed client account setup completed.');
      } else if (kind === 'contract') {
        result = await request(`/api/contracts/lyc/${id}/resend`,{});
        setMessage('Contract email requested. Confirm delivery in the email provider if needed.');
      } else {
        result = await request(`${root}/${id}/create-vehicle`,{version});
        setConfirmCreate(false); setMessage(result.message);
      }
      await refresh();
    } catch(err) {
      setError(err instanceof Error ? err.message : 'The save result is unconfirmed. Refresh to check the current status.');
      // A proxy can lose the response after the transaction commits. Re-read;
      // never automatically repeat a write or keep offering stale creation actions.
      await refresh();
    }
    finally {setBusy(false);}
  };
  return <section aria-label="Onboarding review workflow" className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-4">
    <div><h3 className="font-semibold">Submit → sign agreement → approval → Car Onboarding</h3><p className="mt-1 text-sm text-muted-foreground">Submission sends the agreement for signing. Approval requires the signed agreement, creates or links the vehicle in Cars and the client profile, and sends account instructions. The client then completes the Car Onboarding Form when bringing the vehicle into GLA.</p></div>
    {workflow?.progress&&<LycProgress steps={workflow.progress.steps}/>}
    <div className="flex flex-wrap gap-2 text-sm"><span className="rounded border bg-background px-2 py-1">Application: {submission.status}</span><span className="rounded border bg-background px-2 py-1">Contract: {submission.contractStatus || 'pending'}</span><span className="rounded border bg-background px-2 py-1">{state.error || !workflow ? 'Vehicle link status unavailable' : workflow.carId ? `Vehicle #${workflow.carId} in system` : 'Vehicle record not yet linked'}</span></div>
    {(state.error || error) && <p role="alert" className="text-sm text-destructive">{error || state.error?.message} <Button type="button" variant="ghost" disabled={busy} onClick={()=>{setError('');void refresh();}}>Refresh review</Button></p>}
    {submission.contractStatus !== 'signed' && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Awaiting the client’s signed agreement. The application cannot be approved and applicant accounts cannot access the client software until signing and approval are complete.</p>}
    {['pending','in_review','approved'].includes(submission.status) && submission.contractStatus !== 'signed' && <Button type="button" variant="outline" disabled={busy} onClick={()=>void action('contract')}>Resend contract</Button>}
    {workflow && !state.error && submission.status === 'approved' && submission.contractStatus === 'signed' && <p className="text-sm text-muted-foreground">Contract signed. {workflow.carId ? 'The owner can now complete the Car Onboarding Form.' : 'Restore the missing vehicle record so it can appear in the owner’s Car Onboarding Form.'}</p>}
    {submission.status==='approved' && submission.contractStatus==='signed' && <Button type="button" variant="outline" disabled={busy || !version || !workflow || !!state.error} onClick={()=>void action('reconcile')}>Repair client setup & send missing instructions</Button>}
    {!!workflow?.emailDeliveries?.length && <div className="text-sm text-muted-foreground"><p className="font-medium">Email acceptance recorded</p><ul className="mt-1 list-disc pl-5">{workflow.emailDeliveries.map((email:any)=><li key={email.kind}>{({contract:'Agreement',approval_setup:'Password setup',approval_existing:'Existing client approval',car_onboarding:'Car Onboarding instructions'} as Record<string,string>)[email.kind] || email.kind}: {new Date(email.sent_at).toLocaleString()}</li>)}</ul></div>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {state.isLoading && <p className="text-sm">Loading review status…</p>}
    {workflow && !state.error && !editing && <div className="flex flex-wrap gap-2">
      {workflow.carId ? <Button asChild variant="outline"><Link href={`/admin/cars/${workflow.carId}`}>Open vehicle record</Link></Button> : <>
        <Button type="button" variant="outline" disabled={busy || submission.status === 'approved'} onClick={()=>{setChanges({});setEditing(true);setError('');}}>Edit application</Button>
        {submission.status === 'approved' ? <>
          <Button type="button" variant="outline" disabled={busy} onClick={()=>void action('pending')}>Return to Pending to edit</Button>
          <Button type="button" disabled={busy || !version} onClick={()=>setConfirmCreate(true)}>Restore approved vehicle</Button>
          {!workflow.clientId && submission.contractStatus==='signed' && <Button type="button" disabled={busy} onClick={()=>void action('activate')}>Complete signed client setup</Button>}
        </> : <Button type="button" disabled={busy || !version || submission.contractStatus!=='signed'} onClick={()=>void action('approve')}>Approve application</Button>}
      </>}
    </div>}
    {confirmCreate && workflow && !state.error && !workflow.carId && <div className="rounded border bg-background p-3 space-y-3" aria-label="Confirm vehicle record creation">
      <p className="text-sm">Create a record for <strong>{submission.vehicleMake} {submission.vehicleModel} {submission.vehicleYear}</strong>, VIN {submission.vinNumber}, under {submission.firstNameOwner} {submission.lastNameOwner}? It will remain off fleet. A matching existing vehicle will be linked without overwriting its data.</p>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={()=>void action('create')}>{busy ? 'Saving…' : 'Confirm create vehicle record'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setConfirmCreate(false)}>Cancel</Button></div>
    </div>}
    {editing && <div className="space-y-4" aria-label="Edit onboarding application">
      <p className="text-sm text-muted-foreground">Only changed fields are saved. Leave secure fields blank to keep their stored values. Documents can be reviewed and updated below. {identityLocked && 'Owner identity and VIN are locked because they are linked to an account or signed contract.'}</p>
      {wizardSteps.slice(0,3).map(step=><fieldset key={step.title} className="space-y-3 rounded border bg-background p-3" disabled={busy}>
        <legend className="px-1 font-medium">{step.title}</legend><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {step.fields.map(field=><label key={field} className="block min-w-0 space-y-1 text-sm"><span>{label(field)}</span>
            <Input aria-label={`Edit ${label(field)}`} type={secrets.has(field)?'password':dates.has(field)?'date':field==='emailOwner'?'email':'text'} autoComplete={secrets.has(field)?'new-password':'off'} disabled={identityLocked && ['emailOwner','firstNameOwner','lastNameOwner','vinNumber'].includes(field)} value={changes[field] ?? display(field,submission[field])} placeholder={secrets.has(field)?'Leave blank to keep existing value':undefined} onChange={event=>setChanges(previous=>{const next={...previous};if(event.target.value===display(field,submission[field])) delete next[field];else next[field]=event.target.value;return next;})} />
          </label>)}
        </div>
      </fieldset>)}
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy || !Object.keys(changes).length || !version} onClick={()=>void action('save')}>Save review changes</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>{setEditing(false);setChanges({});}}>Cancel editing</Button></div>
    </div>}
    {!!workflow?.history?.length && <details><summary className="cursor-pointer text-sm">Review history ({workflow.history.length})</summary><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{workflow.history.map((entry:any,index:number)=><li key={index}>{String(entry.created_at).slice(0,19).replace('T',' ')} · {String(entry.action).replaceAll('_',' ')}{entry.actor_id ? ` · Admin #${entry.actor_id}` : ''}</li>)}</ul></details>}
  </section>;
}
