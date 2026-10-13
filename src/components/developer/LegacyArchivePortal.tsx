import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileArchive, Loader2, Pause, Search, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { buildApiUrl } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const ROOT = '/api/developer/legacy-archives';
type Category = 'all' | 'receipt' | 'data' | 'page' | 'file';
type Archive = {
  id: string; name: string; size: number; createdAt: string; status: 'uploading' | 'processing' | 'ready' | 'failed';
  chunkSize: number; uploadedChunks: number; totalChunks: number; counts: Record<Exclude<Category, 'all'>, number>;
  tableCount: number; skipped: number; warnings: string[]; error?: string;
};
type ArchivedFile = { id: string; path: string; size: number; category: Category };
type ArchiveTable = { id: string; name: string; fileId: string; columns: string[]; rowCount: number };
const bytes = (size: number) => size >= 1024 ** 3 ? `${(size / 1024 ** 3).toFixed(1)} GB` : size >= 1024 ** 2 ? `${(size / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;

async function fingerprint(file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const tail = new Uint8Array(await file.slice(Math.max(0, file.size - 65536)).arrayBuffer());
  const size = new TextEncoder().encode(String(file.size));
  const sample = new Uint8Array(head.length + tail.length + size.length);
  sample.set(head); sample.set(tail, head.length); sample.set(size, head.length + tail.length);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', sample))].map(b => b.toString(16).padStart(2, '0')).join('');
}

function FileViewer({ archiveId, file, close }: { archiveId: string; file: ArchivedFile; close: () => void }) {
  const url = `${ROOT}/${archiveId}/files/${file.id}`;
  const isText = /\.(php|html?|[jt]sx?|vue|sql|csv|json|txt|md|css|xml)$/i.test(file.path);
  const canPreview = isText || (file.size <= 25 * 1024 ** 2 && /\.(pdf|jpe?g|png|gif|webp)$/i.test(file.path));
  const [objectUrl, setObjectUrl] = useState('');
  const [error, setError] = useState('');
  const text = useQuery<{ text: string; truncated: boolean }>({ queryKey: [url, 'preview'], queryFn: () => api.get(url, { query: { preview: '1' } }), enabled: isText, retry: false });
  useEffect(() => {
    if (isText || !canPreview) return;
    const abort = new AbortController(); let object = '';
    void fetch(buildApiUrl(url), { credentials: 'include', signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error('Could not load archived file.');
      object = URL.createObjectURL(await response.blob());
      if (abort.signal.aborted) { URL.revokeObjectURL(object); return; }
      setObjectUrl(object);
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => { abort.abort(); if (object) URL.revokeObjectURL(object); };
  }, [url, isText, canPreview]);
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
      <DialogHeader><DialogTitle className="break-all pr-5 text-base">{file.path}</DialogTitle></DialogHeader>
      <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{bytes(file.size)}</span><Button size="sm" variant="outline" asChild><a href={buildApiUrl(url)}><Download />Download file</a></Button></div>
      {(error || text.error) && <p role="alert" className="text-sm text-destructive">{error || text.error?.message}</p>}
      {isText ? text.isLoading ? <p>Loading preview…</p> : <div className="min-h-0 overflow-auto rounded border bg-muted p-3"><pre className="whitespace-pre-wrap break-words text-xs">{text.data?.text}</pre>{text.data?.truncated && <p className="mt-3 text-sm">Preview shows the first 256 KB. Download the file for its full contents.</p>}</div>
        : objectUrl ? /\.pdf$/i.test(file.path) ? <iframe title="Archived document" src={objectUrl} sandbox="" className="min-h-[60vh] w-full rounded border" /> : <div className="overflow-auto"><img src={objectUrl} alt={file.path} className="mx-auto max-h-[65vh] object-contain" /></div>
        : canPreview && !error ? <p>Loading preview…</p> : <p className="text-sm text-muted-foreground">Download this file to view it.</p>}
    </DialogContent>
  </Dialog>;
}

export function LegacyArchivePortal() {
  const { toast } = useToast(), queryClient = useQueryClient();
  const [selected, setSelected] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [search, setSearch] = useState('');
  const [fileOffset, setFileOffset] = useState(0);
  const [tableId, setTableId] = useState('');
  const [rowOffset, setRowOffset] = useState(0);
  const [viewer, setViewer] = useState<ArchivedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [uploadSize, setUploadSize] = useState(0);
  const [uploadName, setUploadName] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const stopped = useRef(false);
  useEffect(() => () => { stopped.current = true; abortRef.current?.abort(); }, []);
  const archivesQuery = useQuery<{ archives: Archive[] }>({ queryKey: [ROOT], queryFn: () => api.get(ROOT), refetchInterval: uploading ? false : 10_000, retry: false });
  const archives = archivesQuery.data?.archives ?? [];
  const activeId = selected || archives[0]?.id || '';
  const archiveQuery = useQuery<{ archive: Archive }>({ queryKey: [ROOT, activeId], queryFn: () => api.get(`${ROOT}/${activeId}`), enabled: !!activeId, refetchInterval: 5000, retry: false });
  const archive = archiveQuery.data?.archive;
  const files = useQuery<{ files: ArchivedFile[]; total: number }>({ queryKey: [ROOT, activeId, 'files', category, search, fileOffset], queryFn: () => api.get(`${ROOT}/${activeId}/files`, { query: { category, search, offset: fileOffset } }), enabled: !!archive && archive.status !== 'uploading', refetchInterval: archive?.status === 'processing' ? 5000 : false });
  const tables = useQuery<{ tables: ArchiveTable[] }>({ queryKey: [ROOT, activeId, 'tables'], queryFn: () => api.get(`${ROOT}/${activeId}/tables`), enabled: !!archive && archive.status !== 'uploading', refetchInterval: archive?.status === 'processing' ? 5000 : false });
  const rows = useQuery<{ table: ArchiveTable; rows: (string | null)[][]; total: number }>({ queryKey: [ROOT, activeId, 'rows', tableId, rowOffset], queryFn: () => api.get(`${ROOT}/${activeId}/tables/${tableId}`, { query: { offset: rowOffset } }), enabled: !!activeId && !!tableId, retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: [ROOT] });
  const index = async (id: string) => {
    setBusy(true);
    try { await api.post(`${ROOT}/${id}/index`, {}); await refresh(); return true; }
    catch (e) { toast({ title: 'Could not index backup', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' }); return false; }
    finally { setBusy(false); }
  };
  const upload = async (file: File) => {
    if (!/\.(tar\.gz|tgz)$/i.test(file.name) || file.size > 2 * 1024 ** 3 || !file.size) { toast({ title: 'Choose a .tar.gz file up to 2 GB', variant: 'destructive' }); return; }
    stopped.current = false; setUploading(true); setUploadSize(file.size); setUploadName(file.name); setUploaded(0);
    try {
      const { archive: created } = await api.post<{ archive: Archive }>(ROOT, { name: file.name, size: file.size, fingerprint: await fingerprint(file) });
      setSelected(created.id); setTableId(''); setFileOffset(0); setUploaded(Math.min(file.size, created.uploadedChunks * created.chunkSize));
      for (let part = created.uploadedChunks; part < created.totalChunks; part++) {
        if (stopped.current) break;
        const start = part * created.chunkSize, end = Math.min(file.size, start + created.chunkSize);
        for (let attempt = 0; ; attempt++) {
          const abort = new AbortController(); abortRef.current = abort;
          try {
            const response = await fetch(buildApiUrl(`${ROOT}/${created.id}/chunks/${part}`), { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream' }, body: file.slice(start, end), signal: abort.signal });
            const body = await response.json().catch(() => ({}));
            if (!response.ok || body.archive?.id !== created.id || body.archive?.uploadedChunks < part + 1) {
              throw new Error(body.error || `Upload failed (${response.status}). Reselect the same file to resume.`);
            }
            break;
          } catch (e) { if (stopped.current || attempt >= 2) throw e; await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); }
        }
        setUploaded(end);
      }
      if (!stopped.current && await index(created.id)) toast({ title: 'Backup uploaded', description: 'The archive is now being extracted and indexed.' });
    } catch (e) { if (!stopped.current) toast({ title: 'Upload paused', description: e instanceof Error ? e.message : 'Reselect the same backup to resume.', variant: 'destructive' }); }
    finally { abortRef.current = null; setUploading(false); await refresh(); }
  };
  const changeArchive = (id: string) => { setSelected(id); setFileOffset(0); setTableId(''); setRowOffset(0); setViewer(null); };
  return <Card>
    <CardHeader><CardTitle className="flex items-center gap-2"><FileArchive className="h-5 w-5" />Legacy Software Archive</CardTitle><p className="text-sm text-muted-foreground">Explore the old software’s pages, receipts, uploaded files, and exported data. Only accounts with Developer access can open this archive.</p></CardHeader>
    <CardContent className="space-y-5">
      <div className="space-y-3 rounded-lg border border-dashed p-4">
        <label className="block space-y-2"><span className="flex items-center gap-2 text-sm font-medium"><Upload className="h-4 w-4" />Upload or resume a backup</span><Input type="file" accept=".tar.gz,.tgz" disabled={uploading} aria-label="Legacy backup file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} /></label>
        <p className="text-xs text-muted-foreground">Supports .tar.gz backups up to 2 GB. Uploads resume when you select the same file again. Include the database export to browse records; a files-only backup can still contain receipts and pages.</p>
        {uploading && <div className="space-y-2"><p className="break-all text-sm">{uploadName}</p><progress aria-label="Backup upload progress" value={uploaded} max={uploadSize} className="h-3 w-full accent-primary" /><div className="flex items-center justify-between gap-2"><span className="text-sm">{bytes(uploaded)} / {bytes(uploadSize)}</span><Button size="sm" variant="outline" onClick={() => { stopped.current = true; abortRef.current?.abort(); }}><Pause />Pause upload</Button></div></div>}
      </div>
      {archivesQuery.isLoading && <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading private archives…</p>}
      {archivesQuery.error && <p role="alert" className="text-sm text-destructive">{archivesQuery.error.message}</p>}
      {!archivesQuery.isLoading && !archivesQuery.error && !archives.length && <p className="text-sm text-muted-foreground">Upload your backup above to start exploring it.</p>}
      {!!archives.length && <label className="block space-y-2 text-sm font-medium">Backup<select className="min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={activeId} disabled={uploading} onChange={e => changeArchive(e.target.value)}>{archives.map(a => <option value={a.id} key={a.id}>{a.name} · {bytes(a.size)} · {a.status}</option>)}</select></label>}
      {archiveQuery.error && <p role="alert" className="text-sm text-destructive">{archiveQuery.error.message}</p>}
      {archive && <>
        <div className="flex flex-wrap items-center gap-2"><Badge variant={archive.status === 'ready' ? 'default' : 'secondary'}>{archive.status === 'processing' ? 'Indexing backup' : archive.status === 'uploading' ? 'Upload incomplete' : archive.status === 'failed' ? 'Indexing needs attention' : 'Ready'}</Badge><span className="text-sm text-muted-foreground">{Object.values(archive.counts).reduce((sum, count) => sum + count, 0).toLocaleString()} files · {archive.tableCount.toLocaleString()} data tables</span></div>
        {archive.status === 'uploading' && <p className="text-sm text-muted-foreground">{bytes(Math.min(archive.size, archive.uploadedChunks * archive.chunkSize))} uploaded. Select this same backup file above to continue.</p>}
        {archive.error && <p role="alert" className="text-sm text-destructive">{archive.error}</p>}
        {!!archive.warnings.length && <details className="text-sm"><summary>Import notes ({archive.warnings.length})</summary><ul className="mt-2 space-y-1">{archive.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
        {archive.status !== 'ready' && archive.uploadedChunks === archive.totalChunks && <Button variant="outline" disabled={busy || uploading} onClick={() => void index(archive.id)}>{busy && <Loader2 className="animate-spin" />}{archive.status === 'processing' ? 'Resume indexing' : 'Index backup'}</Button>}
        {archive.status !== 'uploading' && <>
          <div className="flex flex-wrap gap-2" aria-label="Archive categories">{([['all', 'All files'], ['receipt', 'Receipts'], ['data', 'Data files'], ['page', 'Pages & source'], ['file', 'Other files']] as const).map(([value, label]) => <Button key={value} size="sm" variant={category === value ? 'default' : 'outline'} aria-pressed={category === value} onClick={() => { setCategory(value); setFileOffset(0); }}>{label}{value !== 'all' && ` (${archive.counts[value]})`}</Button>)}</div>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search archived files" placeholder="Search filenames or folders…" className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setFileOffset(0); }} /></div>
          {files.error && <p role="alert" className="text-sm text-destructive">{files.error.message}</p>}
          <div className="divide-y rounded border">{files.data?.files.map(file => <div key={file.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-3"><div className="min-w-0 flex-1"><p className="break-all text-sm">{file.path}</p><p className="text-xs text-muted-foreground">{bytes(file.size)}</p></div><Button size="sm" variant="outline" onClick={() => setViewer(file)}>View</Button></div>)}{files.isLoading && <p className="p-4 text-sm">Loading files…</p>}{files.data?.total === 0 && <p className="p-4 text-sm text-muted-foreground">No matching files in this backup.</p>}</div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{files.data?.total ? `${fileOffset + 1}–${Math.min(fileOffset + 50, files.data.total)} of ${files.data.total.toLocaleString()}` : '0 files'}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!fileOffset} onClick={() => setFileOffset(Math.max(0, fileOffset - 50))}>Previous</Button><Button size="sm" variant="outline" disabled={!files.data || fileOffset + 50 >= files.data.total} onClick={() => setFileOffset(fileOffset + 50)}>Next</Button></div></div>
          {!!tables.data?.tables.length && <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Archived database records</h3><p className="text-xs text-muted-foreground">Read-only records extracted from SQL exports. Password and token columns are redacted.</p><select aria-label="Archived database table" className="min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={tableId} onChange={e => { setTableId(e.target.value); setRowOffset(0); }}><option value="">Choose a table…</option>{tables.data.tables.map(table => <option key={table.id} value={table.id}>{table.name} · {table.rowCount.toLocaleString()} records</option>)}</select>
            {rows.error && <p role="alert" className="text-sm text-destructive">{rows.error.message}</p>}
            {rows.isLoading && tableId && <p className="text-sm">Loading records…</p>}
            {rows.data && <><div className="max-h-[500px] overflow-auto rounded border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-muted"><tr>{rows.data.table.columns.map(column => <th className="whitespace-nowrap border-b p-2" key={column}>{column}</th>)}</tr></thead><tbody>{rows.data.rows.map((row, i) => <tr className="border-b" key={i}>{row.map((cell, j) => <td className="max-w-xs break-words p-2 align-top" key={j}>{cell ?? <span className="text-muted-foreground">NULL</span>}</td>)}</tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{rows.data.total ? `${rowOffset + 1}–${Math.min(rowOffset + 50, rows.data.total)} of ${rows.data.total.toLocaleString()} records` : '0 records'}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!rowOffset} onClick={() => setRowOffset(Math.max(0, rowOffset - 50))}>Previous records</Button><Button size="sm" variant="outline" disabled={rowOffset + 50 >= rows.data.total} onClick={() => setRowOffset(rowOffset + 50)}>Next records</Button></div></div></>}
          </section>}
          {archive.status === 'ready' && !archive.tableCount && <p className="text-sm text-muted-foreground">No SQL tables were found. If this backup contains only website files, upload a backup containing the database export to browse stored records.</p>}
        </>}
      </>}
      {viewer && <FileViewer key={viewer.id} archiveId={activeId} file={viewer} close={() => setViewer(null)} />}
    </CardContent>
  </Card>;
}
