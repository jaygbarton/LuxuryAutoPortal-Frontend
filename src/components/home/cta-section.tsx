import { Link } from "wouter";
import { SITE_CONTACT } from "@/lib/site-config";
import { ArrowRight, Phone } from "lucide-react";
import type { PublicLocation } from "@/lib/location-config";

export function CTASection({ location }: { location: PublicLocation }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#171717] px-5 py-20 text-white sm:px-8 lg:py-28">
      <img src="/bmw-x6-cta.jpg" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="mb-5 text-xs uppercase tracking-[0.2em] text-[#DFC899]">Make your next move</p>
        <h2 className="font-serif text-4xl font-light sm:text-6xl">Great journeys<br /><span className="italic text-[#DFC899]">start here.</span></h2>
        <p className="mx-auto mb-9 mt-6 max-w-xl leading-8 text-white/80">Explore a vehicle for your next trip, or talk with our team about putting your own car to work.</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={location.fleetPath} className="gla-public-button bg-[#D3BC8D] text-[#211B11] hover:bg-[#E3CCA0]" data-testid="button-cta-rent-car">Explore the fleet <ArrowRight className="h-4 w-4" /></Link>
          <Link href={`${location.path}/onboarding`} className="gla-public-button border border-white/40 hover:bg-white/10" data-testid="button-cta-get-started">Earn with your vehicle <ArrowRight className="h-4 w-4" /></Link>
          <a href={SITE_CONTACT.phoneHref} className="gla-public-button border border-white/40 hover:bg-white/10" data-testid="button-cta-call">Call us <Phone className="h-4 w-4" /></a>
        </div>
        <Link href={`${location.path}/contact`} className="mt-7 inline-flex min-h-11 items-center text-sm text-white/80 underline underline-offset-4">Have a question? Talk with our team</Link>
      </div>
    </section>
  );
}
