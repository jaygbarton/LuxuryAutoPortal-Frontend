import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {useFeaturedRankingDay} from "@/hooks/use-featured-ranking-day";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, Users, Loader2 } from "lucide-react";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { fleetCarBelongsToLocation, type PublicLocation } from "@/lib/location-config";

// Top-3 featured vehicles come from GET /api/public/fleet/featured — the top
// active cars by calendar-year or previous completed month's rental income.
// One shared daily snapshot; no periodic polling or refetch on tab focus.
interface FeaturedCar {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  makeModel: string;
  color: string | null;
  mileage: number | null;
  fuelType: string | null;
  numberOfSeats: number | null;
  vehicleTrim: string | null;
  photo: string | null;
  turoLink: string | null;
  locationTag?: string | null;
  performancePeriod?: {year:number;month:number|null}|null;
}

type FeaturedMode = "top-performing" | "previous-month";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80";
/** Hide placeholder/junk values ("No Data", "N/A", etc.) instead of printing them. */
function cleanVal(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  return /^(no data|n\/a|na|--|-|none|null|undefined)$/i.test(s) ? "" : s;
}

function CarCard({ car, location }: { car: FeaturedCar; location: PublicLocation }) {
  const imgSrc = car.photo ? getProxiedImageUrl(car.photo, 720) : PLACEHOLDER_IMG;
  const href = car.turoLink || location.fleetPath;
  const linkProps = car.turoLink ? { target: "_blank", rel: "noopener noreferrer" } : {};
  const details = [car.vehicleTrim, car.color].map(cleanVal).filter(Boolean).join(" · ");

  return (
    <article className="group overflow-hidden rounded-xl border border-[#DED8CB] bg-white shadow-[0_10px_35px_rgba(35,30,20,0.04)]">
      <a href={href} {...linkProps} className="relative block aspect-[4/3] overflow-hidden bg-[#E9E5DB]" aria-label={`View ${car.makeModel}${car.turoLink ? " on Turo" : ""}`}>
        <img src={imgSrc} alt={car.makeModel} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
          onError={e => { if (e.currentTarget.src !== PLACEHOLDER_IMG) e.currentTarget.src = PLACEHOLDER_IMG; }} />
        <span className="absolute left-4 top-4 rounded-full bg-[#FAF8F2]/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#544228]">The GLA collection</span>
      </a>
      <div className="p-6">
        <h3 className="font-serif text-2xl leading-tight text-[#242424]">{car.makeModel}</h3>
        {details && <p className="mt-2 text-sm text-[#767367]">{details}</p>}
        <div className="mt-5 flex flex-wrap gap-4 border-t border-[#E8E1D5] pt-4 text-xs text-[#767367]">
          {car.year != null && <span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{car.year}</span>}
          {car.numberOfSeats != null && <span className="flex items-center gap-2"><Users className="h-4 w-4" />{car.numberOfSeats} seats</span>}
        </div>
        <a href={href} {...linkProps} className="mt-5 flex min-h-12 items-center justify-between rounded-lg bg-[#F2EBDD] px-4 text-sm font-semibold text-[#735525] hover:bg-[#E7D6B6]">
          {car.turoLink ? "View & book on Turo" : "Explore vehicle"}<ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

export function FeaturedCars({ location }: { location: PublicLocation }) {
  const rankingDay = useFeaturedRankingDay();
  const [mode, setMode] = useState<FeaturedMode>("top-performing");
  const reduceMotion = useReducedMotion();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ success: boolean; data: FeaturedCar[] }>({
    queryKey: ["/api/public/fleet/featured", mode, location.id, rankingDay, "month-fallback"],
    queryFn: async () => {
      const path = location.id === "wilmington" ? "/api/public/fleet" : `/api/public/fleet/featured?${new URLSearchParams({mode, location: location.id, v: "month-fallback"})}`;
      const res = await fetch(buildApiUrl(path));
      if (!res.ok) throw new Error("Failed to load featured vehicles");
      const result = await res.json();
      if (result.success !== true || !Array.isArray(result.data)) throw new Error('Failed to load featured vehicles');
      return result;
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const cars = (data?.data ?? []).filter((car) => fleetCarBelongsToLocation(car.turoLink, location, car.locationTag));

  const period=cars[0]?.performancePeriod;
  const monthLabel=period && Number.isInteger(period.year) && period.month!=null && Number.isInteger(period.month) && period.month>=1 && period.month<=12
    ? new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(period.year,period.month-1,1))) : null;

  return (
    <section id="featured-fleet" className="py-20 lg:py-28" style={{ background: "#FFFDF8" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal preset="soft" className="text-center mb-12 lg:mb-16">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#C49000", letterSpacing: "3px" }}>
            Exceptional cars. Memorable journeys.
          </p>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold mb-4" style={{ color: "#1C1C1C" }}>
            Featured Vehicles
          </h2>
          <p className="max-w-2xl mx-auto" style={{ color: "#4A4A4A", fontSize: "16px", lineHeight: "1.65" }}>
            {location.id === 'wilmington' ? 'Explore our local Wilmington fleet — updated automatically.' : mode === "previous-month"
              ? monthLabel ? `Our top-performing vehicles for ${monthLabel} — rankings updated daily.` : "Our top-performing vehicles from the latest available completed month — rankings updated daily."
              : "Our top-performing vehicles this year — rankings updated daily."}
          </p>
          {location.id === "slc" ? <div className="mt-6 inline-flex rounded-lg border p-1" style={{ borderColor: "#E8D4A0", background: "#FFF8E8" }}>
            {([
              ["top-performing", "Top Vehicles"],
              ["previous-month", "Top Last Month"],
            ] as const).map(([value, label]) => {
              const active = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={active}
                  className="px-4 py-2 text-sm font-semibold rounded-md transition-all"
                  style={{
                    background: active ? "linear-gradient(135deg, #D4A017, #E8B830)" : "transparent",
                    color: active ? "#1A0E00" : "#8B6914",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div> : null}
        </ScrollReveal>

        <div className="overflow-hidden" data-featured-stage>
        <AnimatePresence initial={false} mode="wait">
        <motion.div key={`${mode}:${isLoading ? 'loading' : 'results'}`} data-featured-slide
          initial={reduceMotion ? false : { opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -28 }} transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}>
        {isLoading ? (
          <div className="flex justify-center py-12" role="status" aria-label="Loading featured vehicles">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C49000" }} />
          </div>
        ) : isError && !data ? (
          <div className="text-center" role="alert">
            <p>Featured vehicles could not be loaded.</p>
            <button type="button" className="mt-3 min-h-11 rounded-md border px-4 py-2" disabled={isFetching} onClick={() => void refetch()}>Try again</button>
          </div>
        ) : cars.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8" data-featured-cars>
            {cars.map((car, index) => (
              <ScrollReveal key={`${mode}:${car.id}`} preset="soft" amount={0.08} delay={index * 0.05} className="h-full min-w-0" data-featured-reveal>
                <CarCard car={car} location={location} />
              </ScrollReveal>
            ))}
          </div>
        ) : (
          <p className="text-center" style={{ color: "#808080" }}>
            This ranking is not available yet.{' '}
            <Link href={location.fleetPath} className="underline">Explore the {location.cityState} collection.</Link>
          </p>
        )}
        </motion.div>
        </AnimatePresence>
        </div>
        {isError && data && <p role="alert" className="mt-4 text-center text-sm">
          Rankings could not be refreshed. Showing the last available results.{' '}
          <button type="button" className="min-h-11 underline" disabled={isFetching} onClick={() => void refetch()}>Try again</button>
        </p>}

      </div>
    </section>
  );
}
