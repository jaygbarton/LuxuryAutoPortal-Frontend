import { Link, useLocation } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getPublicLocationFromPath, PUBLIC_LOCATIONS } from "@/lib/location-config";

const MANAGEMENT_STEPS = [
  ["01", "Start with a conversation", "Tell our team about your vehicle and discuss its earning potential."],
  ["02", "Find the right fit", "Discuss eligibility, management terms, and responsibilities with our team."],
  ["03", "Get ready for your first booking", "Complete the required information and agreement so your vehicle can move toward listing."],
];
const CONSULTATION_TOPICS = [
  "Vehicle eligibility and preparation",
  "Management terms and owner responsibilities",
  "Booking, reporting, and payout questions",
];

export default function ListYourCar() {
  const [path] = useLocation();
  const location = getPublicLocationFromPath(path) ?? PUBLIC_LOCATIONS.slc;

  return (
    <div className="min-h-screen bg-[#FAF8F2] text-[#26281F]">
      <Navbar />
      <main className="public-page">
        <section className="relative isolate overflow-hidden bg-[#151B17] px-5 pb-20 pt-40 text-white sm:px-8 lg:pb-28 lg:pt-48">
          <img src="/list-your-car-key-handoff-enhanced.png" alt="" className="absolute inset-0 h-full w-full object-cover object-right opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#101712] via-[#101712]/80 to-transparent" />
          <div className="relative mx-auto max-w-7xl">
            <p className="mb-6 text-xs uppercase tracking-[0.25em] text-[#D3BC8D]">Vehicle management · {location.name}</p>
            <h1 className="max-w-4xl font-serif text-5xl font-light leading-[1.06] sm:text-7xl lg:text-8xl">
              Your car has<br /><span className="italic text-[#DFC899]">more to give.</span>
            </h1>
            <p className="mb-9 mt-7 max-w-lg text-lg leading-8 text-white/75">
              Find out what your car could earn in a consultation with our team. We’ll discuss your vehicle, the market, and the management options that fit.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={`${location.path}/contact`} className="gla-public-button bg-[#D3BC8D] text-[#211B11] hover:bg-[#E3CCA0]">
                Consult with our team <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={`${location.path}/onboarding`} className="gla-public-button border border-white/40 hover:bg-white/10">
                Start your application <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
        <section id="management-process" className="scroll-mt-20 mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:py-28">
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[#8B6A32]">An owner’s next chapter</p>
            <h2 className="font-serif text-4xl leading-tight sm:text-5xl">
              You bring the vehicle.<br /><span className="italic text-[#8B6A32]">We bring the operation.</span>
            </h2>
            <p className="mt-6 max-w-lg leading-8 text-[#68695D]">
              A well-managed rental starts with the right vehicle and a clear plan. Our team will help you understand the process, responsibilities, and agreement before you get started.
            </p>
            <Link href={`${location.path}/contact`} className="mt-6 inline-flex min-h-11 items-center gap-3 font-semibold text-[#87632C]">
              Speak with our team <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-6">
            {MANAGEMENT_STEPS.map(([number, title, copy]) => (
              <div key={number} className="flex gap-5 border-b border-[#DCD5C7] pb-6">
                <span className="font-serif text-3xl text-[#AD8A4A]">{number}</span>
                <div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#68695D]">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
          <h2 className="mb-10 font-serif text-4xl">A clear plan, from the start.</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {CONSULTATION_TOPICS.map(text => (
              <div key={text} className="rounded-xl border border-[#DED6C7] bg-white p-7">
                <Check className="mb-5 h-6 w-6 text-[#96712D]" />
                <h3 className="text-lg font-medium">{text}</h3>
                <p className="mt-3 text-sm leading-7 text-[#68695D]">Review the details with our team before you commit.</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
