import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/queryClient',()=>({buildApiUrl:(url:string)=>url}));
import { fetchMaintenanceRecords, maintenanceMoveUrl } from './maintenanceReports';
afterEach(()=>vi.unstubAllGlobals());
describe('maintenance moves and full-list pagination',()=>{
  it('rejects an empty move response instead of announcing a successful move',()=>{
    for(const body of [null,{}, {data:[]},{data:[null]},{data:[{id:0}]}]) expect(()=>maintenanceMoveUrl(body)).toThrow('could not be verified');
    expect(maintenanceMoveUrl({data:[{id:99}]})).toBe('/admin/operations?tab=maintenance&report=99');
  });
  it('loads later cards before search rather than silently truncating them',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({total:3,data:[{id:1},{id:2}]})}).mockResolvedValueOnce({ok:true,json:async()=>({total:3,data:[{id:3}]})});
    vi.stubGlobal('fetch',fetch);
    expect(await fetchMaintenanceRecords()).toEqual({total:3,data:[{id:1},{id:2},{id:3}]});
    expect(fetch.mock.calls[1][0]).toContain('offset=2');
  });
  it('fails visibly when a later page fails, rather than reporting an incomplete list as complete',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({total:3,data:[{id:1}]})}).mockResolvedValueOnce({ok:false}));
    await expect(fetchMaintenanceRecords()).rejects.toThrow('could not be loaded');
  });
  it('stops a no-progress page and retains the report filter on requests',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({total:3,data:[{id:99}]})});
    vi.stubGlobal('fetch',fetch);
    await expect(fetchMaintenanceRecords(new URLSearchParams({reportId:'99'}))).rejects.toThrow('changed while loading');
    expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls[1][0]).toContain('reportId=99');
  });
});
