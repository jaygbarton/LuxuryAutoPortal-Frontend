import { useEffect, useState } from 'react';
import { buildApiUrl } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, X } from 'lucide-react';

export function ServiceReceiptViewer({ carId,recordId,fileKey,onClose }: { carId: number; recordId: string; fileKey: string; onClose: () => void }) {
  const [file,setFile] = useState<{ url: string; type: string; filename: string } | null>(null);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let objectUrl: string | undefined;
    setFile(null); setError('');
    if (!Number.isSafeInteger(carId) || carId <= 0 || !recordId || !/^[a-f0-9]{64}$/.test(fileKey)) { setError('This service receipt link is invalid.'); return; }
    void (async () => {
      try {
        const response = await fetch(buildApiUrl(`/api/service-workspace/cars/${carId}/receipts/${encodeURIComponent(recordId)}/${fileKey}`),{ credentials: 'include',signal: controller.signal });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(response.status === 401 ? 'Sign in to Golden Luxury Auto with your staff account, then reopen this receipt.' : body?.error || 'The receipt could not be loaded.');
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (!blob.size) throw new Error('The original receipt file is empty.');
        objectUrl = URL.createObjectURL(blob);
        const filename = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)/i)?.[1] || 'service-receipt';
        setFile({ url: objectUrl,type: blob.type,filename });
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'The receipt could not be loaded.'); }
    })();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  },[carId,recordId,fileKey,retry]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="flex max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-4xl flex-col overflow-hidden p-3 sm:p-5">
    <Button type="button" variant="ghost" size="icon" aria-label="Close" className="absolute right-2 top-2 h-11 w-11" onClick={onClose}><X className="h-5 w-5" /></Button>
    <DialogHeader className="shrink-0 pr-12 text-left"><DialogTitle>Service receipt</DialogTitle><DialogDescription>Vehicle #{carId} · {recordId}</DialogDescription></DialogHeader>
    {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p className="break-words">{error}</p><Button variant="outline" onClick={() => setRetry(value => value+1)}>Retry receipt</Button></div> : !file ? <p role="status" className="flex items-center gap-2 py-8 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading receipt…</p> : <>
      <div className="min-h-0 overflow-auto">{file.type.startsWith('image/') ? <img src={file.url} alt="Service receipt" className="mx-auto max-h-[65dvh] max-w-full object-contain" /> : file.type === 'application/pdf' ? <iframe src={file.url} title="Service receipt PDF" className="h-[65dvh] w-full border-0" /> : <p className="py-6 text-sm">This file is ready to download.</p>}</div>
      <Button asChild variant="outline" className="min-h-11 shrink-0 self-start"><a href={file.url} download={file.filename}><Download className="mr-2 h-4 w-4" />Download receipt</a></Button>
    </>}
  </DialogContent></Dialog>;
}
