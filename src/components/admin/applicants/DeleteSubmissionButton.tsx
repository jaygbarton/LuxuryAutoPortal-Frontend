import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {lycRequest} from '@/lib/lyc';
import {Trash2} from 'lucide-react';
export function DeleteSubmissionButton({id,name,vehicle}:{id:number;name:string;vehicle:string}) {
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const cache=useQueryClient();
 const preview=useQuery({queryKey:['submission-removal-preview',id],queryFn:()=>lycRequest(`/api/onboarding/submissions/${id}/review`),enabled:open,retry:false,staleTime:0});
 const remove=async()=>{if(!preview.data?.data?.version||!reason.trim()||busy||preview.isFetching||preview.error)return;setBusy(true);setError('');try{
  await lycRequest(`/api/onboarding/submissions/${id}`,'DELETE',{version:preview.data.data.version,reason});
  await cache.invalidateQueries({queryKey:['onboarding-submissions']});await cache.invalidateQueries({queryKey:['/api/onboarding/submissions']});await cache.invalidateQueries({queryKey:['/api/onboarding/applicants']});setOpen(false);
 }catch(e:any){setError(e.message);}finally{setBusy(false);}};
 return <><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" title="Delete application" aria-label={`Delete application for ${name}`} onClick={()=>{setReason('');setError('');setOpen(true);}}><Trash2 className="h-4 w-4"/></Button>
 <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent><DialogHeader><DialogTitle>Delete application</DialogTitle><DialogDescription>Remove application #{id} for {name} ({vehicle}) from active submissions. Signed contracts, receipts and linked client or vehicle records are retained. This does not delete their account.</DialogDescription></DialogHeader>
 {preview.isLoading&&<p role="status">Checking application…</p>}
 {(preview.error||error)&&<p role="alert" className="text-destructive">{error||preview.error?.message} <Button variant="outline" disabled={busy} onClick={()=>{setError('');void preview.refetch();}}>Refresh review</Button></p>}
 <label className="text-sm">Reason for deletion<Input value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} disabled={busy}/></label>
 <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy||!reason.trim()||!preview.data?.data?.version||preview.isFetching||!!preview.error||!!error} onClick={()=>void remove()}>{busy?'Deleting…':'Confirm delete application'}</Button></div>
 </DialogContent></Dialog></>;
}
