import {afterEach,expect,it,vi} from 'vitest';
import {lycRequest} from '../lyc';
afterEach(()=>vi.unstubAllGlobals());
it.each([200,502])('shows a retryable error for HTML from the API (HTTP %s)',async status=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('<!DOCTYPE html><html>Temporary upstream page</html>',{status})));
 await expect(lycRequest('/api/lyc/applications')).rejects.toThrow('The server returned an unexpected response. Please retry.');
});
it('retains structured API errors and never treats unsuccessful JSON as success',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Sign in again.'}),{status:401})));
 await expect(lycRequest('/api/lyc/applications')).rejects.toThrow('Sign in again.');
});
