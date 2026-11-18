import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SignatureCanvas from "react-signature-canvas";
import { CalendarDays, Check, CheckCircle2, Clock, ExternalLink, FileText, Loader2, Lock, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceBreakdown } from "@/components/direct-rental/PriceBreakdown";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";
import { useNoIndex } from "@/hooks/use-no-index";
import {
  BOOKING_PAGE, RENTAL_OFFICE_PHONE, RentalApiError, STEP_LABELS, US_STATES, milesLine, money, rentalApi, shortDay, wallLabel,
  type AgreementView, type BookingView, type CustomerDetails, type StepKey,
} from "@/lib/directRental";

const STEPS: StepKey[] = ["details", "license", "insurance", "agreement", "payment"];
const GOLD = "bg-[#D3BC8D] text-[#211B11] hover:bg-[#E3CCA0]";
const FIELD = "mt-1 border-[#DCD5C7] bg-white text-[#262626]";
type Result = { booking: BookingView; redirectUrl?: string | null };
type Post = (path: string, body?: unknown, method?: "POST" | "PUT") => Promise<Result>;
interface StepProps { booking: BookingView; post: Post; onDone: () => void }

function Notice({ tone = "info", children }: { tone?: "info" | "error" | "good"; children: ReactNode }) {
  const styles = { info: "border-[#E3DACA] bg-[#FAF8F2] text-[#4A4438]", error: "border-[#E7C4B5] bg-[#FBF1EC] text-[#8A3A1E]", good: "border-[#BFD9C4] bg-[#F0F7F1] text-[#24552E]" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm leading-6 ${styles}`}>{children}</div>;
}
function Field({ label, error, className = "", children }: { label: string; error?: string | null; className?: string; children: ReactNode }) {
  return <label className={`block text-sm font-medium text-[#3A352B] ${className}`}>{label}{children}{error && <span role="alert" className="mt-1 block text-xs font-normal text-[#A23B1E]">{error}</span>}</label>;
}
/** One step's request. The page itself stores the returned booking and follows a provider redirect. */
function useAction(post: Post, onDone?: () => void) {
  return useMutation({
    mutationFn: (args: { path: string; body?: unknown; method?: "POST" | "PUT" }) => post(args.path, args.body, args.method),
    onSuccess: result => { if (!result.redirectUrl) onDone?.(); },
  });
}
const Spinner = ({ on }: { on: boolean }) => (on ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null);
const errorText = (error: unknown) => (error ? (error as Error).message : null);

function DetailsStep({ booking, post, onDone, signedIn }: StepProps & { signedIn: boolean }) {
  const [form, setForm] = useState<CustomerDetails>(booking.customer);
  const [employer, setEmployer] = useState(!!booking.customer.employer);
  const save = useAction(post, onDone);
  const failure = save.error as RentalApiError | null;
  const bind = (key: keyof CustomerDetails) => ({
    value: form[key], name: key,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(current => ({ ...current, [key]: e.target.value })),
  });
  const wrong = (key: keyof CustomerDetails) => (failure?.field === key ? failure.message : null);
  const states = (key: "state" | "licenseState" | "employerState", label: string) => (
    <Field label={label} error={wrong(key)}>
      <select {...bind(key)} aria-label={label} className={`${FIELD} block h-11 w-full rounded-md border px-3 text-base sm:h-9 sm:text-sm`} required={key !== "employerState"}>
        <option value="">Select</option>{US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </Field>
  );
  return (
    <form className="space-y-6" onSubmit={e => { e.preventDefault(); save.mutate({ path: "/details", method: "PUT", body: form }); }}>
      {signedIn
        ? <Notice>You're signed in, so we filled in what we already have on file. Check it and add anything missing.</Notice>
        : <p className="text-sm text-[#686868]">Have an account with us? <a className="font-medium text-[#87632C] underline" href={`/login?next=${encodeURIComponent(`/book/checkout/${booking.token}`)}`}>Sign in</a> and we'll fill in your saved details.</p>}
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#686868]">Driver</legend>
        <Field label="First name" error={wrong("firstName")}><Input {...bind("firstName")} className={FIELD} autoComplete="given-name" required /></Field>
        <Field label="Last name" error={wrong("lastName")}><Input {...bind("lastName")} className={FIELD} autoComplete="family-name" required /></Field>
        <Field label="Email" error={wrong("email")}><Input {...bind("email")} type="email" className={FIELD} autoComplete="email" required /></Field>
        <Field label="Mobile phone" error={wrong("phone")}><Input {...bind("phone")} type="tel" className={FIELD} autoComplete="tel" required /></Field>
        <Field label="Date of birth" error={wrong("dateOfBirth")}><Input {...bind("dateOfBirth")} type="date" className={FIELD} autoComplete="bday" required /></Field>
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#686868]">Home address</legend>
        <Field label="Street address" className="sm:col-span-6" error={wrong("address")}><Input {...bind("address")} className={FIELD} autoComplete="street-address" required /></Field>
        <Field label="City" className="sm:col-span-3" error={wrong("city")}><Input {...bind("city")} className={FIELD} autoComplete="address-level2" required /></Field>
        <div className="sm:col-span-1">{states("state", "State")}</div>
        <Field label="ZIP code" className="sm:col-span-2" error={wrong("zip")}><Input {...bind("zip")} className={FIELD} autoComplete="postal-code" inputMode="numeric" required /></Field>
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#686868]">Driver's license</legend>
        <Field label="License number" error={wrong("licenseNumber")}><Input {...bind("licenseNumber")} className={FIELD} autoComplete="off" required /></Field>
        {states("licenseState", "Issuing state")}
        <Field label="Expiration date" error={wrong("licenseExpiry")}><Input {...bind("licenseExpiry")} type="date" className={FIELD} required /></Field>
      </fieldset>
      {employer ? (
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#686868]">Employer (optional)</legend>
          <Field label="Employer"><Input {...bind("employer")} className={FIELD} autoComplete="organization" /></Field>
          <Field label="Employer phone"><Input {...bind("employerPhone")} type="tel" className={FIELD} /></Field>
          <Field label="Employer city"><Input {...bind("employerCity")} className={FIELD} /></Field>
          {states("employerState", "Employer state")}
        </fieldset>
      ) : <button type="button" className="text-sm font-medium text-[#87632C] underline" onClick={() => setEmployer(true)}>Add employer details (optional)</button>}
      {failure && !(failure.field && failure.field in form) && <Notice tone="error">{failure.message}</Notice>}
      <p className="flex items-start gap-2 text-xs leading-5 text-[#686868]"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />Your license number, date of birth and address are stored encrypted and used only for this rental.</p>
      <Button type="submit" size="lg" className={`min-h-12 ${GOLD}`} disabled={save.isPending}><Spinner on={save.isPending} />Save and continue</Button>
    </form>
  );
}

function LicenseStep({ booking, post, onDone }: StepProps) {
  const act = useAction(post, onDone);
  const { status, reason } = booking.license;
  const settled = status === "verified" || status === "needs_review";
  if (!booking.providers.licence) return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-[#4A4438]">We check your physical driver's license when you pick up the car. The name must match this booking and the license must be valid through {shortDay(booking.end)}.</p>
      {act.isError && <Notice tone="error">{errorText(act.error)}</Notice>}
      <Button size="lg" className={`min-h-12 ${GOLD}`} disabled={act.isPending} onClick={() => (settled ? onDone() : act.mutate({ path: "/licence" }))}><Spinner on={act.isPending} />I'll bring my license. Continue</Button>
    </div>
  );
  return (
    <div className="space-y-4">
      {status === "verified" && <Notice tone="good">Your driver's license is verified.</Notice>}
      {status === "needs_review" && <Notice>{reason || "Your license was received."} Our team will review it before pick-up. You can keep going.</Notice>}
      {status === "failed" && <Notice tone="error">{reason || "Your license could not be verified."}</Notice>}
      {status === "pending" && <Notice>We're still waiting for the result of your license check. It usually takes under a minute.</Notice>}
      {(status === "not_started" || status === "failed") && <p className="text-sm leading-7 text-[#4A4438]">You'll take a photo of your driver's license and a quick selfie on a secure Stripe page. It takes about two minutes, then you come straight back here.</p>}
      {act.isError && <Notice tone="error">{errorText(act.error)}</Notice>}
      <div className="flex flex-wrap gap-3">
        {settled && <Button size="lg" className={`min-h-12 ${GOLD}`} onClick={onDone}>Continue</Button>}
        {status === "pending" && <Button size="lg" className={`min-h-12 ${GOLD}`} disabled={act.isPending} onClick={() => act.mutate({ path: "/licence/refresh" })}><Spinner on={act.isPending} />Check again</Button>}
        {!settled && <Button size="lg" variant={status === "pending" ? "outline" : "default"} className={`min-h-12 ${status === "pending" ? "" : GOLD}`} disabled={act.isPending} onClick={() => act.mutate({ path: "/licence" })}>
          {status !== "pending" && <Spinner on={act.isPending} />}{status === "not_started" ? "Verify my license" : status === "pending" ? "Start over" : "Try again"}</Button>}
      </div>
    </div>
  );
}

function InsuranceStep({ booking, post, onDone }: StepProps) {
  const { providers, insurance } = booking;
  const [choice, setChoice] = useState<"own" | "bonzah">(insurance.choice === "bonzah" && providers.rentalInsurance ? "bonzah" : "own");
  const [manual, setManual] = useState(!providers.insurance);
  const [policy, setPolicy] = useState({ insuranceCompany: insurance.company, insurancePolicyNumber: insurance.policyNumber, insuranceAgent: insurance.agent, insuranceAgentPhone: insurance.agentPhone });
  const [covers, setCovers] = useState<string[]>(["cdw", "rcli"]);
  const act = useAction(post, onDone);
  const failure = act.error as RentalApiError | null;
  const price = useQuery({
    queryKey: ["/api/direct-rentals/bookings", booking.token, "rental-insurance", [...covers].sort().join(",")], enabled: choice === "bonzah" && covers.length > 0, retry: false, staleTime: 60_000,
    queryFn: () => rentalApi<{ premiumCents: number }>(`/api/direct-rentals/bookings/${booking.token}/insurance/rental/price`, "POST", { covers }),
  });
  const toggle = (code: string, on: boolean) => setCovers(current => {
    const next = on ? [...current, code] : current.filter(c => c !== code);
    return next.includes("rcli") ? next : next.filter(c => c !== "sli");
  });
  const own = insurance.choice === "own", settled = insurance.status === "verified" || insurance.status === "needs_review";
  const bind = (key: keyof typeof policy) => ({ value: policy[key], onChange: (e: ChangeEvent<HTMLInputElement>) => setPolicy(current => ({ ...current, [key]: e.target.value })) });

  return (
    <div className="space-y-5">
      {providers.rentalInsurance && (
        <div role="radiogroup" aria-label="Insurance for this rental" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([["own", "Use my own auto insurance", "Your policy must cover rental vehicles."], ["bonzah", "Buy rental insurance", "Coverage for this trip from Bonzah, added to your total."]] as const).map(([key, title, text]) => (
            <button key={key} type="button" role="radio" aria-checked={choice === key} onClick={() => setChoice(key)}
              className={`rounded-xl border p-4 text-left ${choice === key ? "border-[#96712D] bg-[#FBF7EC] ring-1 ring-[#96712D]" : "border-[#DCD5C7] bg-white hover:border-[#C9B98F]"}`}>
              <span className="block font-medium">{title}</span><span className="mt-1 block text-sm text-[#686868]">{text}</span>
            </button>
          ))}
        </div>
      )}

      {choice === "own" && (
        <div className="space-y-4">
          {own && insurance.status === "verified" && <Notice tone="good">Verified: {insurance.company} policy {insurance.policyNumber}.</Notice>}
          {own && insurance.status === "needs_review" && <Notice>We have your policy{insurance.company ? ` with ${insurance.company}` : ""}. {insurance.reasons.join(" ") || "Our team will confirm it before pick-up."} You can keep going.</Notice>}
          {own && insurance.status === "failed" && <Notice tone="error">{insurance.reasons.join(" ") || "This policy could not be confirmed for a rental vehicle."} Try another policy{providers.rentalInsurance ? " or buy rental insurance" : ""}.</Notice>}
          {own && insurance.status === "pending" && <Notice>The insurance check was not finished. Start it again or enter your policy details.</Notice>}
          {!manual ? (
            <>
              <p className="text-sm leading-7 text-[#4A4438]">Sign in to your insurance company on a secure page so we can confirm your policy is active and covers a rental. It takes about a minute.</p>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="lg" className={`min-h-12 ${GOLD}`} disabled={act.isPending} onClick={() => act.mutate({ path: "/insurance/own" })}><Spinner on={act.isPending} />{own && insurance.status !== "not_started" ? "Verify again" : "Verify my insurance"}</Button>
                <button type="button" className="text-sm font-medium text-[#87632C] underline" onClick={() => setManual(true)}>Enter my policy details instead</button>
              </div>
            </>
          ) : (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); act.mutate({ path: "/insurance/manual", body: policy }); }}>
              <p className="text-sm leading-7 text-[#4A4438]">Enter the auto policy that will cover this rental. Our team confirms it with your insurer before pick-up.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Insurance company" error={failure?.field === "insuranceCompany" ? failure.message : null}><Input {...bind("insuranceCompany")} className={FIELD} required /></Field>
                <Field label="Policy number" error={failure?.field === "insurancePolicyNumber" ? failure.message : null}><Input {...bind("insurancePolicyNumber")} className={FIELD} autoComplete="off" required /></Field>
                <Field label="Agent name (optional)"><Input {...bind("insuranceAgent")} className={FIELD} /></Field>
                <Field label="Agent phone (optional)"><Input {...bind("insuranceAgentPhone")} type="tel" className={FIELD} /></Field>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" size="lg" className={`min-h-12 ${GOLD}`} disabled={act.isPending}><Spinner on={act.isPending} />Save and continue</Button>
                {providers.insurance && <button type="button" className="text-sm font-medium text-[#87632C] underline" onClick={() => setManual(false)}>Verify online instead</button>}
              </div>
            </form>
          )}
          {own && settled && !manual && <Button variant="outline" className="min-h-11" onClick={onDone}>Keep this policy and continue</Button>}
          {!providers.rentalInsurance && <p className="text-xs leading-5 text-[#686868]">No auto insurance of your own? Call {RENTAL_OFFICE_PHONE} and we'll help you arrange cover for the trip.</p>}
        </div>
      )}

      {choice === "bonzah" && (
        <div className="space-y-4">
          {insurance.choice === "bonzah" && settled && <Notice tone="good">Added: {insurance.protectionLabel} for {money(insurance.protectionCents)}.</Notice>}
          <fieldset className="space-y-2"><legend className="sr-only">Coverage</legend>
            {booking.rentalInsuranceOptions.map(option => {
              const locked = option.code === "sli" && !covers.includes("rcli");
              return (
                <label key={option.code} className={`flex items-start gap-3 rounded-lg border border-[#E3DACA] bg-white p-3 text-sm ${locked ? "opacity-60" : "cursor-pointer"}`}>
                  <Checkbox className="mt-0.5" disabled={locked} checked={covers.includes(option.code)} onCheckedChange={on => toggle(option.code, !!on)} />
                  <span><span className="font-medium">{option.name}</span><span className="block text-[#686868]">{option.summary}</span></span>
                </label>
              );
            })}
          </fieldset>
          <p className="text-sm" role="status">
            {covers.length === 0 ? "Choose at least one coverage." : price.isLoading ? "Getting the price…" : price.isError ? <span className="text-[#8A3A1E]">{errorText(price.error)}</span>
              : price.data ? <>Price for this trip: <strong>{money(price.data.premiumCents)}</strong>. Paid to Bonzah through us, with no added fees.</> : null}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className={`min-h-12 ${GOLD}`} disabled={act.isPending || covers.length === 0 || !price.data} onClick={() => act.mutate({ path: "/insurance/rental", body: { covers } })}>
              <Spinner on={act.isPending} />{insurance.choice === "bonzah" && settled ? "Update rental insurance" : "Add rental insurance"}</Button>
            {insurance.choice === "bonzah" && settled && <Button variant="outline" size="lg" className="min-h-12" onClick={onDone}>Keep it and continue</Button>}
          </div>
        </div>
      )}
      {failure && !failure.field?.startsWith("insurance") && <Notice tone="error">{failure.message}</Notice>}
    </div>
  );
}

function AgreementStep({ booking, post, onDone }: StepProps) {
  const pad = useRef<SignatureCanvas>(null);
  const [name, setName] = useState(booking.agreement.signedName || `${booking.customer.firstName} ${booking.customer.lastName}`.trim());
  const [drawn, setDrawn] = useState(false);
  const [agree, setAgree] = useState(false);
  const sign = useAction(post, onDone);
  const doc = useQuery({ queryKey: ["/api/direct-rentals/bookings", booking.token, "agreement", booking.version], retry: false,
    queryFn: () => rentalApi<AgreementView>(`/api/direct-rentals/bookings/${booking.token}/agreement`) });
  if (doc.isLoading) return <p role="status" className="flex items-center text-sm text-[#686868]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing your agreement…</p>;
  if (doc.isError || !doc.data) return <Notice tone="error">{errorText(doc.error) || "The agreement could not be loaded."} <button type="button" className="underline" onClick={() => void doc.refetch()}>Retry</button></Notice>;
  const { sections, fields, terms } = doc.data;
  const submit = () => {
    const image = pad.current && !pad.current.isEmpty() ? pad.current.toDataURL("image/png") : "";
    sign.mutate({ path: "/agreement/sign", body: { signature: image, name: name.trim(), agree: true } });
  };
  return (
    <div className="space-y-5">
      {booking.agreement.changedSinceSigning && <Notice>Something in the agreement changed after you signed it. Please review it and sign again.</Notice>}
      {booking.agreement.signed && <Notice tone="good">Signed by {booking.agreement.signedName}. You can continue, or sign again below to replace your signature.</Notice>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-[#4A4438]">Your details are filled in for you. Read the agreement, then sign at the bottom.</p>
        <a href={buildApiUrl(`/api/direct-rentals/bookings/${booking.token}/agreement.pdf`)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-[#87632C] underline"><FileText className="h-4 w-4" />Open as PDF<ExternalLink className="h-3 w-3" /></a>
      </div>
      <div data-agreement className="max-h-[28rem] space-y-6 overflow-y-auto rounded-xl border border-[#DCD5C7] bg-white p-4 sm:p-6" tabIndex={0} aria-label="Rental agreement">
        <p className="text-center font-serif text-xl">Golden Luxury Auto Rental Agreement</p>
        {sections.map(section => {
          const shown = section.fields.filter(f => (fields[f.key] ?? "").trim());
          return shown.length ? (
            <section key={section.key}>
              <h4 className="mb-2 border-b border-[#E8E1D5] pb-1 text-xs font-semibold uppercase tracking-wide text-[#87632C]">{section.title}</h4>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {shown.map(f => <div key={f.key} className={f.multiline ? "sm:col-span-2" : ""}><dt className="text-xs text-[#8A8275]">{f.label}</dt><dd className="whitespace-pre-line">{fields[f.key]}</dd></div>)}
              </dl>
            </section>
          ) : null;
        })}
        {terms.map(part => (
          <section key={part.title}>
            <h4 className="mb-2 text-sm font-semibold">{part.title}</h4>
            {part.paragraphs.map((text, i) => <p key={i} className="mb-2 text-sm leading-6 text-[#4A4438]">{text}</p>)}
          </section>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full legal name"><Input value={name} onChange={e => setName(e.target.value)} className={FIELD} autoComplete="name" /></Field>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between"><span className="text-sm font-medium text-[#3A352B]">Signature</span>
          <button type="button" className="min-h-9 px-2 text-sm text-[#87632C] underline" onClick={() => { pad.current?.clear(); setDrawn(false); }}>Clear</button></div>
        <div className="overflow-hidden rounded-md border-2 border-[#C9B98F] bg-white">
          <SignatureCanvas ref={pad} penColor="black" clearOnResize={false} onEnd={() => setDrawn(!!pad.current && !pad.current.isEmpty())}
            canvasProps={{ className: "h-36 w-full touch-none bg-white", "aria-label": "Draw your signature" }} />
        </div>
        <p className="mt-1 text-xs text-[#8A8275]">Sign with your finger or mouse.</p>
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6"><Checkbox className="mt-1" checked={agree} onCheckedChange={v => setAgree(!!v)} />
        <span>I have read and agree to the Golden Luxury Auto Rental Agreement, and I agree that my electronic signature is as valid as a handwritten one.</span></label>
      {sign.isError && <Notice tone="error">{errorText(sign.error)}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" className={`min-h-12 ${GOLD}`} disabled={sign.isPending || !drawn || !agree || name.trim().length < 2} onClick={submit}><Spinner on={sign.isPending} />Sign agreement</Button>
        {booking.agreement.signed && <Button size="lg" variant="outline" className="min-h-12" onClick={onDone}>Continue without re-signing</Button>}
      </div>
    </div>
  );
}

function PaymentStep({ booking, post }: StepProps) {
  const pay = useAction(post);
  const online = booking.providers.payment;
  return (
    <div className="space-y-4">
      {online
        ? <p className="text-sm leading-7 text-[#4A4438]">You'll pay <strong>{money(booking.quote.dueNowCents)}</strong> on a secure Stripe page: {money(booking.quote.tripTotalCents)} for the trip plus the {money(booking.quote.depositCents, 0)} security deposit, which we return 10 to 21 days after you bring the car back, less any charges under the agreement.</p>
        : <p className="text-sm leading-7 text-[#4A4438]">Online payment isn't switched on yet. Send your request and our rental office will contact you to take payment of <strong>{money(booking.quote.dueNowCents)}</strong> and confirm your booking. The car is not confirmed until then.</p>}
      {booking.payment.status === "processing" && <Notice>A payment page was already opened. If you didn't finish paying, start again here.</Notice>}
      {pay.isError && <Notice tone="error">{errorText(pay.error)}</Notice>}
      <Button data-pay size="lg" className={`min-h-14 w-full text-base font-semibold sm:w-auto sm:px-10 ${GOLD}`} disabled={pay.isPending} onClick={() => pay.mutate({ path: "/payment" })}>
        {pay.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}{online ? `Pay ${money(booking.quote.dueNowCents)}` : "Send booking request"}
      </Button>
    </div>
  );
}

function HoldTimer({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15_000); return () => window.clearInterval(timer); }, []);
  const minutes = Math.max(0, Math.ceil((Date.parse(until) - now) / 60_000));
  return <p className="flex items-start gap-2 text-sm text-[#4A4438]" role="status"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#87632C]" />
    {minutes > 0 ? `We're holding this car for you for ${minutes} more minute${minutes === 1 ? "" : "s"}. The hold extends while you keep going.` : "Your hold has run out. Finish now if the car is still free, or start again."}</p>;
}

function TripSummary({ booking }: { booking: BookingView }) {
  return (
    <aside aria-label="Your trip" className="space-y-5 rounded-2xl border border-[#E3DACA] bg-white p-5 lg:sticky lg:top-24">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#87632C]">Booking {booking.reference}</p>
        <h2 className="mt-1 font-serif text-2xl leading-tight">{[booking.car.year, booking.car.name].filter(Boolean).join(" ")}</h2></div>
      <ul className="space-y-2 text-sm text-[#4A4438]">
        <li className="flex gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#87632C]" /><span>Pick-up {wallLabel(booking.start)}<br />Return {wallLabel(booking.end)}</span></li>
        <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#87632C]" />{booking.locationName}</li>
      </ul>
      <PriceBreakdown quote={booking.quote} paidCents={booking.payment.status === "paid" ? booking.payment.paidCents : undefined} />
      <p className="text-xs leading-5 text-[#686868]">{milesLine(booking.quote)}. Questions? Call <a className="underline" href={`tel:${RENTAL_OFFICE_PHONE}`}>{RENTAL_OFFICE_PHONE}</a>.</p>
    </aside>
  );
}

function Confirmation({ booking }: { booking: BookingView }) {
  const paid = booking.status !== "requested";
  return (
    <section data-confirmation className="rounded-2xl border border-[#E3DACA] bg-white p-6 sm:p-8">
      <CheckCircle2 className="h-10 w-10 text-[#2F6B3A]" />
      <h1 className="mt-4 font-serif text-4xl leading-tight">{paid ? "You're booked." : "We have your request."}</h1>
      <p className="mt-3 text-sm leading-7 text-[#4A4438]">
        {paid ? `Your ${booking.car.name} is confirmed from ${wallLabel(booking.start)} to ${wallLabel(booking.end)}. We emailed your confirmation and signed agreement to ${booking.customer.email}.`
          : `Our rental office will contact you at ${booking.customer.phone} to take payment and confirm your ${booking.car.name}. The car is not confirmed until then.`}
      </p>
      <p className="mt-4 text-sm">Booking reference <strong>{booking.reference}</strong></p>
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[#686868]">What happens next</h2>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-[#4A4438]">
        {["Bring your physical driver's license to pick-up. The name must match this booking.",
          `Pick up at ${booking.locationName}. We'll send exact hand-off instructions before your trip.`,
          paid ? `Your ${money(booking.quote.depositCents, 0)} deposit is returned 10 to 21 days after you return the car, less any charges under the agreement.` : "Nothing has been charged.",
        ].map(text => <li key={text} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[#87632C]" />{text}</li>)}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="outline" className="min-h-11"><a href={buildApiUrl(`/api/direct-rentals/bookings/${booking.token}/agreement.pdf`)} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" />Rental agreement (PDF)</a></Button>
        <Button asChild variant="outline" className="min-h-11"><a href={`tel:${RENTAL_OFFICE_PHONE}`}><Phone className="mr-2 h-4 w-4" />{RENTAL_OFFICE_PHONE}</a></Button>
      </div>
    </section>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF8F2] text-[#262626]">
      <header className="sticky top-0 z-30 border-b border-[#2A2A2A] bg-[#171717] text-white">
        <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link href={BOOKING_PAGE} aria-label="Golden Luxury Auto, back to vehicles"><img src="/logo.png" alt="Golden Luxury Auto" className="h-9 w-auto" /></Link>
          <p className="flex items-center gap-2 text-sm text-[#DFC899]"><Lock className="h-4 w-4" />Secure booking</p>
          <a href={`tel:${RENTAL_OFFICE_PHONE}`} className="hidden items-center gap-2 text-sm text-white/80 hover:text-white sm:flex"><Phone className="h-4 w-4" />{RENTAL_OFFICE_PHONE}</a>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8 lg:py-12">{children}</main>
    </div>
  );
}

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

export default function BookCheckoutPage() {
  useNoIndex();
  const [, params] = useRoute("/book/checkout/:token/:back?");
  const token = params?.token ?? "", back = params?.back ?? "";
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const key = ["/api/direct-rentals/bookings", token];
  const base = `/api/direct-rentals/bookings/${token}`;
  const [open, setOpen] = useState<StepKey | null>(null);
  const [returning, setReturning] = useState(!!back);
  const [note, setNote] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const handled = useRef(false);

  const query = useQuery({ queryKey: key, enabled: !!token && !returning, retry: false, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false,
    queryFn: () => rentalApi<{ booking: BookingView }>(base) });
  const me = useQuery({ queryKey: ["/api/auth/me"], queryFn: authMeQueryFn, retry: false, staleTime: 30_000 });
  const post: Post = async (path, body, method = "POST") => {
    const result = await rentalApi<Result>(`${base}${path}`, method, body ?? {});
    client.setQueryData(key, { booking: result.booking });
    if (result.redirectUrl) window.location.assign(result.redirectUrl);
    return result;
  };

  // Coming back from Stripe or the insurance check: pick up the result, then show the plain checkout address.
  useEffect(() => {
    if (!back || handled.current) return;
    handled.current = true;
    const search = new URLSearchParams(window.location.search);
    (async () => {
      try {
        if (back === "licence-return") await post("/licence/refresh");
        else if (back === "insurance-return") {
          const code = search.get("authCode");
          if (code) await post("/insurance/own/complete", { authCode: code });
          else setNote({ tone: "info", text: "The insurance check was not finished. You can start it again or enter your policy details." });
        } else if (back === "payment-return") {
          for (let attempt = 0; attempt < 6; attempt++) {
            const { booking } = await post("/payment/sync");
            if (booking.payment.status === "paid") break;
            if (attempt === 5) setNote({ tone: "info", text: "Your payment is still being confirmed. This page will update, and we'll email you as soon as it clears." });
            else await sleep(2000);
          }
        } else if (back === "payment-cancelled") {
          await post("/payment/cancel");
          setNote({ tone: "info", text: "Payment was cancelled and nothing was charged. You can pay whenever you're ready." });
        }
      } catch (error) { setNote({ tone: "error", text: (error as Error).message }); }
      finally { setReturning(false); setLocation(`/book/checkout/${token}`, { replace: true }); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const booking = query.data?.booking;
  if (returning || query.isLoading || (!booking && !query.isError) || (booking && !query.isFetchedAfterMount && query.isFetching))
    return <Shell><p role="status" className="flex min-h-[40vh] items-center justify-center text-[#686868]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{returning ? "Checking the result…" : "Loading your booking…"}</p></Shell>;
  if (!booking) return (
    <Shell><div role="alert" className="mx-auto max-w-xl rounded-2xl border border-[#DCD5C7] bg-white p-8 text-center">
      <p className="font-serif text-2xl">{errorText(query.error) || "This booking could not be loaded."}</p>
      <Button asChild className={`mt-6 min-h-11 ${GOLD}`}><Link href={BOOKING_PAGE}>Choose a vehicle</Link></Button>
    </div></Shell>
  );

  const banner = <>
    {booking.providers.testMode && <div className="mb-5"><Notice>Test mode. No real charges or checks are made.</Notice></div>}
    {note && <div className="mb-5"><Notice tone={note.tone}>{note.text}</Notice></div>}
  </>;
  if (booking.status === "expired" || booking.status === "cancelled") return (
    <Shell><div className="mx-auto max-w-xl rounded-2xl border border-[#DCD5C7] bg-white p-8 text-center">
      <p className="font-serif text-2xl">{booking.status === "expired" ? "Your hold on this vehicle expired." : "This booking was cancelled."}</p>
      <p className="mt-3 text-sm text-[#686868]">{booking.status === "expired" ? "Nothing was charged. Start again to check the car is still free." : `Questions? Call ${RENTAL_OFFICE_PHONE}.`}</p>
      <Button asChild className={`mt-6 min-h-11 ${GOLD}`}><Link href={`${BOOKING_PAGE}?car=${booking.car.id}&start=${booking.start}&end=${booking.end}`}>Book again</Link></Button>
    </div></Shell>
  );
  if (booking.status !== "pending") return (
    <Shell>{banner}<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(300px,4fr)]">
      <div className="space-y-5">
        <Confirmation booking={booking} />
        {!booking.agreement.signed && booking.steps.insurance && ["requested", "confirmed"].includes(booking.status) && (
          <section className="rounded-2xl border border-[#E3DACA] bg-white p-5 sm:p-6"><h2 className="mb-4 font-serif text-2xl">Sign the updated agreement</h2>
            <AgreementStep booking={booking} post={post} onDone={() => undefined} /></section>
        )}
      </div>
      <TripSummary booking={booking} />
    </div></Shell>
  );

  const next = booking.steps.next === "done" ? "payment" : booking.steps.next;
  const reachable = (step: StepKey) => STEPS.indexOf(step) <= STEPS.indexOf(next);
  const current = open && reachable(open) ? open : next;
  const done = () => setOpen(null);
  const summary: Record<StepKey, string> = {
    details: [`${booking.customer.firstName} ${booking.customer.lastName}`.trim(), booking.customer.email].filter(Boolean).join(" · "),
    license: booking.license.status === "verified" ? "Verified" : booking.providers.licence ? "Received, to be reviewed" : "Checked at pick-up",
    insurance: booking.insurance.choice === "bonzah" ? `${booking.insurance.protectionLabel ?? "Rental insurance"} · ${money(booking.insurance.protectionCents)}` : [booking.insurance.company, booking.insurance.status === "verified" ? "verified" : "to be confirmed"].filter(Boolean).join(" · "),
    agreement: booking.agreement.signedName ? `Signed by ${booking.agreement.signedName}` : "Signed",
    payment: "",
  };
  const body: Record<StepKey, ReactNode> = {
    details: <DetailsStep booking={booking} post={post} onDone={done} signedIn={!!me.data?.user} />,
    license: <LicenseStep booking={booking} post={post} onDone={done} />,
    insurance: <InsuranceStep booking={booking} post={post} onDone={done} />,
    agreement: <AgreementStep booking={booking} post={post} onDone={done} />,
    payment: <PaymentStep booking={booking} post={post} onDone={done} />,
  };

  return (
    <Shell>
      {banner}
      <div className="mb-6"><h1 className="font-serif text-4xl leading-tight">Finish your booking</h1>
        {booking.holdExpiresAt && <div className="mt-3"><HoldTimer until={booking.holdExpiresAt} /></div>}</div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(300px,4fr)]">
        <ol className="min-w-0 space-y-4" data-checkout-steps>
          {STEPS.map((step, index) => {
            const complete = booking.steps[step], isOpen = step === current, locked = !reachable(step);
            return (
              <li key={step} data-step={step} data-state={isOpen ? "open" : complete ? "done" : "locked"} className={`rounded-2xl border bg-white ${isOpen ? "border-[#C9B98F] shadow-[0_8px_28px_rgba(36,37,30,0.05)]" : "border-[#E3DACA]"}`}>
                <div className="flex items-center gap-4 p-5 sm:px-6">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${complete ? "bg-[#2F6B3A] text-white" : isOpen ? "bg-[#D3BC8D] text-[#211B11]" : "bg-[#EFEAE0] text-[#8A8275]"}`}>
                    {complete ? <Check className="h-4 w-4" /> : index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className={`text-lg font-semibold ${locked ? "text-[#8A8275]" : ""}`}>{STEP_LABELS[step]}</h2>
                    {!isOpen && complete && summary[step] && <p className="truncate text-sm text-[#686868]">{summary[step]}</p>}
                  </div>
                  {!isOpen && complete && <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setOpen(step)}>Change</Button>}
                </div>
                {isOpen && <div className="border-t border-[#EFEAE0] p-5 sm:p-6">{body[step]}</div>}
              </li>
            );
          })}
          <li className="flex items-start gap-2 px-1 text-xs leading-5 text-[#686868]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#87632C]" />
            {booking.providers.payment ? "Payments and license checks run on Stripe. Card numbers never touch our servers." : "Your details are sent over an encrypted connection and stored encrypted."}</li>
        </ol>
        <TripSummary booking={booking} />
      </div>
    </Shell>
  );
}
