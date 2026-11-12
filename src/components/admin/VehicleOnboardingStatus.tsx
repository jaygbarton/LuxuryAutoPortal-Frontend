import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {lycRequest} from '@/lib/lyc';
import {Button} from '@/components/ui/button';
const labels={car_onboarding:'Car Onboarding',active:'Active',inactive:'Inactive'};
export function VehicleOnboardingStatus({carId}:{carId:number}){
 const cache=useQueryClient();const key=['vehicle-onboarding-status',carId];
 const query=useQuery({queryKey:key,queryFn:()=>lycRequest(`/api/cars/${carId}/onboarding-status`)});
 const [selected,setSelected]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const current=query.data?.data?.status;
 async function save(){setBusy(true);setError('');try{await lycRequest(`/api/cars/${carId}/onboarding-status`,'PATCH',{status:selected});setSelected('');await cache.invalidateQueries({queryKey:key});await cache.invalidateQueries({queryKey:['/api/cars']});}catch(e){setError(e instanceof Error?e.message:'Unable to save');}finally{setBusy(false);}}
 return <section className="space-y-3 rounded border p-4" aria-label="Car Onboarding Status"><h3 className="font-semibold">Car Onboarding Status</h3><p className="text-sm text-muted-foreground">Car Onboarding: awaiting the vehicle form. Active: onboarding completed. Inactive: offboarded. A manual change to Inactive records today as the offboarding date.</p>
 {query.isPending?<p>Loading status…</p>:query.isError?<p role="alert">Unable to load onboarding status.</p>:<div className="flex gap-3"><select aria-label="Car Onboarding Status" className="rounded border bg-background p-2" value={selected||current} onChange={e=>setSelected(e.target.value)} disabled={busy}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><Button type="button" disabled={busy||!selected||selected===current} onClick={()=>void save()}>Save onboarding status</Button></div>}{error&&<p role="alert">{error}</p>}</section>;
}
