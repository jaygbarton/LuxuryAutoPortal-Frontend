import { useState } from "react";
import { testimonialVideos } from "@/lib/testimonial-videos";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ListYourCarHero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-[#0A0A0A] text-white">
      <div className="absolute inset-0">
        <img
          src="/list-your-car-key-handoff-enhanced.png"
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: "center center" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(6,6,5,0.82) 0%, rgba(6,6,5,0.58) 44%, rgba(6,6,5,0.16) 100%), linear-gradient(180deg, rgba(6,6,5,0.08), rgba(6,6,5,0.46))",
          }}
        />
      </div>
      <div className="relative mx-auto grid min-h-[240px] lg:min-h-[360px] max-w-7xl content-end px-4 py-8 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">
            List Your Car
          </p>
          <h1 className="font-serif text-4xl font-light leading-tight text-white sm:text-5xl lg:text-6xl">
            Let us manage your vehicle
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
            Have a car sitting in your garage 90% of the year? Currently
            financing, or looking to purchase a new vehicle? Let us turn your
            car into a cash-flowing asset!
          </p>
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
              Have questions?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Book a consultation with the GLA team before completing the
              vehicle form.
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <a
              href="https://rent.goldenluxuryauto.com/book-a-call-lyc"
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
