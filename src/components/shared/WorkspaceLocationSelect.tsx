import { useWorkspaceContext } from '@/hooks/use-workspace-location';
export function WorkspaceLocationSelect({value,onChange}:{value:'all'|'slc'|'wilmington';onChange:(value:'all'|'slc'|'wilmington')=>void}){
 const workspace=useWorkspaceContext();
 const choices=workspace.data?.allowedLocations??['slc','wilmington'];
 return <label className="inline-flex min-w-0 items-center gap-2 text-sm">Location<select aria-label="Workspace location" value={value} onChange={e=>onChange(e.target.value as typeof value)} className="h-11 min-w-0 rounded-md border bg-background px-3 text-base sm:h-9 sm:text-sm">
 {!workspace.data?.coHostScoped&&<option value="all">All locations</option>}{choices.map(loc=><option key={loc} value={loc}>{loc==='slc'?'Utah':'Wilmington'}</option>)}</select></label>;
}
