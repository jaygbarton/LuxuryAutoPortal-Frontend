import { Link } from "wouter";
import {
  ArrowRight,
  BatteryCharging,
  Building2,
  CarFront,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  MapPin,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal, StaggeredReveal, StaggeredRevealItem } from "@/components/animations/ScrollReveal";

const servicePillars = [
  {
    icon: Sparkles,
    title: "Cleaning Between Taxi Runs",
    text: "Fast interior resets, exterior wash checks, odor control, and cabin standards built for high-use autonomous taxi service.",
  },
  {
    icon: Wrench,
    title: "Maintenance Coordination",
    text: "Routine service, tire checks, issue triage, shop coordination, and readiness tracking so each Cybercab stays earning.",
  },
  {
    icon: BatteryCharging,
    title: "Charge And Turnaround Flow",
    text: "A managed process for charging windows, inspection photos, detail status, and the next dispatch-ready handoff.",
  },
];

const ownerSteps = [
  "Private owner enrolls a Cybercab into the GLA managed program.",
  "GLA handles cleaning, maintenance coordination, inspections, and readiness.",
  "The Cybercab keeps operating while the owner stays hands-off.",
  "GLA takes a small profit share for keeping the car clean, maintained, and earning.",
];

const operatingStandards = [
  "Daily cabin condition checks",
  "Photo-documented cleaning",
  "Exterior readiness inspections",
  "Maintenance issue escalation",
  "Charging and parking coordination",
  "Owner profit reporting",
];

export default function CybercabPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="public-page pt-20 lg:pt-24">
        <section className="relative overflow-hidden bg-[#070707] text-white">
          <div className="absolute inset-0">
            <img
              src="/gateway-buildings-hero.jpg"
              alt=""
              className="h-full w-full object-cover"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,4,0.9),rgba(5,5,4,0.72)_45%,rgba(5,5,4,0.34)),linear-gradient(180deg,rgba(5,5,4,0.22),rgba(5,5,4,0.78))]" />
          </div>

          <div className="relative mx-auto grid min-h-[610px] max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8 lg:py-20">
            <ScrollReveal preset="hero" className="max-w-3xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">
                Salt Lake City Cybercab Operations
              </p>
              <h1 className="font-serif text-4xl font-light leading-tight text-white sm:text-5xl lg:text-6xl">
                Cybercab fleet management for autonomous taxi service.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
                Golden Luxury Auto is building the SLC operating base for Cybercabs: cleaning, maintenance,
                charging flow, readiness checks, and future private-owner management.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/salt-lake-city/contact">
                  <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                    Talk To GLA
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="#owner-program">
                  <Button size="lg" variant="outline" className="w-full border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto">
                    Owner Program
                  </Button>
                </a>
              </div>
            </ScrollReveal>

            <ScrollReveal preset="soft" delay={0.12} className="lg:justify-self-end">
              <div className="rounded-md border border-white/16 bg-[#0A0A09]/82 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-md sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/12 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#D3BC8D]">Ops Model</p>
                    <h2 className="mt-1 text-2xl font-semibold">SLC Cybercab Hub</h2>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#D3BC8D] text-[#15110A]">
                    <CarFront className="h-6 w-6" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Fleet", value: "GLA-owned Cybercabs" },
                    { label: "Service", value: "Taxi readiness" },
                    { label: "Owners", value: "Private Cybercab management" },
                    { label: "Market", value: "Salt Lake City" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border border-white/12 bg-white/6 p-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-white/45">{item.label}</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-md bg-[#D3BC8D] p-4 text-[#16120A]">
                  <p className="text-sm font-semibold">The business model</p>
                  <p className="mt-2 text-sm leading-6">
                    We keep the cars clean, maintained, charged, documented, and earning. Owners get the upside without handling the daily work.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="border-b border-[#E6DDC7] bg-[#F7F4EC] px-4 py-8 sm:px-6 lg:px-8">
          <StaggeredReveal className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
            {[
              { icon: MapPin, title: "SLC Based", text: "Built around Salt Lake City airport, downtown, and high-demand taxi routes." },
              { icon: ShieldCheck, title: "Readiness First", text: "Every car needs to look clean, feel safe, and stay operational before the next ride." },
              { icon: CircleDollarSign, title: "Managed Profit Share", text: "Private owners can use GLA services for a small cut of the car's profits." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <StaggeredRevealItem key={item.title} className="flex items-start gap-4 rounded-md border border-[#E2D8BF] bg-white p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#171717]">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-[#5D574A]">{item.text}</p>
                  </div>
                </StaggeredRevealItem>
              );
            })}
          </StaggeredReveal>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal preset="soft" className="mb-8 max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#C49000]">What GLA Manages</p>
              <h2 className="mt-2 font-serif text-3xl font-light text-[#171717] sm:text-4xl">
                The operations layer behind every clean, ready Cybercab.
              </h2>
            </ScrollReveal>

            <StaggeredReveal className="grid gap-5 md:grid-cols-3">
              {servicePillars.map((item) => {
                const Icon = item.icon;
                return (
                  <StaggeredRevealItem key={item.title}>
                    <Card className="h-full rounded-md border-[#E2D8BF] bg-white shadow-sm">
                      <CardContent className="p-6">
                        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-[#171717] text-[#D3BC8D]">
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-semibold text-[#171717]">{item.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-[#5D574A]">{item.text}</p>
                      </CardContent>
                    </Card>
                  </StaggeredRevealItem>
                );
              })}
            </StaggeredReveal>
          </div>
        </section>

        <section id="owner-program" className="bg-[#0A0A09] px-4 py-14 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <ScrollReveal preset="soft">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">Private Owner Management</p>
              <h2 className="mt-2 font-serif text-3xl font-light leading-tight sm:text-4xl">
                Own the Cybercab. Let GLA handle the work.
              </h2>
              <p className="mt-5 text-base leading-7 text-white/72">
                When private Cybercab ownership becomes available, GLA can manage the cleaning and maintenance side for owners who want the car earning without personally servicing it between taxi runs.
              </p>
              <div className="mt-7">
                <Link href="/salt-lake-city/contact">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Join The Owner Interest List
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </ScrollReveal>

            <StaggeredReveal className="grid gap-3">
              {ownerSteps.map((step, index) => (
                <StaggeredRevealItem key={step} className="flex gap-4 rounded-md border border-white/12 bg-white/6 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#D3BC8D] text-sm font-bold text-[#15110A]">
                    {index + 1}
                  </div>
                  <p className="self-center text-sm leading-6 text-white/82">{step}</p>
                </StaggeredRevealItem>
              ))}
            </StaggeredReveal>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr] lg:items-start">
            <ScrollReveal preset="soft" className="overflow-hidden rounded-md border border-[#E2D8BF] bg-white shadow-sm">
              <div className="relative aspect-[16/10] overflow-hidden">
                <img src="/rent-a-car-interior.jpg" alt="Clean vehicle interior" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/52 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4 rounded-md bg-white px-4 py-3 shadow-lg">
                  <p className="text-sm font-semibold text-[#171717]">Cabin quality matters</p>
                  <p className="text-xs text-[#6B6252]">Clean rides earn trust.</p>
                </div>
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-[#171717]">Built from GLA's existing fleet discipline.</h2>
                <p className="mt-3 text-sm leading-7 text-[#5D574A]">
                  GLA already operates around vehicle turns, guest readiness, inspections, cleaning standards, and owner reporting. Cybercab management extends that same operating discipline into autonomous taxi work.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal preset="soft" delay={0.08} className="rounded-md border border-[#E2D8BF] bg-[#F7F4EC] p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#171717] text-[#D3BC8D]">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#7A6B44]">Operating Standards</p>
                  <h2 className="text-2xl font-semibold text-[#171717]">What gets tracked</h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {operatingStandards.map((standard) => (
                  <div key={standard} className="flex items-start gap-3 rounded-md bg-white p-4">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C49000]" />
                    <p className="text-sm leading-6 text-[#4A4438]">{standard}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-md bg-[#171717] p-5 text-white">
                <div className="mb-3 flex items-center gap-2 text-[#D3BC8D]">
                  <Building2 className="h-5 w-5" />
                  <p className="text-sm font-semibold">Future SLC operations board</p>
                </div>
                <p className="text-sm leading-7 text-white/72">
                  The public page is live now. The operating system can later connect Cybercab status, cleaning queues, maintenance events, and owner payout reporting inside the GLA backend.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
