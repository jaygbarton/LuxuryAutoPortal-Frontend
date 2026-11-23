import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, BatteryCharging, Check, Clock, Landmark, Loader2, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SiteStatsStrip } from "@/components/layout/site-stats-strip";
import { ScrollReveal, StaggeredReveal, StaggeredRevealItem } from "@/components/animations/ScrollReveal";
import { buildApiUrl } from "@/lib/queryClient";
import { US_CITY_POINTS, US_MAP_VIEWBOX, US_STATE_PATHS } from "@/lib/us-map";

/*
 * GLA's robotaxi program (Tesla Cybercab), Salt Lake City. The program is not
 * active until Salt Lake City opens to Cybercab fleets. City status and
 * vehicle facts are from public reporting dated below; update CITY_STATUS and
 * STATUS_AS_OF together.
 */

const MEMBERSHIP = "$5,000";
const STATUS_AS_OF = "November 23, 2026";

const GLA_RECORD = [
  { value: "9 years", label: "of hosting experience" },
  { value: "25,000+", label: "trips completed" },
  { value: "Up to 176", label: "vehicles managed" },
  { value: "2,815", label: "5-star Google reviews" },
];

/*
 * States whose laws allow fully driverless operation (no human in the car),
 * permits aside: the 21 "fully legalized" states in Elevation Proving
 * Grounds' state-by-state review (updated July 20, 2026) plus Colorado, whose
 * statute that review describes as authorizing driverless operation and
 * which DockDuty (Oct 29, 2026) lists as driverless.
 */
const FSD_FRIENDLY_STATES = new Set([
  "Alabama", "Arizona", "California", "Colorado", "Florida", "Georgia", "Iowa", "Kansas", "Louisiana", "Michigan", "Mississippi",
  "Nebraska", "Nevada", "North Carolina", "North Dakota", "Oklahoma", "Pennsylvania", "South Dakota", "Tennessee", "Texas", "Utah", "West Virginia",
]);

type MapCity = { city: string; status: "cybercab" | "robotaxi" | "testing" | "soon"; note: string };
const MAP_CITIES: MapCity[] = [
  { city: "Austin, TX", status: "cybercab", note: "Cybercab rides since September 2026. The only city with Cybercab deliveries listed for buyers (December 2026)." },
  { city: "Dallas, TX", status: "cybercab", note: "Cybercab rides since November 19, 2026." },
  { city: "Houston, TX", status: "robotaxi", note: "Driverless Model Y. Cybercabs spotted in September 2026" },
  { city: "Fort Worth, TX", status: "robotaxi", note: "Driverless Model Y" },
  { city: "San Antonio, TX", status: "robotaxi", note: "Model Y" },
  { city: "Miami, FL", status: "robotaxi", note: "Driverless Model Y" },
  { city: "Orlando, FL", status: "robotaxi", note: "Driverless" },
  { city: "Tampa, FL", status: "robotaxi", note: "Driverless Model Y" },
  { city: "San Francisco Bay Area, CA", status: "robotaxi", note: "Model Y with a safety monitor on board" },
  { city: "Salt Lake City, UT", status: "testing", note: "Cybercab testing and sightings, including Park City (September 2026). Where GLA's robotaxi program will launch." },
  { city: "Philadelphia, PA", status: "testing", note: "Cybercabs seen at a Tesla location in the area, reportedly in training (September 2026)" },
  { city: "Chicago, IL", status: "testing", note: "Reported sightings" },
  { city: "Washington, DC", status: "testing", note: "Reported sightings" },
  { city: "Las Vegas, NV", status: "soon", note: "Named by Tesla as a next market" },
  { city: "Phoenix, AZ", status: "soon", note: "Named by Tesla as a next market" },
  { city: "Jacksonville, FL", status: "soon", note: "Coming soon" },
];

function CybercabMap() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <figure className="m-0">
      <svg viewBox={US_MAP_VIEWBOX} role="img" aria-labelledby="cybercab-map-title" className="h-auto w-full" data-testid="cybercab-us-map">
        <title id="cybercab-map-title">Map of US states with driverless-friendly laws and cities with Tesla robotaxi service</title>
        <g>
          {US_STATE_PATHS.map((state) => (
            <path key={state.name} d={state.d} data-state={state.name} data-friendly={FSD_FRIENDLY_STATES.has(state.name) || undefined}
              fill={FSD_FRIENDLY_STATES.has(state.name) ? "#EADBB8" : "#E6E3DD"} stroke="#FFFFFF" strokeWidth={1.2} strokeLinejoin="round">
              <title>{state.name}{FSD_FRIENDLY_STATES.has(state.name) ? ": driverless-friendly law" : ""}</title>
            </path>
          ))}
        </g>
        <g>
          {MAP_CITIES.map(({ city, status }) => {
            const point = US_CITY_POINTS[city];
            if (!point) return null;
            const [x, y] = point;
            const live = status === "cybercab" || status === "robotaxi";
            const on = active === city;
            return (
              <g key={city} data-city={city} data-status={status} onMouseEnter={() => setActive(city)} onMouseLeave={() => setActive(null)}>
                {status === "cybercab" && <circle cx={x} cy={y} r={on ? 19 : 16} fill="none" stroke="#96712D" strokeWidth={3} opacity={0.55} />}
                {status === "testing" ? (
                  <circle cx={x} cy={y} r={on ? 11 : 9} fill="none" stroke="#96712D" strokeWidth={3.5}><title>{city}</title></circle>
                ) : (
                <circle cx={x} cy={y} r={on ? 11 : 9} fill={live ? "#96712D" : "#9A9488"} stroke="#FFFFFF" strokeWidth={2.5}>
                  <title>{city}</title>
                </circle>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <figcaption className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#625C50]">
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-5 rounded-sm bg-[#EADBB8]" />State law allows driverless cars</span>
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-5 rounded-sm bg-[#E6E3DD]" />Not yet</span>
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#96712D] ring-2 ring-[#96712D]/40 ring-offset-1" />Cybercab rides</span>
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#96712D]" />Tesla Robotaxi</span>
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-[#96712D]" />Testing / sightings</span>
        <span className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#9A9488]" />Coming soon</span>
      </figcaption>
    </figure>
  );
}

function CityGroup({ title, status }: { title: string; status: MapCity["status"] }) {
  const rows = MAP_CITIES.filter((c) => c.status === status);
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#795B26]">{title}</h3>
      <ul className="mt-3 grid gap-2">
        {rows.map((c) => (
          <li key={c.city} className="flex gap-3 text-sm leading-6">
            <span aria-hidden="true" className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${status === "soon" ? "bg-[#9A9488]" : status === "testing" ? "border-2 border-[#96712D]" : "bg-[#96712D]"}`} />
            <span><strong className="font-semibold text-[#242019]">{c.city}</strong> <span className="text-[#625C50]">· {c.note}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const OPERATOR_SERVICES = [
  { icon: BatteryCharging, title: "Charging", text: "Keeping your car charged and back in service between rides." },
  { icon: Sparkles, title: "Cleaning", text: "Cabin resets between riders, photographed so you can see the condition." },
  { icon: Wrench, title: "Maintenance", text: "Inspections, tires and repairs, scheduled and tracked." },
  { icon: ShieldCheck, title: "Insurance", text: "Finding and managing coverage as policies for these cars become available." },
  { icon: Clock, title: "Local response", text: "A person nearby who goes to the car when it needs help, day or night." },
  { icon: Landmark, title: "Financing help", text: "Support getting your first car funded." },
];

const SCENARIOS = [
  { label: "Gross fares", low: "$3,300", base: "$9,333", up: "$17,500" },
  { label: "Network share (25% assumed)", low: "−$825", base: "−$2,333", up: "−$4,375" },
  { label: "Running costs", low: "−$1,087", base: "−$1,298", up: "−$1,572" },
  { label: "Loan payment ($30k, 10%, 60 mo)", low: "−$510", base: "−$510", up: "−$510" },
  { label: "Left after the loan", low: "$878", base: "$5,192", up: "$11,043", strong: true },
];

const OPEN_QUESTIONS = [
  { title: "Owner terms", text: "Tesla controls dispatch, who can join its ride network and the revenue split. It hasn't published terms for privately owned cars." },
  { title: "Approval", text: "Federal regulators are still reviewing the no-pedal design, and each city has to approve service." },
  { title: "Insurance", text: "There isn't yet a standard policy for a privately owned driverless car on a ride network." },
];

const MEMBER_BENEFITS = [
  "Your place in line for a Cybercab, held in the order memberships are received.",
  "Early access through an established company. We work to get members' cars ordered and into service sooner than they could on their own.",
  "Our member newsletter and updates on Cybercab, Tesla's plans and the Salt Lake City launch.",
  "Access to GLA's owner software.",
  "No monthly management fee until we're running your car.",
];

function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <p className={`mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] ${tone === "dark" ? "text-[#E0C791]" : "text-[#795B26]"}`}>
      <span aria-hidden="true" className={`h-px w-9 ${tone === "dark" ? "bg-[#D3BC8D]" : "bg-[#B19052]"}`} />{children}
    </p>
  );
}

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
    if (!form.accepts) { setError(`Please confirm you understand the ${MEMBERSHIP} membership is non-refundable.`); return; }
    setStatus("sending");
    try {
      const response = await fetch(buildApiUrl("/api/cybercab/reservations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, city: form.city,
          cars: Number(form.cars), notes: form.notes, acceptsNonRefundableDeposit: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Your request could not be sent. Please try again.");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your request could not be sent. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div role="status" className="rounded-2xl border border-[#D3BC8D]/50 bg-white/[0.06] p-6">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#D3BC8D] text-[#15110A]"><Check className="h-5 w-5" /></div>
        <h3 className="text-xl font-semibold text-white">Request received</h3>
        <p className="mt-2 text-sm leading-6 text-white/75">
          Thank you, {form.name.split(" ")[0] || "and welcome"}. We'll email {form.email} with payment instructions for the {MEMBERSHIP} membership.
          Your place is held once payment arrives, and you'll start receiving our member newsletter and updates.
        </p>
      </div>
    );
  }

  const field = "h-11 bg-white text-[#171717]";
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-white/15 bg-white/[0.06] p-5 sm:grid-cols-2 sm:p-6">
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
      <label className="text-sm text-white/80">How many Cybercabs
        <Input required type="number" min={1} max={50} inputMode="numeric" value={form.cars} onChange={(e) => set("cars", e.target.value)} className={`mt-1 ${field}`} />
      </label>
      <label className="text-sm text-white/80 sm:col-span-2">Questions or notes (optional)
        <Textarea maxLength={2000} value={form.notes} onChange={(e) => set("notes", e.target.value)} className="mt-1 min-h-20 bg-white text-[#171717]" />
      </label>
      <label className="flex items-start gap-3 rounded-lg border border-[#D3BC8D]/40 bg-[#D3BC8D]/10 p-4 text-sm leading-6 text-white/85 sm:col-span-2">
        <input type="checkbox" checked={form.accepts} onChange={(e) => set("accepts", e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#D3BC8D]" />
        <span>I understand the <strong>{MEMBERSHIP} membership is non-refundable</strong>, the program isn't active yet, and launch and delivery dates can't be guaranteed.</span>
      </label>
      {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={status === "sending"} className="gla-public-button w-full bg-[#D3BC8D] text-[#211B11] hover:bg-[#E3CCA0] disabled:opacity-70 sm:w-auto">
          {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Become a member <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
        <p className="mt-3 text-xs leading-5 text-white/55">No payment is taken on this page. We'll contact you with payment instructions.</p>
      </div>
    </form>
  );
}

export default function CybercabPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="public-page">
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-[#141414] text-white">
          <img src="/gateway-buildings-hero.jpg" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/65 to-black/30" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
          <ScrollReveal preset="hero" className="mx-auto max-w-7xl px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32 lg:pt-36">
            <Eyebrow tone="dark">Tesla Cybercab · Salt Lake City</Eyebrow>
            <h1 className="max-w-4xl font-serif text-[clamp(2rem,7.5vw,2.9rem)] font-light leading-[1.05] tracking-tight sm:text-[clamp(2.5rem,4.4vw,4.25rem)]">
              Own a Cybercab.<br /><span className="text-[#E0C791]">We'll run it for you.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
              Golden Luxury Auto manages vehicles for their owners. Our rental program is well established, and our robotaxi program
              is now getting ready for Tesla's Cybercab in Salt Lake City. You own the car. We handle charging, cleaning, care and
              everything else that keeps it earning.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#D3BC8D]/50 bg-[#D3BC8D]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#E0C791]">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#D3BC8D]" /> Robotaxi program · not active yet
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#reserve" className="gla-public-button bg-[#D3BC8D] text-[#201B12] hover:bg-[#E3CCA0]" data-testid="button-cybercab-join">
                Become a member <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
              <a href="#cities" className="gla-public-button border border-white/40 text-white hover:bg-white/10" data-testid="button-cybercab-cities">
                Where Cybercab runs today
              </a>
            </div>
          </ScrollReveal>
        </section>

        {/* Early access through an established business */}
        <section aria-labelledby="cybercab-why-title" className="relative isolate bg-[#FBF9F4] px-5 py-16 text-[#242019] sm:px-8 sm:py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(211,188,141,0.24),transparent_60%)]" />
          <div className="mx-auto max-w-7xl">
            <ScrollReveal preset="soft" className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-16">
              <div>
                <Eyebrow>Why join through GLA</Eyebrow>
                <h2 id="cybercab-why-title" className="font-serif text-4xl font-light leading-[1.12] sm:text-5xl">Get in early,<br /><span className="text-[#96712D]">through a business with a track record.</span></h2>
              </div>
              <div className="space-y-5 text-base leading-8 text-[#625C50]">
                <p>
                  Tesla is starting slowly: Cybercabs are going to its own fleet first, and only select buyers can order one so far.
                  GLA isn't a newcomer asking to be let in. We're an established company with years of managing other people's cars,
                  real trip history and the people and systems already in place to run a fleet.
                </p>
                <p>
                  That's the advantage our members join with. We work to get their Cybercabs ordered and into service sooner than an
                  individual could on their own. Early access is our goal, not a guarantee, because Tesla hasn't published terms for
                  owners or fleets yet.
                </p>
              </div>
            </ScrollReveal>
            <div className="mt-12"><SiteStatsStrip stats={GLA_RECORD} /></div>
            <ScrollReveal preset="soft" className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[#E3DACA] bg-white p-6 shadow-[0_12px_40px_rgba(65,48,19,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#795B26]">Established</p>
                <h3 className="mt-2 font-serif text-2xl">Rental program</h3>
                <p className="mt-2 text-sm leading-7 text-[#625C50]">Owners' cars rented to guests, managed by our team from booking to return.</p>
              </div>
              <div className="rounded-2xl border border-[#D3BC8D] bg-white p-6 shadow-[0_12px_40px_rgba(65,48,19,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#795B26]">Ramping up</p>
                <h3 className="mt-2 font-serif text-2xl">Robotaxi program</h3>
                <p className="mt-2 text-sm leading-7 text-[#625C50]">Driverless cars on Tesla's ride network, with GLA as the local operator.</p>
              </div>
              <p className="text-sm leading-6 text-[#625C50] md:col-span-2">
                Each car we manage runs in one program at a time. Cybercabs, and Model Ys added for robotaxi service, run only in the robotaxi program.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Where Cybercab runs today */}
        <section id="cities" aria-labelledby="cybercab-cities-title" className="scroll-mt-20 bg-white px-5 py-16 text-[#242019] sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal preset="soft" className="max-w-3xl">
              <Eyebrow>Where Cybercab runs today</Eyebrow>
              <h2 id="cybercab-cities-title" className="font-serif text-4xl font-light leading-[1.12] sm:text-5xl">Two cities with Cybercab.<br /><span className="text-[#96712D]">One where you can buy it.</span></h2>
              <p className="mt-5 text-base leading-8 text-[#625C50]">
                Tesla's ride service runs in nine areas, mostly with Model Ys. Cybercab rides have started in Austin and Dallas, and
                Austin is the only city with Cybercab deliveries listed for buyers. Utah is one of the states whose laws already allow
                driverless cars.
              </p>
            </ScrollReveal>
            <div className="mt-10 grid gap-10 lg:grid-cols-[1.45fr_1fr] lg:items-start">
              <div className="rounded-2xl border border-[#E3DACA] bg-[#FBF9F4] p-4 sm:p-6"><CybercabMap /></div>
              <div className="grid gap-8">
                <CityGroup title="Cybercab rides" status="cybercab" />
                <CityGroup title="Tesla Robotaxi" status="robotaxi" />
                <CityGroup title="Testing & sightings" status="testing" />
                <CityGroup title="Coming soon" status="soon" />
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-[#E3DACA] bg-[#FAF8F2] p-5 text-sm leading-7 text-[#625C50]">
              <strong className="text-[#242019]">Personal use only, for now.</strong> Cybercabs on sale today are sold invite-only for personal use. An owner
              can't yet add their own Cybercab to Tesla's ride network for paid rides. Our robotaxi program is built for when that opens.
            </div>
            <p className="mt-4 text-xs leading-5 text-[#9A8F7A]">
              As of {STATUS_AS_OF}. Tesla changes service areas often, and state laws often require a permit or registration. Sources:
              Not a Tesla App (Nov 5 and 14, 2026), Electrek (Nov 13, 2026), Teslarati (Nov 19, 2026), Elevation Proving Grounds
              (July 20, 2026), DockDuty (Oct 29, 2026). Sightings: TownLift (Sept 2026), The Philadelphia Inquirer (Sept 18, 2026),
              Tesla Oracle (Sept 20, 2026), Basenor. This is general information, not legal advice.
            </p>
          </div>
        </section>

        {/* What GLA handles */}
        <section id="how" aria-labelledby="cybercab-how-title" className="bg-[#FAF8F2] px-5 py-16 text-[#242019] sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal preset="soft" className="mb-10 max-w-3xl">
              <Eyebrow>Your local operator</Eyebrow>
              <h2 id="cybercab-how-title" className="font-serif text-4xl font-light leading-[1.12] sm:text-5xl">The car drives itself.<br /><span className="text-[#96712D]">We handle the rest.</span></h2>
            </ScrollReveal>
            <StaggeredReveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {OPERATOR_SERVICES.map(({ icon: Icon, title, text }) => (
                <StaggeredRevealItem key={title} className="flex gap-4 rounded-2xl border border-[#E3DACA] bg-white p-5 sm:p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E8DDC8] bg-[#F8F3E8] text-[#886524]"><Icon aria-hidden="true" className="h-5 w-5" /></div>
                  <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-[#625C50]">{text}</p></div>
                </StaggeredRevealItem>
              ))}
            </StaggeredReveal>
            <p className="mt-6 text-sm text-[#625C50]">Services and GLA's management share are agreed with each owner.</p>
          </div>
        </section>

        {/* The car and the numbers */}
        <section aria-labelledby="cybercab-car-title" className="bg-[#171717] px-5 py-16 text-white sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <ScrollReveal preset="soft">
              <Eyebrow tone="dark">The car</Eyebrow>
              <h2 id="cybercab-car-title" className="font-serif text-4xl font-light leading-[1.12] sm:text-5xl">Two seats.<br /><span className="text-[#E0C791]">No wheel, no pedals.</span></h2>
              <dl className="mt-8 grid gap-4">
                {[
                  { k: "$29,990", v: "Before tax, for invited buyers ($1,000 non-refundable deposit)" },
                  { k: "$299/mo", v: "Autonomy subscription the car needs to drive" },
                  { k: "Dec 2026", v: "Estimated first deliveries, Austin only" },
                ].map(({ k, v }) => (
                  <div key={k} className="border-l-2 border-[#D3BC8D] pl-4"><dt className="text-xl font-semibold">{k}</dt><dd className="text-sm leading-6 text-white/70">{v}</dd></div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-white/50">Sources: Electrek, Nov 13, 2026; Not a Tesla App, Nov 14, 2026.</p>
            </ScrollReveal>
            <ScrollReveal preset="soft" delay={0.08}>
              <Eyebrow tone="dark">What one car could earn</Eyebrow>
              <h3 className="font-serif text-3xl font-light">One car, one month, three cases</h3>
              <div className="mt-6 overflow-x-auto rounded-2xl border border-white/15">
                <table className="w-full min-w-[460px] text-sm">
                  <thead className="bg-white/[0.08] text-left text-white/70">
                    <tr><th className="p-3 font-medium">Per car, per month</th><th className="p-3 text-right font-medium">Low</th><th className="p-3 text-right font-medium">Base</th><th className="p-3 text-right font-medium">High</th></tr>
                  </thead>
                  <tbody>
                    {SCENARIOS.map((row) => (
                      <tr key={row.label} className={`border-t border-white/10 ${row.strong ? "bg-[#D3BC8D]/12 font-semibold" : ""}`}>
                        <td className="p-3">{row.label}</td><td className="p-3 text-right tabular-nums">{row.low}</td><td className="p-3 text-right tabular-nums">{row.base}</td><td className="p-3 text-right tabular-nums">{row.up}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/55">
                An example, not a quote or a promise. It assumes 8, 16 or 24 paid rides a day at $15, $20 or $25, before GLA's management
                share, taxes, the $299 subscription if it applies and eventually replacing the car. Tesla hasn't published owner terms, so the
                25% network share is our assumption.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Open questions */}
        <section aria-labelledby="cybercab-questions-title" className="bg-white px-5 py-16 text-[#242019] sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal preset="soft" className="mb-10 max-w-3xl">
              <Eyebrow>Still to be decided</Eyebrow>
              <h2 id="cybercab-questions-title" className="font-serif text-4xl font-light leading-[1.12] sm:text-5xl">What no one can promise yet.</h2>
            </ScrollReveal>
            <ol className="grid gap-8 border-t border-[#E3DACA] pt-10 md:grid-cols-3">
              {OPEN_QUESTIONS.map((q, i) => (
                <li key={q.title}>
                  <span aria-hidden="true" className="font-serif text-4xl text-[#B19052]">0{i + 1}</span>
                  <h3 className="mb-3 mt-5 text-xl font-medium">{q.title}</h3>
                  <p className="max-w-sm text-sm leading-7 text-[#625C50]">{q.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-sm text-[#625C50]">Salt Lake City fares are unknown until service starts, and no launch or delivery date can be guaranteed.</p>
          </div>
        </section>

        {/* Membership */}
        <section id="reserve" aria-labelledby="cybercab-join-title" className="scroll-mt-20 bg-[#171717] px-5 py-16 text-white sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <ScrollReveal preset="soft">
              <Eyebrow tone="dark">Membership</Eyebrow>
              <h2 id="cybercab-join-title" className="font-serif text-4xl font-light leading-[1.12] sm:text-5xl">Become a member.<br /><span className="text-[#E0C791]">{MEMBERSHIP} holds your place.</span></h2>
              <ul className="mt-8 grid gap-4 text-sm leading-6 text-white/80">
                {MEMBER_BENEFITS.map((t) => <li key={t} className="flex gap-3"><Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[#D3BC8D]" />{t}</li>)}
              </ul>
              <p className="mt-6 text-sm leading-6 text-white/60">
                The membership is separate from the car, which is bought later. Nothing is purchased until Salt Lake City opens to Cybercab
                fleets. The {MEMBERSHIP} membership is non-refundable.
              </p>
            </ScrollReveal>
            <ScrollReveal preset="soft" delay={0.08}><ReservationForm /></ScrollReveal>
          </div>
          <p className="mx-auto mt-12 max-w-7xl text-xs leading-5 text-white/45">
            Golden Luxury Auto is an independent vehicle management company and is not affiliated with or endorsed by Tesla, Inc.
            Cybercab is a trademark of Tesla, Inc. Figures are examples based on public reporting, not a quote, offer or promise of earnings.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
