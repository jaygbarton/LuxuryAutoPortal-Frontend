import { SearchableNativeSelect } from '@/components/ui/searchable-native-select';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
type Answers={hasVehicle:boolean|null;[key:string]:any};
export function LycQuestionnaire({answers,onChange,busy,suggestedCarsHref}:{answers:Answers;onChange:(value:Answers)=>void;busy:boolean;suggestedCarsHref:string|null}) {
  const set=(key:string,value:any)=>onChange({...answers,[key]:value});
  return <section className="space-y-6 rounded-xl border bg-background p-4 sm:p-6" aria-label="Your vehicle plan">
    <div><h2 className="text-xl font-semibold">Let’s tailor your LYC steps</h2><p className="mt-2 text-sm text-muted-foreground">You can save now, return later and complete the steps in any order. A vehicle isn’t required to start.</p></div>
    <fieldset><legend className="mb-3 font-medium">Do you already have a vehicle?</legend><div className="flex flex-wrap gap-3">{[true,false].map(value=><Button key={String(value)} type="button" disabled={busy} aria-pressed={answers.hasVehicle===value} variant={answers.hasVehicle===value?'default':'outline'} onClick={()=>set('hasVehicle',value)}>{value?'Yes, I have a vehicle':'Not yet'}</Button>)}</div></fieldset>
    {answers.hasVehicle===false&&<>
      <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><strong>Pending means we’re waiting for your car details.</strong> Complete your personal and secure information, then submit. GLA can contact you while you plan. Return to this application when you have the car information to finish it for approval.</p>
      <VehiclePlanFields answers={answers} onChange={onChange} suggestedCarsHref={suggestedCarsHref}/>
    </>}
  </section>;
}

/** Each application keeps its own vehicle plan, independently of reusable account details. */
export function VehiclePlanFields({answers,onChange,suggestedCarsHref}:{answers:Answers;onChange:(value:Answers)=>void;suggestedCarsHref:string|null}) {
  const set=(key:string,value:any)=>onChange({...answers,[key]:value});
  return <div className="space-y-4">      <label className="block space-y-2"><span className="font-medium">Do you plan to buy or finance a vehicle for the program?</span><SearchableNativeSelect className="h-11 w-full rounded-md border bg-background px-3" value={answers.acquisitionPlan || ''} onChange={e=>set('acquisitionPlan',e.target.value)}><option value="">Choose your plan</option><option value="purchase">Buy a vehicle</option><option value="finance">Finance a vehicle</option><option value="unsure">Still deciding / need guidance</option></SearchableNativeSelect></label>
      <label className="block space-y-2"><span className="font-medium">Do you know which vehicle you plan to get?</span><SearchableNativeSelect className="h-11 w-full rounded-md border bg-background px-3" value={answers.knowsPlannedCar || ''} onChange={e=>set('knowsPlannedCar',e.target.value)}><option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">Not yet — that’s okay</option></SearchableNativeSelect></label>
      {answers.knowsPlannedCar==='yes'&&<div className="grid gap-3 sm:grid-cols-3">{[['plannedVehicleYear','Planned year'],['plannedVehicleMake','Planned make'],['plannedVehicleModel','Planned model']].map(([key,label])=><label key={key} className="text-sm">{label}<Input className="mt-1" value={answers[key] || ''} onChange={e=>set(key,e.target.value)} placeholder="If known"/></label>)}</div>}
      <p className="text-sm text-muted-foreground">Check vehicle eligibility with GLA before buying or financing.{suggestedCarsHref&&<> <a href={suggestedCarsHref} target="_blank" rel="noopener noreferrer" className="underline">See suggested vehicles</a>.</>}</p>
      <label className="flex items-start gap-3 text-sm"><input className="mt-1 h-4 w-4" type="checkbox" checked={answers.requirementsAcknowledged==='yes'} onChange={e=>set('requirementsAcknowledged',e.target.checked?'yes':'no')}/><span>I understand GLA must approve the vehicle.</span></label></div>;
}
