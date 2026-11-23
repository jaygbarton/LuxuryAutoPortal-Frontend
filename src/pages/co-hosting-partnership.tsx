import { useEffect, type MouseEvent } from "react";
import { ArrowRight, Award, CalendarDays, Car, Route } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SiteStatsStrip } from "@/components/layout/site-stats-strip";
import { ScrollReveal } from "@/components/animations/ScrollReveal";

/** Every application happens in the GoHighLevel funnel; nothing is collected on this site. */
export const CO_HOSTING_FUNNEL_URL = "https://rent.goldenluxuryauto.com/co-hosting-partnership";
const CO_HOST_TRAINING_URL = "https://rent.goldenluxuryauto.com/co-host-training";

const PAGE_TITLE = "Co-Hosting Partnership | Golden Luxury Auto";
const PAGE_DESCRIPTION = "We're choosing one Turo host per city to operate under the Golden Luxury Auto name. Check if your city is still open.";

const STATS = [
  { value: "9 years", label: "hosting on Turo", icon: CalendarDays },
  { value: "25,000+", label: "trips completed", icon: Route },
  { value: "Up to 176", label: "vehicles managed", icon: Car },
  { value: "100%", label: "of earnings on cars you bring in", icon: Award },
];

const STEPS = [
  ["01", "Tell us about your hosting", "A few questions about your experience, your fleet and your nearest airport."],
  ["02", "Book a 20-minute Zoom", "Pick a time that works. We'll walk you through how the partnership runs."],
  ["03", "Find out if your city is open", "One host per city. Once a city is taken, it's no longer available."],
];

const BENEFITS = [
  "The Golden Luxury Auto brand behind your city",
  "Our systems for running vehicles, owners and trips",
  "A marketing team that helps you bring in more vehicle owners",
  "100% of the earnings on any car you bring in",
];

/** Sets this page's title and description, restoring the site defaults when the visitor leaves. */
function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    const previousDescription = meta.content;
    document.title = title;
    meta.content = description;
    return () => {
      document.title = previousTitle;
      if (created) meta?.remove();
      else if (meta) meta.content = previousDescription;
    };
  }, [title, description]);
}

function Eyebrow({ children, tone }: { children: string; tone: "dark" | "light" }) {
  return (
    <p className={`mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] ${tone === "dark" ? "text-[#E0C791]" : "text-[#795B26]"}`}>
      <span aria-hidden="true" className={`h-px w-9 ${tone === "dark" ? "bg-[#D3BC8D]" : "bg-[#B19052]"}`} />{children}
    </p>
  );
}

export default function CoHostingPartnershipPage() {
  usePageMeta(PAGE_TITLE, PAGE_DESCRIPTION);
  const scrollToSteps = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById("how-it-works");
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="public-page" data-testid="page-co-hosting-partnership">
        {/* 1. Hero */}
        <section className="relative isolate flex min-h-[88svh] flex-col overflow-hidden bg-[#141414] text-white" data-public-hero>
          <img src="/homepage-hero-escalade.jpg" alt="" fetchPriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover object-[65%_center]" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
          <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pb-16 pt-28 sm:px-8 sm:pt-32 lg:pt-36">
            <Eyebrow tone="dark">Golden Luxury Auto · For Turo hosts</Eyebrow>
            <h1 className="max-w-4xl font-serif text-[clamp(2rem,7.5vw,2.9rem)] font-light leading-[1.05] tracking-tight sm:text-[clamp(2.5rem,4.4vw,4.25rem)]">
              Run your city.<br /><span className="text-[#E0C791]">Under the Golden Luxury Auto name.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
              We're choosing one Turo host in each city to operate under the Golden Luxury Auto name. You bring the local experience. We bring the brand, the systems and a marketing team that helps you sign more vehicle owners. You keep 100% of the earnings on any car you bring in.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={CO_HOSTING_FUNNEL_URL} className="gla-public-button bg-[#D3BC8D] text-[#201B12] hover:bg-[#E3CCA0]" data-testid="button-cohost-hero-apply">
                Check if your city is open <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
              <a href="#how-it-works" onClick={scrollToSteps} className="gla-public-button border border-white/40 text-white hover:bg-white/10" data-testid="button-cohost-how-it-works">
                How it works
              </a>
            </div>
          </div>
        </section>

        {/* 2. Stats */}
        <section aria-label="Golden Luxury Auto in numbers" className="bg-[#FAF8F2] px-5 py-10 sm:px-8 sm:py-12">
          <div className="mx-auto max-w-7xl">
            <SiteStatsStrip stats={STATS} />
          </div>
        </section>

        {/* 3. How it works */}
        <section id="how-it-works" aria-labelledby="cohost-steps-title" className="scroll-mt-20 bg-white px-5 py-16 text-[#242019] sm:px-8 sm:py-24">
          <ScrollReveal preset="soft" className="mx-auto max-w-7xl">
            <Eyebrow tone="light">Co-Hosting Partnership</Eyebrow>
            <h2 id="cohost-steps-title" className="font-serif text-4xl font-light leading-[1.12] sm:text-5xl">How it works</h2>
            <ol className="mt-12 grid gap-8 border-t border-[#E3DACA] pt-10 md:grid-cols-3 md:gap-10">
              {STEPS.map(([number, title, copy]) => (
                <li key={number} data-cohost-step>
                  <span aria-hidden="true" className="font-serif text-4xl text-[#B19052]">{number}</span>
                  <h3 className="mb-3 mt-5 text-xl font-medium">{title}</h3>
                  <p className="max-w-sm text-sm leading-7 text-[#625C50] sm:text-base">{copy}</p>
                </li>
              ))}
            </ol>
          </ScrollReveal>
        </section>

        {/* 4. What you get */}
        <section aria-labelledby="cohost-benefits-title" className="relative isolate bg-[#FBF9F4] px-5 py-16 text-[#242019] sm:px-8 sm:py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(211,188,141,0.24),transparent_60%)]" />
          <ScrollReveal preset="soft" className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <Eyebrow tone="light">Co-Hosting Partnership</Eyebrow>
              <h2 id="cohost-benefits-title" className="font-serif text-4xl font-light leading-[1.12] sm:text-5xl">What you get</h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {BENEFITS.map(item => (
                <li key={item} className="flex gap-4 rounded-2xl border border-[#E3DACA] bg-white p-5 shadow-[0_12px_40px_rgba(65,48,19,0.06)] sm:p-6">
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#D3BC8D]" />
                  <span className="text-base leading-7">{item}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </section>

        {/* 5. Closing call-to-action */}
        <section aria-labelledby="cohost-cta-title" className="relative isolate overflow-hidden bg-[#171717] px-5 py-20 text-white sm:px-8 lg:py-28">
          <img src="/bmw-x6-cta.webp" alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/70" />
          <div className="mx-auto max-w-3xl text-center">
            <h2 id="cohost-cta-title" className="font-serif text-4xl font-light sm:text-6xl">One host per city.<br /><span className="text-[#DFC899]">See if yours is still open.</span></h2>
            <div className="mt-10 flex justify-center">
              <a href={CO_HOSTING_FUNNEL_URL} className="gla-public-button bg-[#D3BC8D] text-[#211B11] hover:bg-[#E3CCA0]" data-testid="button-cohost-cta-apply">
                Check if your city is open <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </div>
            <a href={CO_HOST_TRAINING_URL} className="mt-7 inline-flex min-h-11 items-center text-sm text-white/80 underline underline-offset-4 hover:text-white" data-testid="link-cohost-training">
              Want to learn how we run things first? Explore our Co-Host Training Program →
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
