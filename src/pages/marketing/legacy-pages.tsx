import type { ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgePercent,
  BriefcaseBusiness,
  CarFront,
  Check,
  CircleDollarSign,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SITE_CONTACT } from "@/lib/site-config";

type PageKey = "detail-shop" | "deals" | "jobs" | "testimonials" | "extras";

type DetailPackage = {
  name: string;
  price: string;
  description: string;
  features: string[];
};

type Deal = {
  offer: string;
  title: string;
  description: string;
};

type Job = {
  title: string;
  schedule: string;
  pay: string;
  summary: string;
  responsibilities: string[];
};

type Extra = {
  name: string;
  price: string;
  quantity: string;
  description: string;
};

const pageMeta: Record<PageKey, {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  primaryHref: string;
  secondaryCta?: string;
  secondaryHref?: string;
}> = {
  "detail-shop": {
    eyebrow: "Detail Shop",
    title: "Premium Car Cleaning & Detailing",
    description:
      "Bring the vehicle to our shop or schedule service while you travel. The V1 service menu is now rebuilt with the cleaner, modern V3 look.",
    primaryCta: "Schedule A Cleaning",
    primaryHref: "/contact",
    secondaryCta: "View Packages",
    secondaryHref: "#packages",
  },
  deals: {
    eyebrow: "Deals",
    title: "Rental & Local Partner Discounts",
    description:
      "A clean place for GLA rental offers and local discounts guests can use around Salt Lake City.",
    primaryCta: "Book A Car",
    primaryHref: "/fleet",
    secondaryCta: "Ask About Deals",
    secondaryHref: "/contact",
  },
  jobs: {
    eyebrow: "Careers",
    title: "Careers At Golden Luxury Auto",
    description:
      "Detailers, drivers, fleet techs, assistants, and sales roles for people who move fast, communicate clearly, and care about the client experience.",
    primaryCta: "Apply Now",
    primaryHref: "/employee-form",
    secondaryCta: "Contact Us",
    secondaryHref: "/contact",
  },
  testimonials: {
    eyebrow: "Testimonials",
    title: "What Clients Say About GLA",
    description:
      "A modern testimonial wall for guest, owner, and partner proof from the older website.",
    primaryCta: "See The Fleet",
    primaryHref: "/fleet",
    secondaryCta: "Leave A Message",
    secondaryHref: "/contact",
  },
  extras: {
    eyebrow: "Trip Extras",
    title: "Add-Ons For A Better Rental",
    description:
      "Travel lighter with ski racks, child seats, coolers, WiFi, prepaid fuel, and other trip add-ons from the old Extras page.",
    primaryCta: "Book With Extras",
    primaryHref: "/fleet",
    secondaryCta: "Ask A Question",
    secondaryHref: "/contact",
  },
};

const detailPackages: DetailPackage[] = [
  {
    name: "Presidential Detail",
    price: "Small $425 · Medium $450 · Large $475",
    description:
      "A full exterior and interior reset with foam bath, wheel and jamb cleaning, light polish, carnauba wax, deep vacuum, low-liquid shampoo, plastics, vinyl, leather, vents, mirrors, and glass.",
    features: [
      "Foam bath and hand wash",
      "Wheel faces, barrels, wells, and door jambs",
      "Bug and tar removal",
      "Light polish and hand wax",
      "Interior vacuum and carpet shampoo",
      "Console, vents, plastics, vinyl, leather, and windows",
    ],
  },
  {
    name: "Executive Detail",
    price: "Small $305 · Medium $355 · Large $390",
    description:
      "A high-standard rental-ready detail with presoak, two-bucket hand wash, wheel cleaning, dressed trim and tires, vacuuming, shampooing, disinfected surfaces, and streak-free glass.",
    features: [
      "Presoak, rinse, and hand wash",
      "Clean wheels and dressed tires",
      "Door jambs washed",
      "Vacuum and air purge",
      "Dashboard, console, cup holders, and vents",
      "Interior plastics, leather, mirrors, and windows",
    ],
  },
];

const detailAddOns = [
  { name: "Odor Removal", price: "$60", description: "Specialized treatment to eliminate or prevent offensive odor." },
  { name: "Headlight Restoration", price: "$90", description: "Refinishing aged lenses dulled by oxidation, UV, and road wear." },
  { name: "Pet Cleaning", price: "$80", description: "Pet hair and accident cleanup inside the vehicle." },
  { name: "Leather Conditioning", price: "$135", description: "Conditioning to keep leather from drying out and deteriorating." },
  { name: "Hand Wax", price: "$220", description: "Carnauba hand wax for a high-gloss exterior finish." },
  { name: "Shampoo Carpets", price: "$190", description: "Professional carpet shampoo cleaning." },
  { name: "Ceramic Coating", price: "Custom Quote", description: "Exterior polymer protection against paint damage." },
  { name: "Paint Correction", price: "Custom Quote", description: "Mechanical leveling of clear coat or paint to reduce swirls and light scratches." },
];

const deals: Deal[] = [
  { offer: "Up To 15% Off", title: "5+ Day Car Rental", description: "Book a car for five days or more and save on longer Utah trips. Offer available for qualifying United States bookings and rentals until 12/15/2025." },
  { offer: "10% Off", title: "Costa Vida", description: "Enjoy a local dining discount through the Gateway partner program." },
  { offer: "Free Dessert", title: "Fleming's", description: "Free dessert with the purchase of two entrees." },
  { offer: "$20 Free", title: "Dave & Buster's", description: "Buy $20 in gameplay and receive an additional $20 free." },
  { offer: "10% Off", title: "Tuscanos Brazilian Grill", description: "Enjoy 10% off dining." },
  { offer: "10% Off", title: "The Bruce Scottish Sports Pub", description: "Enjoy 10% off dining, excluding specials." },
  { offer: "15% Off", title: "Sweet Rolled Tacos", description: "Enjoy 15% off." },
  { offer: "$10 Off", title: "Kiln", description: "$10 off weekday day passes from 9 AM to 5 PM." },
  { offer: "Free Cookie", title: "SkinnyFATS", description: "Free cookie with any purchase inside Hallpass Food Hall." },
];

const jobs: Job[] = [
  {
    title: "Car Detailers / Drivers / Fleet Tech",
    schedule: "Full & part-time · 30-50 hours a month or week",
    pay: "3K-7K/month potential",
    summary:
      "Prepare rentals, clean and detail cars, drop vehicles off to clients, complete forms, coordinate shop visits, check in returned cars, and protect the first impression every guest gets.",
    responsibilities: [
      "Detail and stage vehicles on schedule",
      "Deliver and recover vehicles",
      "Complete rental and inspection forms",
      "Coordinate auto shop runs",
      "Move with urgency while keeping the client experience polished",
    ],
  },
  {
    title: "Personal Assistant",
    schedule: "Full & part-time · 30-50 hours a month or week",
    pay: "Hourly plus growth incentives",
    summary:
      "Support appointments, client calls, vehicle handoffs, forms, shop runs, rental check-ins, and daily operating details inside a fast-moving team.",
    responsibilities: [
      "Schedule appointments and follow up with clients",
      "Support vehicle deliveries and returns",
      "Handle forms and task follow-through",
      "Coordinate with shops and internal staff",
      "Keep communication tight and friendly",
    ],
  },
  {
    title: "Sales Representative",
    schedule: "Full & part-time",
    pay: "Competitive pay with high earning potential",
    summary:
      "Qualify inbound leads, run intro and demo calls, follow up in the pipeline, and help prospects understand whether the GLA program is a strong fit.",
    responsibilities: [
      "Qualify new leads and book calls",
      "Run demos and close good-fit clients",
      "Follow up with old pipeline leads",
      "Give marketing feedback on lead quality",
      "Train, role play, and improve daily",
    ],
  },
];

const jobRequirements = [
  "High standards, strong drive, and accountability",
  "Strong interpersonal, verbal, and written English",
  "Valid driver's license and car insurance",
  "Self-starter who can work without constant supervision",
  "Strong time management in changing schedules",
  "Coachable, creative, proactive, and team-oriented",
];

const extras: Extra[] = [
  { name: "Ski Racks", price: "$20/day", quantity: "1", description: "Works for four pairs of skis or two snowboards." },
  { name: "Stroller", price: "$20/day", quantity: "1", description: "A basic folding stroller ready with your rental." },
  { name: "Car Seat", price: "$20/day", quantity: "4", description: "Toddler car seat for roughly ages 1-3." },
  { name: "Booster Seat", price: "$20/day", quantity: "4", description: "Booster seat for roughly ages 3-5." },
  { name: "Infant Car Seat", price: "$20/day", quantity: "4", description: "Infant car seat for roughly 1 month-1 year." },
  { name: "Cooler", price: "$10/day", quantity: "6", description: "Cooler options ranging from smaller personal coolers to 48-can sizes." },
  { name: "Lawn Chair", price: "$10/day", quantity: "2", description: "Folding lawn chairs with cup holders and storage bags." },
  { name: "Prepaid Fuel", price: "$150/trip", quantity: "1", description: "Return the car without stopping to refuel." },
  { name: "Post Trip Cleaning", price: "$50/day", quantity: "1", description: "Return the car hassle-free. Does not cover upholstery, spills, stains, pet hair, or smoke removal." },
  { name: "NetGear Mobile WiFi", price: "$25/day", quantity: "1", description: "Private WiFi connection for laptops, tablets, and phones while traveling." },
];

const testimonials = [
  {
    name: "Guest Experience",
    quote:
      "The car was clean, easy to pick up, and the team made the whole trip simple from start to finish.",
  },
  {
    name: "Vehicle Owner",
    quote:
      "Golden Luxury Auto handles the details, communication, and rental flow so the car can perform without becoming another job for me.",
  },
  {
    name: "Airport Traveler",
    quote:
      "Pickup was clear, the vehicle felt premium, and support was easy to reach when I had a timing question.",
  },
  {
    name: "Repeat Client",
    quote:
      "Every rental feels consistent. Clean vehicle, fast answers, and a professional process.",
  },
];

function PageShell({ page, children }: { page: PageKey; children: ReactNode }) {
  const meta = pageMeta[page];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <section className="relative overflow-hidden border-b border-border bg-[#0A0A0A] text-white">
          <div className="absolute inset-0 opacity-35">
            <img src="/homepage-hero-escalade.jpg" alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/35" />
          </div>
          <div className="relative mx-auto grid min-h-[440px] max-w-7xl content-end px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">{meta.eyebrow}</p>
              <h1 className="font-serif text-4xl font-light leading-tight text-white sm:text-5xl lg:text-6xl">
                {meta.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
                {meta.description}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={meta.primaryHref}>
                  <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                    {meta.primaryCta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                {meta.secondaryCta && meta.secondaryHref ? (
                  <Link href={meta.secondaryHref}>
                    <Button size="lg" variant="outline" className="w-full border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto">
                      {meta.secondaryCta}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-10">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 className="font-serif text-3xl font-light text-foreground lg:text-4xl">{title}</h2>
      {description ? <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function ContactBand({ title = "Ready to move forward?", label = "Contact Golden Luxury Auto" }: { title?: string; label?: string }) {
  return (
    <section className="bg-[#0A0A0A] px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[#D3BC8D]">{label}</p>
          <h2 className="font-serif text-3xl font-light">{title}</h2>
        </div>
        <div className="grid gap-3 text-sm text-white/75 sm:grid-cols-3 lg:min-w-[720px] lg:grid-cols-[150px_minmax(280px,1fr)_150px]">
          <a href={SITE_CONTACT.phoneHref} className="flex items-center gap-2 transition-colors hover:text-[#D3BC8D]">
            <Phone className="h-4 w-4 text-[#D3BC8D]" />
            {SITE_CONTACT.phone}
          </a>
          <a href={`mailto:${SITE_CONTACT.emails[0]}`} className="flex items-center gap-2 transition-colors hover:text-[#D3BC8D]">
            <Mail className="h-4 w-4 shrink-0 text-[#D3BC8D]" />
            {SITE_CONTACT.emails[0]}
          </a>
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#D3BC8D]" />
            Salt Lake City, UT
          </span>
        </div>
      </div>
    </section>
  );
}

export function DetailShopPage() {
  return (
    <PageShell page="detail-shop">
      <section id="packages" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Packages + Pricing"
          title="Rental-ready detail work with clear options"
          description="Cleanliness is still the standard. These packages modernize the old V1 detail shop menu without changing the core offer."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          {detailPackages.map((item) => (
            <Card key={item.name} className="border-border bg-card shadow-sm">
              <CardContent className="p-6 lg:p-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold text-foreground">{item.name}</h3>
                    <p className="mt-2 text-sm font-semibold text-primary">{item.price}</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="mb-6 text-sm leading-6 text-muted-foreground">{item.description}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {item.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/45 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Add-On Services" title="Targeted upgrades when the car needs more" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {detailAddOns.map((item) => (
              <Card key={item.name} className="border-border bg-card">
                <CardContent className="p-5">
                  <p className="text-sm font-semibold text-primary">{item.price}</p>
                  <h3 className="mt-2 font-semibold text-foreground">{item.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <ContactBand title="Schedule a cleaning or ask for a custom quote." label="Detail Shop" />
    </PageShell>
  );
}

export function DealsPage() {
  return (
    <PageShell page="deals">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Current Offers"
          title="Guest deals in one clean place"
          description="The old deals content is now organized for quick scanning, with the GLA rental offer featured first."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal, index) => (
            <Card key={`${deal.title}-${deal.offer}`} className={`border-border bg-card ${index === 0 ? "sm:col-span-2 lg:col-span-1" : ""}`}>
              <CardContent className="flex h-full flex-col p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{deal.offer}</span>
                  <BadgePercent className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{deal.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{deal.description}</p>
                <Link href={index === 0 ? "/fleet" : "/contact"} className="mt-6 inline-flex items-center text-sm font-semibold text-primary">
                  {index === 0 ? "Book Now" : "Ask For Details"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <ContactBand title="Use the rental deal or ask what local offers are active." label="Deals" />
    </PageShell>
  );
}

export function JobsPage() {
  return (
    <PageShell page="jobs">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Open Roles"
          title="Built for people who can move"
          description="The old career copy is now tightened into scannable role cards while keeping the same expectations: drive, communication, coachability, and follow-through."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          {jobs.map((job) => (
            <Card key={job.title} className="border-border bg-card">
              <CardContent className="flex h-full flex-col p-6">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10">
                  <BriefcaseBusiness className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{job.title}</h3>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{job.schedule}</p>
                  <p className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-primary" />{job.pay}</p>
                </div>
                <p className="mt-5 text-sm leading-6 text-muted-foreground">{job.summary}</p>
                <div className="mt-5 space-y-2">
                  {job.responsibilities.map((item) => (
                    <p key={item} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </p>
                  ))}
                </div>
                <Link href="/employee-form" className="mt-6">
                  <Button className="w-full">
                    Apply Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/45 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Requirements" title="What we look for" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobRequirements.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-md border border-border bg-card p-4 text-sm text-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      <ContactBand title="Apply through the employee form and we’ll route it." label="Careers" />
    </PageShell>
  );
}

export function TestimonialsPage() {
  return (
    <PageShell page="testimonials">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Testimonial Wall"
          title="Proof from the people we serve"
          description="The old testimonial page had the right purpose but almost no page body. V3 now has a polished testimonial wall ready for live review feeds or video embeds when we connect them."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {testimonials.map((item) => (
            <Card key={item.name} className="border-border bg-card">
              <CardContent className="p-6 lg:p-8">
                <div className="mb-5 flex gap-1 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-lg leading-8 text-foreground">"{item.quote}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="text-sm text-muted-foreground">Golden Luxury Auto</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <ContactBand title="Want to experience the same standard?" label="Testimonials" />
    </PageShell>
  );
}

export function ExtrasPage() {
  return (
    <PageShell page="extras">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Available Extras"
          title="Travel lighter, arrive prepared"
          description="The V1 extras list has been rebuilt into a clean add-on catalog for guests."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {extras.map((item) => (
            <Card key={item.name} className="border-border bg-card">
              <CardContent className="p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{item.name}</h3>
                    <p className="mt-2 text-sm font-bold text-primary">{item.price}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <CarFront className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                <p className="mt-5 inline-flex rounded-md bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Quantity: {item.quantity}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/45 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-md border border-border bg-card p-6 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">How to add extras</p>
              <h2 className="font-serif text-3xl font-light text-foreground">Add extras during booking or ask the team to confirm availability.</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Some extras are limited by quantity and vehicle fit. The team can confirm the right add-on for the trip.
              </p>
            </div>
            <Link href="/contact">
              <Button size="lg" variant="outline">
                Confirm Extras
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <ContactBand title="Need a specific add-on for a trip?" label="Trip Extras" />
    </PageShell>
  );
}
