import {afterEach,expect,it,vi} from 'vitest';
import {lycRequest} from '../lyc';
afterEach(()=>vi.unstubAllGlobals());
it.each([200,502])('shows a retryable error for HTML from the API (HTTP %s)',async status=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('<!DOCTYPE html><html>Temporary upstream page</html>',{status})));
 await expect(lycRequest('/api/lyc/applications')).rejects.toThrow(`unexpected response (HTTP ${status})`);
});
it('does not advise blindly retrying a write whose response was lost',async()=>{
 const fetch=vi.fn(async()=>new Response('Bad gateway',{status:502}));vi.stubGlobal('fetch',fetch);
 await expect(lycRequest('/api/onboarding/submissions/7/create-vehicle','POST',{})).rejects.toThrow('The save result is unconfirmed');
 expect(fetch).toHaveBeenCalledOnce();
});
it('rejects a failed operation even when the HTTP status is successful',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({success:false,error:'Not saved'}))));
 await expect(lycRequest('/api/lyc/applications')).rejects.toThrow('Not saved');
});
it('retains structured API errors and never treats unsuccessful JSON as success',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Sign in again.'}),{status:401})));
 await expect(lycRequest('/api/lyc/applications')).rejects.toThrow('Sign in again.');
});
