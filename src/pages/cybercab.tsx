import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BatteryCharging,
  CarFront,
  Check,
  Clock,
  Handshake,
  Landmark,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollReveal, StaggeredReveal, StaggeredRevealItem } from "@/components/animations/ScrollReveal";
import { buildApiUrl } from "@/lib/queryClient";

/*
 * Cybercab owner program. Content follows GLA's "Robotaxi ownership" deck
 * (Nov 2026). Every figure is illustrative or sourced as dated below; the
 * program is not active until Salt Lake City opens to Cybercab fleets.
 */

const DEPOSIT = "$5,000";

const operatorServices = [
  { icon: BatteryCharging, title: "Charging", text: "Depot access and keeping the car charged and back on the road." },
  { icon: Sparkles, title: "Cleaning", text: "Fast cabin resets between rides, photo-documented." },
  { icon: Wrench, title: "Care", text: "Maintenance, inspections and repairs, tracked." },
  { icon: ShieldCheck, title: "Insurance", text: "Helping you find and manage coverage as products appear." },
  { icon: Clock, title: "Response", text: "Someone local who goes when a car needs help, 24/7." },
  { icon: Landmark, title: "Financing", text: "Help with the first car, the hardest one to buy alone." },
];

const scenarios = [
  { label: "Gross fares", low: "$3,300", base: "$9,333", up: "$17,500" },
  { label: "Network share (25% assumed)", low: "−$825", base: "−$2,333", up: "−$4,375" },
  { label: "Running costs", low: "−$1,087", base: "−$1,298", up: "−$1,572" },
  { label: "Loan payment ($30k, 10%, 60 mo)", low: "−$510", base: "−$510", up: "−$510" },
  { label: "Cash after the loan", low: "$878", base: "$5,192", up: "$11,043", strong: true },
];

const unknowns = [
  { title: "Tesla controls dispatch", text: "Tesla decides which cars get rides, who can join and the revenue split. Owner terms aren't published." },
  { title: "Regulation", text: "Federal regulators are reviewing the no-pedal design, and each city still has to approve service." },
  { title: "Insurance", text: "No policy yet covers a privately owned driverless car on a ride network." },
];

type FormState = { name: string; email: string; phone: string; city: "Salt Lake City" | "Wilmington, NC" | "Other"; cars: string; notes: string; accepts: boolean };
const emptyForm: FormState = { name: "", email: "", phone: "", city: "Salt Lake City", cars: "1", notes: "", accepts: false };

function ReservationForm() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.accepts) { setError(`Please confirm you understand the ${DEPOSIT} deposit is non-refundable.`); return; }
    setStatus("sending");
    try {
      const response = await fetch(buildApiUrl("/api/cybercab/reservations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, city: form.city,
          cars: Number(form.cars), notes: form.notes, acceptsNonRefundableDeposit: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Your reservation could not be sent. Please retry.");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your reservation could not be sent. Please retry.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div role="status" className="rounded-md border border-[#D3BC8D]/50 bg-white/6 p-6">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-[#D3BC8D] text-[#15110A]"><Check className="h-5 w-5" /></div>
        <h3 className="text-xl font-semibold text-white">Reservation received</h3>
        <p className="mt-2 text-sm leading-6 text-white/75">
          Thank you, {form.name.split(" ")[0] || "and welcome"}. Our team will contact you at {form.email} with payment
          instructions for the {DEPOSIT} deposit. Your place in line is held once the deposit is received.
        </p>
      </div>
    );
  }

  const field = "h-11 bg-white text-[#171717]";
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-md border border-white/14 bg-white/6 p-5 sm:grid-cols-2 sm:p-6" noValidate={false}>
      <label className="text-sm text-white/80 sm:col-span-2">Full name
        <Input required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} className={`mt-1 ${field}`} />
      </label>
      <label className="text-sm text-white/80">Email
        <Input required type="email" maxLength={255} autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={`mt-1 ${field}`} />
      </label>
      <label className="text-sm text-white/80">Phone
        <Input required type="tel" minLength={7} maxLength={40} autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={`mt-1 ${field}`} />
      </label>
      <label className="text-sm text-white/80">City
        <select value={form.city} onChange={(e) => set("city", e.target.value as FormState["city"])} className={`mt-1 w-full rounded-md border px-3 ${field}`}>
          <option>Salt Lake City</option><option>Wilmington, NC</option><option>Other</option>
        </select>
      </label>
      <label className="text-sm text-white/80">Cybercabs you'd like
        <Input required type="number" min={1} max={50} inputMode="numeric" value={form.cars} onChange={(e) => set("cars", e.target.value)} className={`mt-1 ${field}`} />
      </label>
      <label className="text-sm text-white/80 sm:col-span-2">Questions or notes (optional)
        <Textarea maxLength={2000} value={form.notes} onChange={(e) => set("notes", e.target.value)} className="mt-1 min-h-20 bg-white text-[#171717]" />
      </label>
      <label className="flex items-start gap-3 rounded-md border border-[#D3BC8D]/40 bg-[#D3BC8D]/10 p-4 text-sm leading-6 text-white/85 sm:col-span-2">
        <input type="checkbox" checked={form.accepts} onChange={(e) => set("accepts", e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#D3BC8D]" />
        <span>I understand the <strong>{DEPOSIT} deposit is non-refundable</strong>, that the program is not active yet, and that
          launch and delivery dates can't be guaranteed.</span>
      </label>
      {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={status === "sending"} className="w-full bg-[#D3BC8D] text-[#15110A] hover:bg-[#D3BC8D]/90 sm:w-auto">
          {status === "sending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Reserve my place
        </Button>
        <p className="mt-3 text-xs leading-5 text-white/55">No payment is taken on this page. We'll contact you with payment instructions.</p>
      </div>
    </form>
  );
}

export default function CybercabPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="public-page pt-20 lg:pt-24">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#070707] text-white">
          <div className="absolute inset-0">
            <img src="/gateway-buildings-hero.jpg" alt="" className="h-full w-full object-cover" aria-hidden="true" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,4,0.92),rgba(5,5,4,0.75)_50%,rgba(5,5,4,0.4)),linear-gradient(180deg,rgba(5,5,4,0.2),rgba(5,5,4,0.8))]" />
          </div>
          <div className="relative mx-auto grid min-h-[600px] max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-20">
            <ScrollReveal preset="hero" className="max-w-3xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D3BC8D]/50 bg-[#D3BC8D]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#D3BC8D]">
                <span className="h-2 w-2 rounded-full bg-[#D3BC8D]" aria-hidden="true" /> Coming to Salt Lake City · not active yet
              </p>
              <h1 className="font-serif text-4xl font-light leading-tight sm:text-5xl lg:text-6xl">
                Own a Cybercab.<br />Let it drive.<br /><span className="text-[#D3BC8D]">Let us run it.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
                Golden Luxury Auto is preparing to operate a fleet of Tesla Cybercabs in Salt Lake City and manage them for
                driverless rideshare. Owners supply the car; we handle everything on the ground. Join through our established
                operations instead of starting alone.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#reserve"><Button size="lg" className="w-full bg-[#D3BC8D] text-[#15110A] hover:bg-[#D3BC8D]/90 sm:w-auto">
                  Reserve with a {DEPOSIT} deposit <ArrowRight className="ml-2 h-4 w-4" /></Button></a>
                <a href="#how"><Button size="lg" variant="outline" className="w-full border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto">How it works</Button></a>
              </div>
            </ScrollReveal>

            <ScrollReveal preset="soft" delay={0.12} className="lg:justify-self-end">
              <div className="rounded-md border border-white/16 bg-[#0A0A09]/85 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-md">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#D3BC8D]">Where it stands</p>
                <h2 className="mt-1 text-2xl font-semibold">Not active yet</h2>
                <p className="mt-3 text-sm leading-6 text-white/75">
                  Tesla runs paid driverless rides in Texas and Florida today. Salt Lake City isn't served yet, though Utah law
                  already allows driverless operation. <strong className="text-white">When Salt Lake City is activated for Cybercab
                  fleets, we go:</strong> GLA moves forward with Cybercab purchases for reserved owners, in the order deposits were received.
                </p>
                <ol className="mt-5 grid gap-3 text-sm">
                  {["Reserve your place now", "Salt Lake City opens to Cybercab fleets", "We buy and set up your Cybercab with you", "GLA runs it day to day"].map((step, i) => (
                    <li key={step} className="flex items-center gap-3 rounded-md border border-white/12 bg-white/6 p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#D3BC8D] text-xs font-bold text-[#15110A]">{i + 1}</span>
                      <span className="text-white/85">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Why join through GLA */}
        <section className="border-b border-[#E6DDC7] bg-[#F7F4EC] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <ScrollReveal preset="soft">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#C49000]">Why join through GLA</p>
              <h2 className="mt-2 font-serif text-3xl font-light leading-tight text-[#171717] sm:text-4xl">Ride on an operation that's already running.</h2>
              <p className="mt-4 text-base leading-7 text-[#5D574A]">
                A driverless car still needs a local operator to charge it, clean it, fix it and respond when something goes wrong.
                That's the work Golden Luxury Auto already does every day for the owners in our Turo program. Joining our fleet
                puts you in line through an established operator instead of waiting to figure it out alone.
              </p>
              <p className="mt-4 text-sm leading-6 text-[#7A6B44]">
                Earlier access is our goal, not a guarantee: Tesla hasn't published fleet or owner terms yet.
              </p>
            </ScrollReveal>
            <StaggeredReveal className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: CarFront, title: "The owner", text: "Supplies the car and the capital. Earns from rides without driving." },
                { icon: Handshake, title: "The network", text: "Finds the rider, dispatches the car and collects the fare." },
                { icon: Wrench, title: "GLA, the operator", text: "Charges, cleans, inspects, insures and responds when something goes wrong." },
              ].map(({ icon: Icon, title, text }) => (
                <StaggeredRevealItem key={title} className="rounded-md border border-[#E2D8BF] bg-white p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-[#171717] text-[#D3BC8D]"><Icon className="h-5 w-5" /></div>
                  <h3 className="font-semibold text-[#171717]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5D574A]">{text}</p>
                </StaggeredRevealItem>
              ))}
            </StaggeredReveal>
          </div>
        </section>

        {/* What GLA handles */}
        <section id="how" className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal preset="soft" className="mb-8 max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#C49000]">Your local operator, on the ground</p>
              <h2 className="mt-2 font-serif text-3xl font-light text-[#171717] sm:text-4xl">Everything the car can't do for itself.</h2>
            </ScrollReveal>
            <StaggeredReveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {operatorServices.map(({ icon: Icon, title, text }) => (
                <StaggeredRevealItem key={title} className="flex gap-4 rounded-md border border-[#E2D8BF] bg-white p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                  <div><h3 className="font-semibold text-[#171717]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#5D574A]">{text}</p></div>
                </StaggeredRevealItem>
              ))}
            </StaggeredReveal>
            <p className="mt-5 text-sm text-[#7A6B44]">Services and terms, including GLA's management share, are set with each owner.</p>
          </div>
        </section>

        {/* Vehicle + numbers */}
        <section className="bg-[#0A0A09] px-4 py-14 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <ScrollReveal preset="soft">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">The vehicle</p>
              <h2 className="mt-2 font-serif text-3xl font-light leading-tight sm:text-4xl">Cybercab: a two-seat cabin built for passengers.</h2>
              <dl className="mt-6 grid gap-3">
                {[
                  { k: "$29,990", v: "Price before tax for select personal-use orders (opened Nov 13, 2026)" },
                  { k: "$299/mo", v: "Autonomy subscription required on those orders" },
                  { k: "Dec 2026", v: "Estimated first deliveries, Austin only" },
                ].map(({ k, v }) => (
                  <div key={k} className="border-l-2 border-[#D3BC8D] pl-4"><dt className="text-xl font-semibold">{k}</dt><dd className="text-sm leading-6 text-white/70">{v}</dd></div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-white/50">No steering wheel or pedals. Sources: Electrek, Nov 13, 2026; Not a Tesla App, Nov 14, 2026.</p>
            </ScrollReveal>
            <ScrollReveal preset="soft" delay={0.08}>
              <p className="text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">Illustrative numbers</p>
              <h2 className="mt-2 text-2xl font-semibold">One car, one month, three scenarios</h2>
              <div className="mt-5 overflow-x-auto rounded-md border border-white/14">
                <table className="w-full min-w-[460px] text-sm">
                  <thead className="bg-white/8 text-left text-white/70">
                    <tr><th className="p-3 font-medium">Per car, per month</th><th className="p-3 text-right font-medium">Low</th><th className="p-3 text-right font-medium">Base</th><th className="p-3 text-right font-medium">Upside</th></tr>
                  </thead>
                  <tbody>
                    {scenarios.map((row) => (
                      <tr key={row.label} className={`border-t border-white/10 ${row.strong ? "bg-[#D3BC8D]/12 font-semibold" : ""}`}>
                        <td className="p-3">{row.label}</td><td className="p-3 text-right tabular-nums">{row.low}</td><td className="p-3 text-right tabular-nums">{row.base}</td><td className="p-3 text-right tabular-nums">{row.up}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/55">
                Assumptions to test, not a quote or promise: 8 / 16 / 24 paid rides a day at $15 / $20 / $25. Before GLA's management
                share, taxes, the $299 subscription if it applies, and replacing the car. Tesla hasn't published owner terms; the 25%
                network share is an assumption.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Unknowns */}
        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal preset="soft" className="mb-8 max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#C49000]">Risks and unknowns</p>
              <h2 className="mt-2 font-serif text-3xl font-light text-[#171717] sm:text-4xl">What nobody can promise you yet.</h2>
            </ScrollReveal>
            <div className="grid gap-4 md:grid-cols-3">
              {unknowns.map((u) => (
                <div key={u.title} className="rounded-md border border-[#E2D8BF] bg-white p-5">
                  <ShieldAlert className="mb-3 h-5 w-5 text-[#C49000]" />
                  <h3 className="font-semibold text-[#171717]">{u.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5D574A]">{u.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-[#5D574A]">Fares in Salt Lake City are unknown until service starts, and delivery and launch dates can't be guaranteed.</p>
          </div>
        </section>

        {/* Reserve */}
        <section id="reserve" className="bg-[#0A0A09] px-4 py-14 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <ScrollReveal preset="soft">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">Reserve your place</p>
              <h2 className="mt-2 font-serif text-3xl font-light leading-tight sm:text-4xl">Get in line with a {DEPOSIT} deposit.</h2>
              <ul className="mt-6 grid gap-3 text-sm leading-6 text-white/78">
                {[
                  "Your deposit holds your place in GLA's Cybercab owner program and goes toward your Cybercab.",
                  "Places are kept in the order deposits are received.",
                  "Nothing is purchased until Salt Lake City is activated for Cybercab fleets.",
                  `The ${DEPOSIT} deposit is non-refundable.`,
                ].map((t) => <li key={t} className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-[#D3BC8D]" />{t}</li>)}
              </ul>
            </ScrollReveal>
            <ScrollReveal preset="soft" delay={0.08}><ReservationForm /></ScrollReveal>
          </div>
          <p className="mx-auto mt-10 max-w-7xl text-xs leading-5 text-white/45">
            Golden Luxury Auto is an independent fleet operator and is not affiliated with or endorsed by Tesla, Inc. Cybercab is a
            trademark of Tesla, Inc. Figures are illustrative assumptions from public reporting, not a quote, offer or promise of earnings.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
