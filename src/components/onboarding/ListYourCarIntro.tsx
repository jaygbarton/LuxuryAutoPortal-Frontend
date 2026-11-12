import { useState } from "react";
import { testimonialVideos } from "@/lib/testimonial-videos";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const CONSULTATION_URL = "https://rent.goldenluxuryauto.com/book-a-call-lyc";
const PROGRAM_VIDEO_URL = "https://www.youtube.com/watch?v=zyhzeXvCp8U";

export function ListYourCarHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#151B17] px-5 py-16 text-white sm:px-8 lg:py-24">
      <img src="/list-your-car-key-handoff-enhanced.png" alt="" className="absolute inset-0 h-full w-full object-cover object-right opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#101712] via-[#101712]/80 to-transparent" />
      <div className="relative mx-auto max-w-7xl">
        <p className="mb-6 text-xs uppercase tracking-[0.25em] text-[#D3BC8D]">List Your Car · Golden Luxury Auto</p>
        <h1 className="max-w-4xl font-serif text-5xl font-light leading-[1.06] sm:text-7xl lg:text-8xl">
          Let us manage<br /><span className="italic text-[#DFC899]">your vehicle</span>
        </h1>
        <p className="mb-9 mt-7 max-w-lg text-lg leading-8 text-white/80">
          Find out what your car could earn in a consultation with our team. We’ll discuss your vehicle, the market, and the management options that fit.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href={CONSULTATION_URL} target="_blank" rel="noopener noreferrer" className="gla-public-button bg-[#D3BC8D] text-[#211B11] hover:bg-[#E3CCA0]">
            Book a consultation <ArrowRight className="h-4 w-4" />
          </a>
          <a href={PROGRAM_VIDEO_URL} target="_blank" rel="noopener noreferrer" className="gla-public-button border border-white/40 hover:bg-white/10">
            Watch the Car Sharing Program <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

export function ListYourCarConsultation({
  suggestedCarsHref,
}: {
  suggestedCarsHref: string | null;
}) {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardContent className="p-0">
        <div className="aspect-video bg-black">
          <iframe
            // YouTube requires a Referer (error 153 without one). Send only the
            // site origin, never the application path or query parameters.
            referrerPolicy="strict-origin"
            src="https://www.youtube.com/embed/zyhzeXvCp8U?start=1"
            title="Golden Luxury Auto List Your Car"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <div className="space-y-6 p-6 lg:p-8">
          <div>
            <h2 className="font-serif text-3xl font-light text-foreground">
              Car Sharing Program
            </h2>
            <a href={PROGRAM_VIDEO_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4">
              Watch on YouTube <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Book a consultation with the GLA team before completing the
              vehicle form.
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <a
              href={CONSULTATION_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a Free Consulting Appointment
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <div className="rounded-md border border-primary/20 bg-primary/10 p-4">
            <p className="text-sm font-semibold leading-6 text-foreground">
              Don't have a qualifying car? Trade in or finance a new one and
              we'll help you pay it off.
            </p>
            {suggestedCarsHref && (
              <Link
                href={suggestedCarsHref}
                className="mt-3 inline-flex items-center text-sm font-semibold text-primary"
              >
                View Suggested Cars
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            )}
          </div>
          <div className="grid gap-3">
            {[
              "We review your vehicle fit and income potential.",
              "You keep ownership while GLA manages the rental process.",
              "Monthly reporting keeps revenue and expenses clear.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 text-sm text-foreground"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ListYourCarTestimonials({
  allTestimonialsHref,
}: {
  allTestimonialsHref: string;
}) {
  const [index, setIndex] = useState(0);
  const video = testimonialVideos[index];
  return (
    <section
      aria-labelledby="lyc-testimonials-title"
      className="mt-6 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="p-6 pb-4">
        <h2 id="lyc-testimonials-title" className="font-serif text-2xl">
          Client stories
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hear from our clients.
        </p>
      </div>
      <div className="aspect-video bg-black">
        <iframe
          referrerPolicy="strict-origin"
          key={video.id}
          title={video.title}
          src={`https://www.youtube-nocookie.com/embed/${video.id}`}
          loading="lazy"
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <Link
          className="text-sm font-medium text-primary underline underline-offset-4"
          href={allTestimonialsHref}
        >
          View all testimonials
        </Link>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 p-0"
            aria-label="Previous testimonial"
            onClick={() =>
              setIndex(
                (previous) =>
                  (previous - 1 + testimonialVideos.length) %
                  testimonialVideos.length,
              )
            }
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {index + 1} of {testimonialVideos.length}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 p-0"
            aria-label="Next testimonial"
            onClick={() =>
              setIndex((previous) => (previous + 1) % testimonialVideos.length)
            }
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
