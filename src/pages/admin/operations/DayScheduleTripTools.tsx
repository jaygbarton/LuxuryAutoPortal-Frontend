import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {buildApiUrl} from '@/lib/queryClient';
import {Button} from '@/components/ui/button';
import {SearchableNativeSelect} from '@/components/ui/searchable-native-select';
import {isActiveFleetStatus,type OperationsVehicle} from '@/lib/operationsFleet';

export type TripChange={field:string;label:string;previous:string;current:string};
export function TripChangeList({changes,formatDateTime}:{changes?:TripChange[];formatDateTime:(value:string)=>string}) {
  if(!changes?.length)return null;
  const value=(change:TripChange,text:string)=>['trip_start','trip_end'].includes(change.field)&&/^\d{4}-/.test(text)?formatDateTime(text):text;
  return <span data-trip-changes className="block space-y-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
    <span className="block font-semibold">Modified trip</span>
    {changes.map(change=><span className="block break-words" key={change.field}><span className="font-medium">{change.label}: </span><del data-previous-value>{value(change,change.previous)}</del><span aria-hidden="true"> → </span><span data-current-value>{value(change,change.current)}</span></span>)}
  </span>;
}

async function responseJson(response:Response) {
  const body=await response.json();
  if(!response.ok || body.success===false)throw new Error(body.error||body.message||'The reservation could not be updated.');
  return body;
}
export function SwapVehiclePicker({tripId,revision}:{tripId:number;revision:string|null}) {
  const client=useQueryClient();
  const [selected,setSelected]=useState(''),[saved,setSaved]=useState('');
  const fleet=useQuery<OperationsVehicle[]>({queryKey:['/api/operations/fleet-vehicles'],queryFn:async()=>{
    const body=await responseJson(await fetch(buildApiUrl('/api/operations/fleet-vehicles'),{credentials:'include'}));
    if(!Array.isArray(body.data))throw new Error('Replacement vehicles could not be loaded.');return body.data;
  },retry:false});
  const save=useMutation({mutationFn:async()=>responseJson(await fetch(buildApiUrl(`/api/operations/day-schedule/trips/${tripId}/swap-vehicle`),{
    method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({carId:Number(selected),expectedRevision:revision}),
  })),onSuccess:async result=>{
    setSaved(result.warning||'Replacement vehicle saved.');
    await Promise.all(['/api/operations/day-schedule','/api/turo-trips','/api/internal-calendar/events','/api/operations/day-schedule/driver-rankings'].map(key=>client.invalidateQueries({queryKey:[key]})));
  }});
  return <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" data-swap-vehicle-picker>
    <p>Check the confirmed swap on Turo, then select the replacement vehicle.</p>
    <label className="block space-y-1"><span className="font-medium">Replacement vehicle</span>
      <SearchableNativeSelect aria-label="Replacement vehicle" value={selected} className="h-11 w-full min-w-0 rounded-md border bg-white px-2" disabled={save.isPending||fleet.isPending||fleet.isError} onChange={event=>{setSelected(event.target.value);setSaved('');}}>
        <option value="">Select replacement vehicle</option>
        {fleet.data?.filter(car=>isActiveFleetStatus(car.carStatus)&&car.vinNumber).map(car=><option key={car.carId} value={car.carId}>{car.carName} · {car.plateNumber||`VIN …${car.vinNumber!.slice(-6)}`}</option>)}
      </SearchableNativeSelect>
    </label>
    {fleet.isError&&<p role="alert">Vehicles could not be loaded. <button className="underline" onClick={()=>void fleet.refetch()}>Retry vehicles</button></p>}
    <Button type="button" className="h-11" disabled={!selected||save.isPending} onClick={()=>save.mutate()}>{save.isPending?'Saving replacement…':'Confirm replacement vehicle'}</Button>
    {save.isError&&<p role="alert">{save.error.message}</p>}
    {saved&&<p role="status">{saved}</p>}
  </div>;
}

export function RestoreReservationPickup({onRestored}:{onRestored:(schedule:any)=>void}) {
  const [open,setOpen]=useState(false),[reservation,setReservation]=useState('');
  const restore=useMutation({mutationFn:async()=>{
    const id=reservation.trim();if(!/^\d{1,20}$/.test(id))throw new Error('Enter a reservation number.');
    const lookup=await responseJson(await fetch(buildApiUrl(`/api/operations/day-schedule/reservations/${id}`),{credentials:'include'}));
    const source=await responseJson(await fetch(buildApiUrl(`/api/turo-trips/${lookup.tripId}/reparse`),{method:'POST',credentials:'include'}));
    if(!source.data?.parsed?.tripEnd)throw new Error('The return time could not be verified from source emails. Nothing was restored.');
    const restored=await responseJson(await fetch(buildApiUrl(`/api/operations/day-schedule/reservations/${id}/restore`),{method:'POST',credentials:'include'}));
    if(!restored.schedule?.events?.some((event:any)=>event.id===restored.taskId && event.bookingKey===`turo:${restored.tripId}`))throw new Error('Pickup saved, but its schedule visibility could not be verified. Please refresh.');
    return restored.schedule;
  },onSuccess:schedule=>{onRestored(schedule);setOpen(false);}});
  return <div className="space-y-2" data-restore-reservation>
    <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={()=>setOpen(!open)}>Restore reservation pickup</Button>
    {open&&<div className="space-y-2 rounded-lg border bg-card p-3 text-sm">
      <p>Recheck the source emails and restore a missing pickup at the verified return time.</p>
      <label className="block space-y-1"><span>Reservation number</span><input aria-label="Reservation number" inputMode="numeric" className="h-11 w-full rounded-md border bg-background px-3" value={reservation} disabled={restore.isPending} onChange={event=>setReservation(event.target.value)}/></label>
      <Button type="button" className="h-11" disabled={restore.isPending} onClick={()=>restore.mutate()}>{restore.isPending?'Checking and restoring…':'Verify emails & restore pickup'}</Button>
      {restore.isError&&<p role="alert">{restore.error.message}</p>}
    </div>}
  </div>;
}
