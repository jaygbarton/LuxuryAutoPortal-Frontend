import { useQuery } from '@tanstack/react-query';
import InAppReceipt from '@/components/receipts/InAppReceipt';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildApiUrl } from '@/lib/queryClient';
import { useWorkspaceContext } from '@/hooks/use-workspace-location';

export function ChartEntryReceipts({ entryKey, onClose }: { entryKey: string; onClose: () => void }) {
  const { identity } = useWorkspaceContext();
  const receipts = useQuery<{ files: { name: string; url: string }[] }>({
    queryKey: ['/api/operations/chart-management/receipts', identity, entryKey],
    retry: false,
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/operations/chart-management/${encodeURIComponent(entryKey)}/receipts`), { credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.files)) throw new Error(data.error || 'Receipts could not be loaded.');
      return data;
    },
  });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Entry receipts</DialogTitle>
        <DialogDescription>Original attachments from the submitted form. Reviewing or assigning the chart entry does not edit that form.</DialogDescription>
      </DialogHeader>
      {receipts.isPending ? <p role="status">Loading receipts…</p> : receipts.isError ?
        <div role="alert">{receipts.error.message} <Button variant="outline" onClick={() => receipts.refetch()}>Retry receipts</Button></div> :
        receipts.data.files.length ? <div className="space-y-5">{receipts.data.files.map(file =>
          <section key={file.url} className="min-w-0 space-y-2 rounded-lg border p-3">
            <h3 className="text-sm font-semibold">{file.name}</h3>
            <InAppReceipt src={file.url} alt={file.name} expandable={false} className="h-[60dvh] w-full object-contain" />
          </section>)}</div> : <p>No receipt is attached to this entry. Manual chart entries do not attach files to the original forms.</p>}
      <Button variant="outline" className="h-11" onClick={onClose}>Close receipts</Button>
    </DialogContent>
  </Dialog>;
}
