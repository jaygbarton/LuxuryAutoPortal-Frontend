import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { lycRequest } from '@/lib/lyc';

type Preview = {
  user: { id: number; name: string; email: string };
  counts: { drafts: number; applications: number; documents: number };
  blockers: string[];
  version: string;
};
export function DeleteApplicantDialog({ accountId, onClose, onDeleted }: {
  accountId: number; onClose: () => void; onDeleted: (message: string) => void;
}) {
  const cache = useQueryClient();
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const preview = useQuery<Preview>({ queryKey: ['applicant-deletion-preview', accountId],
    queryFn: () => lycRequest(`/api/onboarding/applicants/${accountId}/deletion-preview`),
    staleTime: 0, gcTime: 0, retry: false,
  });
  const data = preview.data;
  const enabled = !!data && !preview.isFetching && !preview.error && !error && !data.blockers.length
    && confirmationEmail.trim().toLowerCase() === data.user.email.trim().toLowerCase() && !!reason.trim();
  const remove = async () => {
    if (!enabled || busy) return;
    setBusy(true); setError('');
    try {
      const result = await lycRequest(`/api/onboarding/applicants/${accountId}`, 'DELETE', { confirmationEmail, reason, version: data.version });
      await cache.invalidateQueries({ queryKey: ['/api/onboarding/applicants'] });
      await cache.invalidateQueries({ queryKey: ['/api/onboarding/submissions'] });
      onDeleted(result.message); onClose();
    } catch (error: any) { setError(error.message || 'The account could not be deleted.'); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Delete applicant account</DialogTitle>
        <DialogDescription>Review the account before permanently removing it. This cannot be undone.</DialogDescription>
      </DialogHeader>
      {preview.isLoading && <p role="status">Checking linked records…</p>}
      {preview.error && <p role="alert" className="text-destructive">{preview.error.message}</p>}
      {data && <div className="space-y-4">
        <div className="rounded-lg border p-3"><p className="font-semibold">{data.user.name}</p><p className="break-all text-sm">{data.user.email}</p><p className="mt-2 text-sm">{data.counts.drafts} saved applications · {data.counts.applications} submitted applications · {data.counts.documents} uploaded documents</p></div>
        {data.blockers.length > 0 ? <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">{data.blockers.map(blocker => <p key={blocker}>{blocker}</p>)}</div> : <>
          <p className="text-sm text-muted-foreground">This removes the applicant’s sign-in, saved details and applications. Uploaded documents will be queued for cleanup.</p>
          <label className="block text-sm">Reason for deletion<Input className="mt-1" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} disabled={busy}/></label>
          <label className="block text-sm">Enter the applicant email to confirm<Input className="mt-1" type="email" autoComplete="off" value={confirmationEmail} onChange={e => setConfirmationEmail(e.target.value)} disabled={busy}/></label>
        </>}
      </div>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        {(preview.error || error) && <Button variant="outline" disabled={busy || preview.isFetching} onClick={() => { setError(''); void preview.refetch(); }}>Refresh preview</Button>}
        <Button variant="destructive" disabled={!enabled || busy} onClick={() => void remove()}>{busy ? 'Deleting…' : 'Permanently delete account'}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
