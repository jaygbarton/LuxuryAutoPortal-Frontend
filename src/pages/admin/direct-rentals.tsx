import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck, Copy, ExternalLink, FileText, Loader2, Plus, RotateCcw, Search, Tag, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { PriceBreakdown } from "@/components/direct-rental/PriceBreakdown";
import { BOOKING_PAGE, money, rentalApi, wallLabel, type AgreementSection, type CheckStatus, type Quote } from "@/lib/directRental";

type Status = "pending" | "requested" | "confirmed" | "active" | "completed" | "cancelled" | "expired";
interface Row {
  id: number; reference: string; status: Status; car: string; start: string; end: string; customer: string; email: string; phone: string;
  licenseStatus: CheckStatus; insuranceStatus: CheckStatus; insuranceChoice: "own" | "bonzah" | null; paymentStatus: string; dueNowCents: number; paidCents: number; signed: boolean; needsAttention: boolean;
}
interface Detail {
  id: number; reference: string; status: Status; version: number; createdAt: string; holdExpiresAt: string | null;
  car: { id: number; name: string; year: number | null; plate: string | null }; start: string; end: string; locationName: string; quote: Quote;
  customer: Record<string, any>; licenseStatus: CheckStatus; licenseProvider: string | null; insuranceChoice: "own" | "bonzah" | null; insuranceStatus: CheckStatus; insuranceProvider: string | null;
  protectionLabel: string | null; protectionCents: number; protectionPolicyId: string | null;
  paymentStatus: string; paidCents: number; paidAt: string | null; depositRefundedCents: number; canRefundOnline: boolean;
  agreement: { sections: AgreementSection[]; fields: Record<string, string>; defaults: Record<string, string>; edited: string[]; signed: boolean; signedRevision: number | null; signedAt: string | null; signedName: string | null };
  staffNotes: string | null; customerUrl: string;
}

const ROOT = "/api/admin/direct-rentals";
const STATUS: Record<Status, { label: string; tone: string }> = {
  pending: { label: "In progress", tone: "border-zinc-400 text-zinc-500" },
  requested: { label: "Needs payment", tone: "border-amber-500 text-amber-600" },
  confirmed: { label: "Confirmed", tone: "border-emerald-500 text-emerald-600" },
  active: { label: "On trip", tone: "border-sky-500 text-sky-600" },
  completed: { label: "Returned", tone: "border-zinc-400 text-zinc-500" },
  cancelled: { label: "Cancelled", tone: "border-red-400 text-red-500" },
  expired: { label: "Expired", tone: "border-zinc-300 text-zinc-400" },
};
const CHECK: Record<CheckStatus, string> = { not_started: "Not started", pending: "In progress", verified: "Verified", needs_review: "Needs review", failed: "Failed" };
const toCents = (text: string) => { const value = Number(text.replace(/[$,\s]/g, "")); return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null; };
const SELECT = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function StatusBadge({ status }: { status: Status }) { return <Badge variant="outline" className={STATUS[status].tone}>{STATUS[status].label}</Badge>; }
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm">{children || "—"}</dd></div>;
}

function TermsDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const terms = useQuery({ queryKey: [ROOT, "terms"], queryFn: () => rentalApi<{ terms: string; isDefault: boolean; defaultTerms: string }>(`${ROOT}/terms`) });
  const [text, setText] = useState<string | null>(null);
  const value = text ?? terms.data?.terms ?? "";
  const save = useMutation({
    mutationFn: () => rentalApi(`${ROOT}/terms`, "PUT", { terms: value }),
    onSuccess: () => { toast({ title: "Agreement terms saved" }); onClose(); },
    onError: (error: Error) => toast({ title: "Terms not saved", description: error.message, variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Rental agreement terms</DialogTitle>
          <DialogDescription>These terms print on every agreement signed from now on. Agreements already signed keep the terms they were signed with. Start each section with a line beginning "## " followed by its title; separate paragraphs with a blank line.</DialogDescription></DialogHeader>
        {terms.isLoading ? <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</p> : (
          <>
            <Textarea aria-label="Agreement terms" value={value} onChange={e => setText(e.target.value)} className="min-h-[50vh] font-mono text-xs leading-5" />
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" onClick={() => setText(terms.data?.defaultTerms ?? "")} disabled={value === terms.data?.defaultTerms}><RotateCcw className="mr-2 h-4 w-4" />Restore standard terms</Button>
              <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !value.trim()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save terms</Button></div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ExtraRow { id?: number; label: string; description: string; price: string; perDay: boolean; maxQuantity: number }
function ExtrasDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  type Extra = { id: number; label: string; description: string; unitCents: number; perDay: boolean; maxQuantity: number };
  const toRows = (list: Extra[]): ExtraRow[] => list.map(e => ({ id: e.id, label: e.label, description: e.description, price: (e.unitCents / 100).toFixed(2), perDay: e.perDay, maxQuantity: e.maxQuantity }));
  const saved = useQuery({ queryKey: [ROOT, "extras"], queryFn: () => rentalApi<{ extras: Extra[]; isDefault: boolean; defaults: Extra[] }>(`${ROOT}/extras`) });
  const [rows, setRows] = useState<ExtraRow[] | null>(null);
  const list = rows ?? (saved.data ? toRows(saved.data.extras) : []);
  const set = (index: number, patch: Partial<ExtraRow>) => setRows(list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const problem = list.find(row => row.label.trim().length < 2) ? "Every extra needs a name." : list.find(row => toCents(row.price) == null) ? "Every extra needs a price, such as 20 or 20.00." : null;
  const save = useMutation({
    mutationFn: () => rentalApi(`${ROOT}/extras`, "PUT", { extras: list.map(row => ({ ...(row.id ? { id: row.id } : {}), label: row.label.trim(), description: row.description.trim(), unitCents: toCents(row.price)!, perDay: row.perDay, maxQuantity: row.maxQuantity })) }),
    onSuccess: () => { toast({ title: "Extras saved", description: "New bookings use these prices. Bookings already started keep the price they were quoted." }); onClose(); },
    onError: (error: Error) => toast({ title: "Extras not saved", description: error.message, variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Extras and prices</DialogTitle>
          <DialogDescription>The add-ons offered on every direct rental. They start from the prices on the website's Extras page; keep them in line with the website and the Turo listings.</DialogDescription></DialogHeader>
        {saved.isLoading ? <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</p> : (
          <>
            <ul className="space-y-3" data-extras-editor>
              {list.map((row, index) => (
                <li key={row.id ?? `new-${index}`} className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,2fr)_6.5rem_7.5rem_5rem_2.5rem] sm:items-end">
                  <label className="col-span-2 text-xs text-muted-foreground sm:col-span-1">Name<Input aria-label={`Extra ${index + 1} name`} value={row.label} onChange={e => set(index, { label: e.target.value })} className="mt-1 text-foreground" /></label>
                  <label className="text-xs text-muted-foreground">Price ($)<Input aria-label={`Extra ${index + 1} price`} inputMode="decimal" value={row.price} onChange={e => set(index, { price: e.target.value })} className="mt-1 text-foreground" /></label>
                  <label className="text-xs text-muted-foreground">Charged<select aria-label={`Extra ${index + 1} charged`} className={`${SELECT} mt-1 block w-full text-foreground`} value={row.perDay ? "day" : "trip"} onChange={e => set(index, { perDay: e.target.value === "day" })}><option value="day">Per day</option><option value="trip">Per trip</option></select></label>
                  <label className="text-xs text-muted-foreground">Max<Input aria-label={`Extra ${index + 1} maximum quantity`} type="number" min={1} max={20} value={row.maxQuantity} onChange={e => set(index, { maxQuantity: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })} className="mt-1 text-foreground" /></label>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${row.label || "this extra"}`} onClick={() => setRows(list.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                  <label className="col-span-2 text-xs text-muted-foreground sm:col-span-5">Description shown to renters<Input aria-label={`Extra ${index + 1} description`} value={row.description} onChange={e => set(index, { description: e.target.value })} className="mt-1 text-foreground" /></label>
                </li>
              ))}
            </ul>
            {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setRows([...list, { label: "", description: "", price: "", perDay: true, maxQuantity: 1 }])}><Plus className="mr-2 h-4 w-4" />Add extra</Button>
                <Button variant="outline" onClick={() => setRows(toRows(saved.data?.defaults ?? []))}><RotateCcw className="mr-2 h-4 w-4" />Website prices</Button>
              </div>
              <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !!problem || rows === null}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save extras</Button></div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookingDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { toast } = useToast();
  const client = useQueryClient();
  const key = [ROOT, "detail", id];
  const detail = useQuery({ queryKey: key, queryFn: () => rentalApi<{ booking: Detail }>(`${ROOT}/${id}`), retry: false });
  const booking = detail.data?.booking;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [received, setReceived] = useState("");
  const [refund, setRefund] = useState("");
  const [confirming, setConfirming] = useState<"cancel" | "refund" | null>(null);
  useEffect(() => {
    if (!booking) return;
    setDraft(booking.agreement.fields); setNotes(booking.staffNotes ?? ""); setConfirming(null);
    setRefund(((Math.min(booking.quote.depositCents, booking.paidCents - booking.depositRefundedCents)) / 100).toFixed(2));
    // Reload the form only when the saved booking changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, booking?.version]);

  const change = useMutation({
    mutationFn: (args: { path: string; method: "PATCH" | "PUT" | "POST"; body: Record<string, unknown>; done: string }) =>
      rentalApi<{ booking: Detail }>(`${ROOT}/${id}${args.path}`, args.method, { ...args.body, version: booking!.version }),
    onSuccess: (result, args) => { client.setQueryData(key, result); void client.invalidateQueries({ queryKey: [ROOT, "list"] }); toast({ title: args.done }); },
    onError: (error: Error) => { toast({ title: "Not saved", description: error.message, variant: "destructive" }); void detail.refetch(); },
  });
  const patch = (body: Record<string, unknown>, done: string) => change.mutate({ path: "", method: "PATCH", body, done });
  const dirty = useMemo(() => !!booking && Object.keys(draft).some(k => (draft[k] ?? "") !== (booking.agreement.fields[k] ?? "")), [draft, booking]);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(booking!.customerUrl); toast({ title: "Renter link copied" }); }
    catch { toast({ title: "Copy failed", description: booking!.customerUrl }); }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <Button variant="ghost" size="icon" aria-label="Close booking" className="absolute right-2 top-2 z-20" onClick={onClose}><X className="h-4 w-4" /></Button>
        {detail.isLoading ? <><DialogHeader><DialogTitle>Loading booking…</DialogTitle></DialogHeader><Loader2 className="h-5 w-5 animate-spin" /></>
          : !booking ? <DialogHeader><DialogTitle>Booking not found</DialogTitle><DialogDescription>{(detail.error as Error)?.message}</DialogDescription></DialogHeader> : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3 pr-10">{booking.reference}<StatusBadge status={booking.status} /></DialogTitle>
              <DialogDescription>{[booking.car.year, booking.car.name, booking.car.plate].filter(Boolean).join(" · ")} · {wallLabel(booking.start)} to {wallLabel(booking.end)}</DialogDescription>
            </DialogHeader>
            {booking.staffNotes && booking.status !== "cancelled" && <p className="flex gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><span className="whitespace-pre-line">{booking.staffNotes}</span></p>}
            <Tabs defaultValue="overview">
              <TabsList><TabsTrigger value="overview">Booking</TabsTrigger><TabsTrigger value="agreement">Agreement{dirty ? " •" : ""}</TabsTrigger></TabsList>

              <TabsContent value="overview" className="space-y-6 pt-2">
                <div className="flex flex-wrap gap-2">
                  {booking.status === "requested" && <Button onClick={() => patch({ status: "confirmed" }, "Booking confirmed")} disabled={change.isPending}>Confirm booking</Button>}
                  {booking.status === "confirmed" && <Button onClick={() => patch({ status: "active" }, "Marked as picked up")} disabled={change.isPending}>Mark picked up</Button>}
                  {booking.status === "active" && <Button onClick={() => patch({ status: "completed" }, "Marked as returned")} disabled={change.isPending}>Mark returned</Button>}
                  {["pending", "requested", "confirmed"].includes(booking.status) && (confirming === "cancel"
                    ? <><Button variant="destructive" onClick={() => patch({ status: "cancelled" }, "Booking cancelled")} disabled={change.isPending}>Yes, cancel this booking</Button><Button variant="ghost" onClick={() => setConfirming(null)}>Keep it</Button></>
                    : <Button variant="outline" onClick={() => setConfirming("cancel")}>Cancel booking</Button>)}
                  <Button variant="outline" asChild><a href={buildApiUrl(`${ROOT}/${id}/agreement.pdf`)} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />Agreement PDF</a></Button>
                  <Button variant="outline" onClick={copyLink}><Copy className="mr-2 h-4 w-4" />Copy renter link</Button>
                </div>
                {confirming === "cancel" && booking.paidCents > 0 && <p className="text-sm text-amber-600">Cancelling does not refund the renter. Refund them below first if they are owed money.</p>}

                <div className="grid gap-6 md:grid-cols-2">
                  <section><h3 className="mb-2 text-sm font-semibold">Renter</h3>
                    <dl className="grid grid-cols-2 gap-3">
                      <Fact label="Name">{`${booking.customer.firstName ?? ""} ${booking.customer.lastName ?? ""}`.trim()}</Fact><Fact label="Date of birth">{booking.customer.dateOfBirth}</Fact>
                      <Fact label="Email"><a className="underline" href={`mailto:${booking.customer.email}`}>{booking.customer.email}</a></Fact><Fact label="Phone"><a className="underline" href={`tel:${booking.customer.phone}`}>{booking.customer.phone}</a></Fact>
                      <div className="col-span-2"><Fact label="Address">{[booking.customer.address, booking.customer.city, booking.customer.state, booking.customer.zip].filter(Boolean).join(", ")}</Fact></div>
                      <Fact label="License">{[booking.customer.licenseNumber, booking.customer.licenseState].filter(Boolean).join(" · ")}</Fact><Fact label="License expires">{booking.customer.licenseExpiry}</Fact>
                      <Fact label="Insurance">{booking.insuranceChoice === "bonzah" ? booking.protectionLabel : [booking.customer.insuranceCompany, booking.customer.insurancePolicyNumber].filter(Boolean).join(" · ")}</Fact>
                      <Fact label="Pick-up">{booking.locationName}</Fact>
                    </dl>
                    {(booking.customer.licenseEvidence?.reason || booking.customer.insuranceEvidence?.reasons?.length > 0) && <p className="mt-3 text-xs text-muted-foreground">{[booking.customer.licenseEvidence?.reason, ...(booking.customer.insuranceEvidence?.reasons ?? [])].filter(Boolean).join(" ")}</p>}
                  </section>
                  <section><h3 className="mb-2 text-sm font-semibold">Price</h3>
                    <div className="rounded-lg bg-white p-4 text-[#262626]"><PriceBreakdown quote={booking.quote} paidCents={booking.paidCents || undefined} /></div>
                    {booking.depositRefundedCents > 0 && <p className="mt-2 text-sm">Refunded so far: {money(booking.depositRefundedCents)}</p>}
                  </section>
                </div>

                <section className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium">Driver's license check{booking.licenseProvider ? ` (${booking.licenseProvider})` : ""}
                    <select aria-label="Driver's license check" className={`${SELECT} mt-1 block w-full`} value={booking.licenseStatus} disabled={change.isPending}
                      onChange={e => patch({ licenseStatus: e.target.value }, "License status saved")}>
                      {(["not_started", "pending", "verified", "needs_review", "failed"] as CheckStatus[]).map(s => <option key={s} value={s} disabled={s === "not_started" || s === "pending"}>{CHECK[s]}</option>)}
                    </select></label>
                  <label className="text-sm font-medium">Insurance check{booking.insuranceProvider ? ` (${booking.insuranceProvider})` : ""}
                    <select aria-label="Insurance check" className={`${SELECT} mt-1 block w-full`} value={booking.insuranceStatus} disabled={change.isPending}
                      onChange={e => patch({ insuranceStatus: e.target.value }, "Insurance status saved")}>
                      {(["not_started", "pending", "verified", "needs_review", "failed"] as CheckStatus[]).map(s => <option key={s} value={s} disabled={s === "not_started" || s === "pending"}>{CHECK[s]}</option>)}
                    </select></label>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <div><h3 className="mb-1 text-sm font-semibold">Payment taken outside the website</h3>
                    <p className="mb-2 text-xs text-muted-foreground">Status: {booking.paymentStatus}. Enter the total received by phone, card reader or cash.</p>
                    <div className="flex gap-2"><Input aria-label="Amount received" inputMode="decimal" placeholder={(booking.quote.dueNowCents / 100).toFixed(2)} value={received} onChange={e => setReceived(e.target.value)} />
                      <Button variant="outline" disabled={change.isPending || toCents(received) == null || !received.trim()} onClick={() => { patch({ recordPaymentCents: toCents(received) }, "Payment recorded"); setReceived(""); }}>Record</Button></div>
                  </div>
                  {booking.canRefundOnline && booking.paidCents - booking.depositRefundedCents > 0 && (
                    <div><h3 className="mb-1 text-sm font-semibold">Refund to the renter's card</h3>
                      <p className="mb-2 text-xs text-muted-foreground">Up to {money(booking.paidCents - booking.depositRefundedCents)} can be returned. Use this to return the deposit after the trip.</p>
                      <div className="flex flex-wrap gap-2"><Input aria-label="Refund amount" className="w-32" inputMode="decimal" value={refund} onChange={e => { setRefund(e.target.value); setConfirming(null); }} />
                        {confirming === "refund"
                          ? <><Button variant="destructive" disabled={change.isPending} onClick={() => change.mutate({ path: "/refund", method: "POST", body: { amountCents: toCents(refund) }, done: "Refund sent" })}>Send {money(toCents(refund) ?? 0)} back</Button><Button variant="ghost" onClick={() => setConfirming(null)}>Not now</Button></>
                          : <Button variant="outline" disabled={!toCents(refund)} onClick={() => setConfirming("refund")}>Refund</Button>}</div>
                    </div>
                  )}
                </section>

                <section><h3 className="mb-1 text-sm font-semibold">Staff notes</h3>
                  <Textarea aria-label="Staff notes" value={notes} onChange={e => setNotes(e.target.value)} className="min-h-24" />
                  <Button className="mt-2" variant="outline" disabled={change.isPending || notes === (booking.staffNotes ?? "")} onClick={() => patch({ staffNotes: notes }, "Notes saved")}>Save notes</Button>
                </section>
              </TabsContent>

              <TabsContent value="agreement" className="space-y-5 pt-2">
                <p className="rounded-md border p-3 text-sm">
                  {booking.agreement.signed ? `Signed by ${booking.agreement.signedName}${booking.agreement.signedAt ? ` on ${new Date(booking.agreement.signedAt).toLocaleString()}` : ""}.`
                    : booking.agreement.signedRevision != null ? "Changed after signing. The renter must sign again: send them the renter link." : "Not signed yet."}{" "}
                  Everything below is filled in from the booking. Change any field to override it. Changing something the renter signed means they must sign again; return, mileage, fuel and amount-received fields can be filled in after signing without a new signature.
                </p>
                {booking.agreement.sections.map(section => (
                  <fieldset key={section.key} className="rounded-md border p-4"><legend className="px-1 text-sm font-semibold">{section.title}</legend>
                    <div className="grid gap-3 md:grid-cols-2">
                      {section.fields.map(field => {
                        const value = draft[field.key] ?? "", standard = booking.agreement.defaults[field.key] ?? "", edited = value.trim() !== standard.trim();
                        return (
                          <label key={field.key} className={`text-xs text-muted-foreground ${field.multiline ? "md:col-span-2" : ""}`}>
                            <span className="flex items-center justify-between gap-2">{field.label}
                              {edited && <button type="button" className="text-xs text-primary underline" onClick={() => setDraft(d => ({ ...d, [field.key]: standard }))}>Edited · reset</button>}</span>
                            {field.multiline
                              ? <Textarea name={field.key} value={value} onChange={e => setDraft(d => ({ ...d, [field.key]: e.target.value }))} className="mt-1 min-h-20 text-sm text-foreground" />
                              : <Input name={field.key} value={value} onChange={e => setDraft(d => ({ ...d, [field.key]: e.target.value }))} className={`mt-1 text-sm text-foreground ${edited ? "border-primary" : ""}`} />}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
                <div className="sticky -bottom-4 z-10 -mx-4 flex flex-wrap gap-2 border-t bg-background px-4 pb-4 pt-3 sm:-bottom-6 sm:-mx-6 sm:px-6 sm:pb-6">
                  <Button disabled={!dirty || change.isPending} onClick={() => change.mutate({ path: "/agreement", method: "PUT", body: { fields: draft }, done: "Agreement saved" })}>{change.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save agreement</Button>
                  <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(booking.agreement.fields)}>Discard changes</Button>
                  <Button variant="outline" asChild><a href={buildApiUrl(`${ROOT}/${id}/agreement.pdf`)} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />View PDF</a></Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Staff view of direct rentals: every booking, its checks and payment, and the rental agreement. */
export default function DirectRentalsAdminPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(() => Number(new URLSearchParams(window.location.search).get("booking")) || null);
  const [terms, setTerms] = useState(false);
  const [extras, setExtras] = useState(false);
  const list = useQuery({ queryKey: [ROOT, "list", status, search.trim()], staleTime: 15_000,
    queryFn: () => rentalApi<{ bookings: Row[] }>(`${ROOT}?${new URLSearchParams({ ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}) })}`) });
  const rows = list.data?.bookings ?? [];
  const open = (id: number | null) => {
    setOpenId(id);
    window.history.replaceState(null, "", id ? `${window.location.pathname}?booking=${id}` : window.location.pathname);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="flex items-center gap-2 text-xl font-semibold leading-tight text-primary sm:text-2xl"><CalendarCheck className="h-6 w-6" />Direct Rentals</h1>
            <p className="mt-1 text-sm text-muted-foreground">Bookings made on our own website. Block a confirmed booking's dates on that vehicle's Turo calendar.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setExtras(true)}><Tag className="mr-2 h-4 w-4" />Extras and prices</Button>
            <Button variant="outline" onClick={() => setTerms(true)}><FileText className="mr-2 h-4 w-4" />Agreement terms</Button>
            <Button variant="outline" asChild><a href={BOOKING_PAGE} target="_blank" rel="noreferrer">Booking page<ExternalLink className="ml-2 h-4 w-4" /></a></Button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select aria-label="Status" className={SELECT} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All bookings</option>{(Object.keys(STATUS) as Status[]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search bookings" placeholder="Search by name, email, phone or reference" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>

        {list.isLoading ? <p className="flex items-center text-sm text-muted-foreground" role="status"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading bookings…</p>
          : list.isError ? <p role="alert" className="text-sm text-destructive">{(list.error as Error).message} <button type="button" className="underline" onClick={() => void list.refetch()}>Retry</button></p>
          : rows.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{status || search.trim() ? "No bookings match." : "No direct rentals yet. Bookings appear here as soon as a renter starts one."}</CardContent></Card>
          : (
            <ul className="space-y-2" data-rental-list>
              {rows.map(row => (
                <li key={row.id}>
                  <button type="button" onClick={() => open(row.id)} className="grid w-full gap-x-6 gap-y-2 rounded-lg border bg-card p-4 text-left hover:border-primary md:grid-cols-[1.2fr_1.3fr_1.5fr_auto] md:items-center">
                    <span><span className="flex items-center gap-2 font-medium">{row.customer || "No name yet"}{row.needsAttention && <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Needs attention" />}</span>
                      <span className="block text-xs text-muted-foreground">{row.reference}{row.phone ? ` · ${row.phone}` : ""}</span></span>
                    <span className="text-sm">{row.car}<span className="block text-xs text-muted-foreground">{wallLabel(row.start)} → {wallLabel(row.end)}</span></span>
                    <span className="text-xs text-muted-foreground">License: {CHECK[row.licenseStatus]} · Insurance: {row.insuranceChoice === "bonzah" ? "Bonzah" : CHECK[row.insuranceStatus]}
                      <span className="block">{row.signed ? "Agreement signed" : "Agreement not signed"} · {row.paidCents > 0 ? `Paid ${money(row.paidCents)}` : `Due ${money(row.dueNowCents)}`}</span></span>
                    <StatusBadge status={row.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
      {openId != null && <BookingDialog id={openId} onClose={() => open(null)} />}
      {terms && <TermsDialog onClose={() => setTerms(false)} />}
      {extras && <ExtrasDialog onClose={() => setExtras(false)} />}
    </AdminLayout>
  );
}
