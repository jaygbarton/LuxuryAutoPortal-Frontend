import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import type { PublicLocation } from "@/lib/location-config";

const STEPS = [
  ["01", "Choose your vehicle", "Explore the fleet and find the space, comfort, and style that fit your plans."],
  ["02", "Confirm your trip", "Open the vehicle’s Turo listing to check dates, pricing, and booking details."],
  ["03", "Enjoy the journey", "Follow your confirmed pickup instructions and get ready to explore."],
];

export function RentalJourney({ location }: { location: PublicLocation }) {
  return (
    <section className="bg-[#171717] px-5 py-20 text-white sm:px-8 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[#D3BC8D]">Your trip, made simple</p>
            <h2 className="font-serif text-4xl font-light sm:text-6xl">Less planning.<br /><span className="italic text-[#D3BC8D]">More going places.</span></h2>
          </div>
          <Link href={location.fleetPath} className="gla-public-button w-fit border border-white/30 hover:bg-white/10">
            Find your next drive <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-14 grid gap-8 border-t border-white/20 pt-10 md:grid-cols-3">
          {STEPS.map(([number, title, copy]) => (
            <div key={number}>
              <span className="font-serif text-4xl text-[#D3BC8D]">{number}</span>
              <h3 className="mb-3 mt-6 text-xl font-medium">{title}</h3>
              <p className="max-w-sm text-sm leading-7 text-white/65">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
