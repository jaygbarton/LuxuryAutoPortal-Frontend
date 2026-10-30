import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildApiUrl, buildUploadApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { Camera, Loader2, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Option = { id: number; name: string };
type Context = {
  carId: number | null; carName: string; employeeId: number | null; employeeName: string | null;
  reservationId: string | null;
  submission: { id: number; status: string; carId: number } | null; preview?: boolean;
};
type Options = { data: { employees: Option[]; cars: Option[]; categoryFields: Record<string, { value: string; label: string }[]> } };
type Reading = { receiptUrl: string; amount: number | null; date: string | null; vendor: string | null; receiptNumber: string | null; enteredAt: string | null; exitedAt: string | null; needsManualEntry: boolean; gallons?: number | null; pricePerGallon?: number | null; readerStatus?: "busy" | "timeout" };

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.message || "Request failed. Please try again.");
  return body;
}

export function TripReceiptDialog({ taskId, bookingKey, kind = "parking", onClose, onComplete }: {
  taskId?: number;
  bookingKey?: string;
  kind?: "parking" | "gas";
  onClose: () => void;
  onComplete?: (submissionId: number) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const isFuel = kind === "gas";
  const endpoint = isFuel ? `/api/operations/return-receipts/${encodeURIComponent(bookingKey || "")}` : `/api/operations/tasks/${taskId}/airport-parking`;
  const queryKey = ["trip-receipt", kind, taskId ?? bookingKey];
  const title = isFuel ? "Gas reimbursed receipt" : "Airport parking receipt";
  const [previewDone, setPreviewDone] = useState(false);
  const [carId, setCarId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [managerReviewRequested, setManagerReviewRequested] = useState(false);
  const [managerReviewReason, setManagerReviewReason] = useState('');
  const [reviewInfoOpen, setReviewInfoOpen] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [busy, setBusy] = useState<"upload" | "submit" | null>(null);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const initialized = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const context = useQuery({
    queryKey, staleTime: 0,
    queryFn: async () => responseJson<Context>(await fetch(buildApiUrl(endpoint), { credentials: "include" })),
  });
  const options = useQuery({
    queryKey: ["/api/expense-form-submissions/options"],
    queryFn: async () => responseJson<Options>(await fetch(buildApiUrl("/api/expense-form-submissions/options"), { credentials: "include" })),
  });
  const fields = options.data?.data.categoryFields?.reimbursedBills ?? [];
  const fieldLabel = isFuel ? /^gas\s*[-–]?\s*reimbursed$/i : /^parking\s*[-–]?\s*airport$/i;
  const parkingField = fields.find((f) => fieldLabel.test(f.label.trim()))?.value;
  const employees = options.data?.data.employees ?? [], cars = options.data?.data.cars ?? [];
  useEffect(() => {
    if (!context.data || initialized.current) return;
    initialized.current = true;
    setCarId(context.data.carId ? String(context.data.carId) : "");
    setEmployeeId(context.data.employeeId ? String(context.data.employeeId) : "");
  }, [context.data]);
  const submissionId = savedId ?? context.data?.submission?.id;
  const declined = context.data?.submission?.status === "declined";

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) { setError("Choose a photo smaller than 10 MB."); return; }
    setBusy("upload"); setError(""); setReading(null); setAmount(""); setDate("");
    try {
      const body = new FormData(); body.append("receipt", file);
      const data = await responseJson<Reading>(await fetch(buildUploadApiUrl(`${endpoint}/receipt`), { method: "POST", credentials: "include", body }));
      setReading(data);
      if (data.amount !== null) setAmount(data.amount.toFixed(2));
      if (data.date) setDate(data.date);
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed. Please try again."); }
    finally { setBusy(null); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy("submit"); setError("");
    try {
      if (context.data?.preview) { setPreviewDone(true); return; }
      let id = submissionId;
      if (!id) {
        if (!reading?.receiptUrl || !parkingField || !carId || !employeeId || !date || !amount || Number(amount) <= 0) throw new Error("Upload the receipt and check the vehicle, employee, date, and amount.");
        if (!isFuel && managerReviewRequested && !managerReviewReason.trim()) throw new Error('Enter a reason for manager review.');
        const detail = [reading.vendor, reading.receiptNumber && `Receipt ${reading.receiptNumber}`, reading.enteredAt && `Entry: ${reading.enteredAt}`, reading.exitedAt && `Exit: ${reading.exitedAt}`, reading.gallons && `Gallons: ${reading.gallons}`, reading.pricePerGallon && `Price per gallon: $${reading.pricePerGallon}`, remarks].filter(Boolean).join("\n");
        const data = await responseJson<{ id: number }>(await fetch(buildApiUrl("/api/expense-form-submissions"), {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(isFuel ? { fuelReturnKey: bookingKey } : { airportPickupTaskId: taskId, ...(managerReviewRequested ? { managerReviewRequested: true, managerReviewReason: managerReviewReason.trim() } : {}) }), submissionDate: date, employeeId: Number(employeeId), carId: Number(carId), year: Number(date.slice(0,4)), month: Number(date.slice(5,7)), category: "reimbursedBills", field: parkingField, amount: Number(amount), receiptUrls: [reading.receiptUrl], remarks: detail }),
        }));
        if (!Number.isSafeInteger(data.id)) throw new Error("Could not confirm that the receipt was saved. Please reopen this form.");
        id = data.id;
        setSavedId(id);
        queryClient.invalidateQueries({ queryKey: ["/api/expense-form-submissions"] });
        queryClient.invalidateQueries({ queryKey: ['/api/operations/chart-management'] });
        queryClient.invalidateQueries({ queryKey: ['/api/operations/day-schedule/driver-rankings'] });
      }
      // Assignment is saved with the expense, even if completing the pickup
      // subsequently fails. Refresh it before the separate status mutation.
      await queryClient.invalidateQueries({ queryKey: ["/api/operations/day-schedule"] });
      await onComplete?.(id);
      queryClient.removeQueries({ queryKey });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish saving. Please retry.");
      // A dropped response can still mean the server saved it. Recover the durable link.
      void context.refetch().then(result => {
        if (result.data?.submission) void queryClient.invalidateQueries({ queryKey: ["/api/operations/day-schedule"] });
      });
    } finally { setBusy(null); }
  }

  const loadError = context.error || options.error;
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="top-auto bottom-0 max-h-[94dvh] w-full translate-y-0 gap-3 overflow-y-auto rounded-b-none rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:top-[50%] sm:max-h-[92dvh] sm:max-w-xl sm:translate-y-[-50%] sm:rounded-xl sm:p-6" onInteractOutside={(event) => event.preventDefault()}>
      <DialogHeader className="text-left"><DialogTitle className="text-base sm:text-lg">{title}</DialogTitle><DialogDescription className="text-xs leading-relaxed sm:text-sm">{context.data?.preview ? "Try the receipt reader. No real expense or Refuel Run will be created." : isFuel ? "Upload your receipt to submit Gas Reimbursed and complete a Refuel Run. The expense stays pending approval." : "Upload your parking receipt, check the details, and complete this airport pickup."}</DialogDescription></DialogHeader>
      {context.isLoading || options.isLoading ? <p role="status">Loading pickup details…</p> : loadError ? <div role="alert"><p>{loadError.message}</p><Button onClick={() => { void context.refetch(); void options.refetch(); }}>Retry</Button></div> : <form onSubmit={submit} className="space-y-4">
        {context.data?.preview && <p role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Direct booking preview only. This form does not create an expense or change a real booking.</p>}
        <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs font-medium">{context.data?.carName}{context.data?.reservationId ? ` · Reservation ${context.data.reservationId}` : ""}</p>
        {submissionId ? <div role="status" className="rounded-md border p-3 text-sm">
          {declined ? "This receipt was declined. Correct the existing submission in Forms → My submissions." : isFuel ? "The Gas Reimbursed receipt and completed Refuel Run are already saved for this return. Another expense or task will not be created." : "The receipt is saved for approval. Finish completing this pickup below; another expense will not be created."}
        </div> : <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0"><Label htmlFor="parking-car" className="text-xs">Vehicle</Label><select id="parking-car" className="mt-1 h-11 w-full min-w-0 rounded-lg border bg-background px-2 text-base sm:text-sm" value={carId} onChange={(e) => setCarId(e.target.value)} required disabled={!!busy || !!context.data?.carId}>
              <option value="">Select vehicle</option>{cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>{!context.data?.carId && <p className="text-xs text-amber-700">The vehicle could not be matched safely. Select it from the list.</p>}</div>
            <div className="min-w-0"><Label htmlFor="parking-employee" className="text-xs">Employee</Label><select id="parking-employee" className="mt-1 h-11 w-full min-w-0 rounded-lg border bg-background px-2 text-base sm:text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required disabled={!!busy}>
              <option value="">Select employee</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select><p className="text-xs text-muted-foreground mt-1">{context.data?.preview ? "Select the employee for this preview." : context.data?.employeeId || context.data?.employeeName?.trim() ? "Existing task assignments will be kept." : "Submitting assigns this unassigned task to the employee you select."}</p></div>
          </div>
          <div className="space-y-2">
            <div className="relative rounded-xl border border-dashed border-primary/50 bg-primary/5 focus-within:ring-2 focus-within:ring-ring">
              <Label htmlFor="parking-receipt" className="flex min-h-20 cursor-pointer items-center justify-center gap-3 px-3 py-4 text-sm"><Camera className="h-5 w-5 text-primary" /><span>{reading ? "Replace receipt photo" : "Take or upload receipt photo"}</span></Label>
              <Input ref={inputRef} id="parking-receipt" aria-label="Receipt photo" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp,.heic,.heif" disabled={!!busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
            </div>
            <p className="text-xs text-muted-foreground">Keep the total and date in focus. JPEG, PNG, HEIC or WebP · up to 10 MB.</p>
            {busy === "upload" && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Uploading and reading receipt…</p>}
            {reading && <img className="max-h-48 max-w-full rounded border object-contain" src={getProxiedImageUrl(reading.receiptUrl)} alt={`Uploaded ${isFuel ? "gas" : "airport parking"} receipt`} />}
            {reading?.needsManualEntry ? <p role="alert" className="text-sm text-destructive">{reading.readerStatus === "busy" ? "The receipt reader is busy. Your photo is uploaded; you can select it again to retry, or enter the values below." : reading.readerStatus === "timeout" ? "Reading took too long. Your photo and any readable values are saved in this form." : "Could not reliably read every required field."} Please manually enter any missing date or amount and check the receipt.</p> : reading ? <p className="text-sm text-muted-foreground">Date and amount filled from the receipt. Please check them before submitting.</p> : null}
          </div>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-950">Please double-check the amount, date, and other values against the receipt before submitting. The receipt reader can make mistakes.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0"><Label htmlFor="parking-date" className="text-xs">Receipt date</Label><Input id="parking-date" className="mt-1 h-11 min-w-0 text-base sm:text-sm" type="date" required value={date} onChange={(e) => setDate(e.target.value)} disabled={!!busy} /></div>
            <div className="min-w-0"><Label htmlFor="parking-amount" className="text-xs">Amount ($)</Label><Input id="parking-amount" className="mt-1 h-11 min-w-0 text-base sm:text-sm" type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!!busy} /></div>
          </div>
          <div><Label htmlFor="parking-notes" className="text-xs">Notes (optional)</Label><Input id="parking-notes" className="mt-1 h-11 text-base sm:text-sm" maxLength={1500} value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={!!busy} /></div>
          {!isFuel&&<section className="rounded-lg border border-amber-200 bg-amber-50/60 p-3" aria-label="Airport manager review request">
            <div className="flex min-h-11 items-center gap-2">
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-5 w-5 accent-primary" checked={managerReviewRequested} onChange={e=>setManagerReviewRequested(e.target.checked)} disabled={!!busy}/>Request manager review</label>
              <Popover open={reviewInfoOpen} onOpenChange={setReviewInfoOpen}><PopoverTrigger asChild><Button type="button" variant="ghost" className="h-11 w-11 shrink-0 p-0" aria-label="About manager review requests" onPointerEnter={e=>{if(e.pointerType==='mouse')setReviewInfoOpen(true);}}><Info className="h-5 w-5"/></Button></PopoverTrigger><PopoverContent side="top" className="text-sm" role="note">Use this for a special circumstance, such as a delayed return, an unusual parking charge, or a ticket that should count under another driver. Explain the reason below. The ticket appears yellow in Chart Management until a manager reviews it. This does not automatically include it in the charts or approve reimbursement.</PopoverContent></Popover>
            </div>
            {managerReviewRequested&&<div className="mt-2"><Label htmlFor="parking-manager-review-reason" className="text-xs">Reason for manager review</Label><textarea id="parking-manager-review-reason" required maxLength={1000} minLength={1} value={managerReviewReason} onChange={e=>setManagerReviewReason(e.target.value)} disabled={!!busy} className="mt-1 min-h-20 w-full rounded-lg border bg-background p-3 text-base sm:text-sm" placeholder="Explain what happened so the manager can review this ticket."/></div>}
          </section>}
          {!parkingField && <p role="alert" className="text-sm text-destructive">{isFuel ? "Gas Reimbursed" : "Parking Airport"} is unavailable in your expense options. Contact an administrator.</p>}
        </>}
        {previewDone && <p role="status" className="text-sm text-emerald-800">Receipt preview checked. No expense was created.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background pt-3 sm:flex-row sm:justify-end">
          <Button type="button" className="h-11" variant="outline" onClick={onClose} disabled={!!busy}>Cancel</Button>
          <Button type="submit" className="h-11 text-sm" disabled={!!busy || declined || previewDone || (!submissionId && (!reading || !parkingField))}>
            {busy === "submit" ? "Saving…" : context.data?.preview ? "Finish receipt preview" : submissionId ? isFuel ? "Close" : "Complete pickup" : isFuel ? "Submit gas receipt" : "Submit receipt & complete pickup"}
          </Button>
        </div>
      </form>}
    </DialogContent>
  </Dialog>;
}
