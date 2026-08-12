import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  BadgePercent,
  BriefcaseBusiness,
  CalendarDays,
  CarFront,
  Check,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SITE_CONTACT } from "@/lib/site-config";
import { getPublicLocationFromPath } from "@/lib/location-config";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RotatingGoogleReviews } from "@/components/reviews/rotating-google-reviews";

type PageKey =
  | "detail-shop"
  | "deals"
  | "jobs"
  | "job-application"
  | "privacy-policy"
  | "terms-and-conditions"
  | "testimonials"
  | "reviews"
  | "reviews-options"
  | "extras"
  | "suggested-cars";

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
  imageUrl: string;
  websiteHref?: string;
};

type Extra = {
  name: string;
  price: string;
  quantity: string;
  description: string;
  imageUrl: string;
};

type SuggestedCarPartner = {
  name: string;
  imageUrl: string;
  websiteHref: string;
};

type JobListing = {
  title: string;
  schedule: string[];
  description: string[];
  requirements: string[];
  pay?: string;
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
      "Bring the vehicle to our shop or schedule service while you travel. Professional detailing packages are organized here with clean pricing and a polished GLA booking path.",
    primaryCta: "Book An Appointment",
    primaryHref: "/detail-shop/book",
    secondaryCta: "View Packages",
    secondaryHref: "#packages",
  },
  deals: {
    eyebrow: "Deals",
    title: "Rental & Local Partner Discounts",
    description:
      "Explore current rental offers and local Salt Lake City partner discounts available to Golden Luxury Auto guests.",
    primaryCta: "Book A Car",
    primaryHref: "/fleet",
    secondaryCta: "Ask About Deals",
    secondaryHref: "/contact",
  },
  jobs: {
    eyebrow: "Careers",
    title: "Careers At Golden Luxury Auto",
    description:
      "Join the Golden Luxury Auto operations team and help keep every rental clean, prepared, and ready for the next guest.",
    primaryCta: "Apply Now",
    primaryHref: "/jobs/apply",
    secondaryCta: "Contact Us",
    secondaryHref: "/contact",
  },
  "job-application": {
    eyebrow: "Apply",
    title: "Apply To Golden Luxury Auto",
    description:
      "Upload your application details, resume, driver's license, and supporting documents for the role that fits you.",
    primaryCta: "View Open Roles",
    primaryHref: "/jobs",
    secondaryCta: "Contact Us",
    secondaryHref: "/contact",
  },
  "privacy-policy": {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    description:
      "How Golden Luxury Auto collects, uses, and protects guest, owner, applicant, and website information.",
    primaryCta: "Contact Us",
    primaryHref: "/contact",
    secondaryCta: "Terms Of Service",
    secondaryHref: "/terms-and-conditions",
  },
  "terms-and-conditions": {
    eyebrow: "Terms",
    title: "Terms Of Service",
    description:
      "The terms that apply when using the Golden Luxury Auto website, submitting forms, and contacting the team.",
    primaryCta: "Contact Us",
    primaryHref: "/contact",
    secondaryCta: "Privacy Policy",
    secondaryHref: "/privacy-policy",
  },
  testimonials: {
    eyebrow: "Testimonials",
    title: "What Clients Say About GLA",
    description:
      "Real client video testimonials and review links from people who trust Golden Luxury Auto with rentals and vehicle management.",
    primaryCta: "Watch Testimonials",
    primaryHref: "#video-testimonials",
    secondaryCta: "Leave A Review",
    secondaryHref: "/reviews",
  },
  reviews: {
    eyebrow: "Reviews",
    title: "Share Your GLA Experience",
    description:
      "Choose the best place to leave a public review or send private feedback directly to the team.",
    primaryCta: "Review Options",
    primaryHref: "/reviews-options",
    secondaryCta: "Send Feedback",
    secondaryHref: "https://forms.gle/Zy9QgGFjSsVUwYw26",
  },
  "reviews-options": {
    eyebrow: "Review Options",
    title: "Leave A Public Review",
    description:
      "Pick the review platform you prefer. Every review helps future guests know what to expect from Golden Luxury Auto.",
    primaryCta: "Google Review",
    primaryHref: "https://share.google/DoBc0jrr0SkT8Ggqg",
    secondaryCta: "Back To Testimonials",
    secondaryHref: "/testimonials",
  },
  extras: {
    eyebrow: "Trip Extras",
    title: "Add-Ons For A Better Rental",
    description:
      "Travel lighter with ski racks, child seats, coolers, prepaid fuel, cleaning, and practical trip add-ons.",
    primaryCta: "Book With Extras",
    primaryHref: "/fleet",
    secondaryCta: "Ask A Question",
    secondaryHref: "/contact",
  },
  "suggested-cars": {
    eyebrow: "Suggested Cars",
    title: "Suggested Cars For Our Program",
    description:
      "Connect with our fleet dealer partners when you want to trade in or finance a qualifying vehicle for the Golden Luxury Auto program.",
    primaryCta: "Request Car Information",
    primaryHref: "#request-car-information",
    secondaryCta: "List Your Car",
    secondaryHref: "/onboarding",
  },
};

const detailPackages: DetailPackage[] = [
  {
    name: "Basic Detail",
    price: "Small $145 · Medium $165 · Large $185",
    description:
      "A practical cleanup for vehicles that need a lighter reset before the next trip, with the essentials handled cleanly and efficiently.",
    features: [
      "Exterior hand wash",
      "Wheels and tires cleaned",
      "Interior vacuum",
      "Console and cup holders wiped down",
      "Windows and mirrors cleaned",
      "Rental-ready finishing check",
    ],
  },
  {
    name: "Presidential Detail",
    price: "Small $325 · Medium $350 · Large $375",
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
    price: "Small $205 · Medium $225 · Large $240",
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

const jobListings: JobListing[] = [
  {
    title: "Car Detailer",
    schedule: ["Full & Part-time", "30-50 hours a week"],
    pay: "$16-21/hr depending on experience",
    description: [
      "Car detailers create the client's first impression of Golden Luxury Auto and keep each rental clean, polished, and ready for the next guest.",
      "Daily work includes preparing vehicles for rentals, cleaning and detailing cars on schedule, checking cars in after rentals, filling out forms, and keeping the detail workflow moving.",
      "All materials, scheduling, and systems are pre-built, with training to help the team keep improving.",
    ],
    requirements: [
      "Valid driver's license and car insurance required.",
      "Mindset and drive with high personal standards.",
      "Strong communication skills.",
      "Strong time-management under changing schedules.",
      "Coachable, proactive, and comfortable working with a small team.",
    ],
  },
  {
    title: "Driver",
    schedule: ["Full & Part-time", "30-50 hours a month", "Changing pickup and drop-off schedule"],
    pay: "$16-21/hr depending on experience",
    description: [
      "Drivers handle the guest-facing movement that keeps rentals on schedule and clients confident.",
      "Daily work includes dropping cars off to clients, picking vehicles up, going to auto shops, checking cars in after rentals, completing forms, and supporting fleet movement as schedules change.",
      "This role fits someone reliable, calm, and organized who can represent Golden Luxury Auto well in the field.",
    ],
    requirements: [
      "Valid driver's license and car insurance required.",
      "Strong communication skills.",
      "Strong time-management under changing schedules.",
      "Comfortable driving and parking a range of vehicle sizes.",
      "Coachable, proactive, and comfortable working with a small team.",
    ],
  },
  {
    title: "Fleet Tech",
    schedule: ["Full & Part-time", "30-50 hours a week", "Operations and shop coordination"],
    pay: "$18-25/hr depending on experience",
    description: [
      "Fleet techs help keep the rental fleet ready, documented, and moving through maintenance, shop visits, inspections, and rental turns.",
      "Daily work includes preparing vehicles for rentals, checking cars in after rentals, coordinating shop runs, completing fleet forms, helping with vehicle readiness, and supporting similar fleet tasks.",
      "This role is for someone hands-on, detail-oriented, and comfortable solving practical vehicle issues before they become guest problems.",
    ],
    requirements: [
      "Valid driver's license and car insurance required.",
      "Strong communication skills.",
      "Basic vehicle knowledge or willingness to learn quickly.",
      "Strong time-management under changing schedules.",
      "Coachable, proactive, and comfortable working with a small team.",
    ],
  },
  {
    title: "Personal Assistant",
    schedule: ["Full & Part-time", "Flexible operations support"],
    description: [
      "Personal assistants support the guest experience and day-to-day operations across appointments, client calls, drop-offs, forms, shop visits, rental check-ins, and similar tasks.",
      "This role is for organized, friendly, high-energy operators who can keep moving through a changing schedule.",
    ],
    requirements: [
      "Valid driver's license and car insurance required.",
      "LinkedIn profile requested with application.",
      "Strong interpersonal, verbal, and written communication skills.",
      "Self-starter with strong organization and time-management.",
      "Creative, coachable, proactive, and team-oriented.",
    ],
  },
  {
    title: "Marketing",
    schedule: ["Full & Part-time", "Content, outreach, and campaigns"],
    description: [
      "Marketing team members help Golden Luxury Auto stay visible with the right renters, vehicle owners, partners, and local audiences.",
      "Daily work can include content support, campaign follow-up, lead response, partnership outreach, review assets, and practical marketing tasks that connect directly to rentals and vehicle management.",
    ],
    requirements: [
      "Valid driver's license and car insurance required.",
      "LinkedIn profile requested with application.",
      "Strong writing, communication, and follow-up discipline.",
      "Comfortable with content, social channels, and lead response.",
      "Creative, coachable, proactive, and willing to train consistently.",
    ],
  },
];

const deals: Deal[] = [
  {
    offer: "Up To 15% Off",
    title: "5+ Day Car Rental",
    description: "Book a car for five days or more and save on longer qualifying rentals. Ask the team to confirm current availability before booking.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/banner-benz.webp",
  },
  {
    offer: "10% Off",
    title: "Costa Vida",
    description: "Enjoy 10% off.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/costa-v-1-1024x830.webp",
    websiteHref: "https://www.costavida.com/",
  },
  {
    offer: "Free Dessert",
    title: "Fleming's Free Dessert",
    description: "Free dessert with the purchase of two entrees.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/flem-1024x399.jpg",
    websiteHref: "https://www.flemingssteakhouse.com/",
  },
  {
    offer: "$20 Free",
    title: "Dave & Buster's",
    description: "Buy $20 gameplay, receive an additional $20 free.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/dave-1024x576.jpg",
    websiteHref: "https://www.daveandbusters.com/us/en/about/locations/salt-lake-city",
  },
  {
    offer: "10% Off",
    title: "Tuscanos Brazilian Grill",
    description: "Enjoy 10% off.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/tusc.jpg",
    websiteHref: "https://www.tucanos.com/location/slc",
  },
  {
    offer: "10% Off",
    title: "The Bruce Scottish Sports Pub",
    description: "Enjoy 10% off dining. Excludes specials.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/bruce.jpg",
    websiteHref: "https://www.brucepub.com/",
  },
  {
    offer: "10% Off",
    title: "Pop Drinks",
    description: "Enjoy 10% off.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/pop-1-1024x1024.png",
    websiteHref: "https://atthegateway.com/gatewaylocal/",
  },
  {
    offer: "15% Off",
    title: "Sweet Rolled Tacos",
    description: "Enjoy 15% off.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/sweet_rolled_tacos_black.png",
    websiteHref: "https://www.sweetrolledtacos.com/",
  },
  {
    offer: "10% Off",
    title: "Urban Arts Gallery",
    description: "Enjoy 10% off purchases over $75.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/urb-1024x1024.webp",
    websiteHref: "https://www.urbanartsgallery.org/",
  },
  {
    offer: "10% Off",
    title: "Pearl Milk Tea Club",
    description: "Enjoy 10% off.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/pearl.png",
    websiteHref: "https://atthegateway.com/directory/dining/pearl-milk-tea-club/",
  },
  {
    offer: "$10 Off",
    title: "Kiln",
    description: "$10 off day passes. Valid 9 AM to 5 PM, Monday through Friday.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/kiln-1024x710.webp",
    websiteHref: "https://kiln.com/communities/salt-lake-city/",
  },
  {
    offer: "25% Off",
    title: "Borboleta",
    description: "25% off first appointment, 10% off all following appointments, and 10% off retail products.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/borb.png",
    websiteHref: "https://atthegateway.com/directory/office-living/borboleta/",
  },
  {
    offer: "Free Cookie",
    title: "SkinnyFATS in Hallpass Food Hall",
    description: "Free cookie with any purchase.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/skinny.jpg",
    websiteHref: "https://skinnyfats.com/portfolio-item/skinnyfats-hall-pass/",
  },
  {
    offer: "10% Off",
    title: "The Store Fine Foods & Market",
    description: "Enjoy 10% off salad and hot bar.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/ss.webp",
    websiteHref: "https://www.thestorefinefoods.com/",
  },
  {
    offer: "$5 Off",
    title: "WOSB Collective",
    description: "$5 off purchases over $25.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/wos.jpg",
    websiteHref: "https://atthegateway.com/calendars/grl-pwr-market-wosb-collective/",
  },
  {
    offer: "10% Off",
    title: "Hawaii Fluid Art",
    description: "Enjoy 10% off any booked experience.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/09/hawaii.jpg",
    websiteHref: "https://hawaiifluidart.com/",
  },
];

const suggestedCarPartners: SuggestedCarPartner[] = [
  {
    name: "Performance Ford Bountiful",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/3-1-768x439.png",
    websiteHref: "https://www.performancefordbountiful.com",
  },
  {
    name: "Audi Salt Lake City",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/Barry-Robertson-768x439.png",
    websiteHref: "https://www.audisaltlakecity.com",
  },
  {
    name: "BMW of Murray",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/Jeffery-Simena-768x439.png",
    websiteHref: "https://www.bmwofmurray.com/",
  },
  {
    name: "Jerry Seiner Nissan Salt Lake",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/Ashley-768x439.png",
    websiteHref: "https://www.seinernsl.com/",
  },
  {
    name: "Jerry Seiner Cadillac",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/Chris--768x439.png",
    websiteHref: "https://www.jerryseinercadillac.com/",
  },
  {
    name: "Toyota Bountiful",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/Thomas-Honton-1-768x439.png",
    websiteHref: "https://www.toyotabountiful.com",
  },
  {
    name: "Lexus of Murray",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/Johnny-Dee-768x439.png",
    websiteHref: "https://www.lexusofmurray.com/",
  },
  {
    name: "Larry H. Miller Chevrolet",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/Donovan-Marrit-768x439.png",
    websiteHref: "https://www.larryhmillerchevrolet.com/",
  },
  {
    name: "Tim Dahle INFINITI",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/Suzie-768x439.png",
    websiteHref: "https://www.timdahleinfiniti.com/",
  },
  {
    name: "Land Rover Lehi",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/Bradley-768x439.png",
    websiteHref: "https://www.landroverlehi.com/",
  },
  {
    name: "Land Rover Lehi",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/12/11-768x439.png",
    websiteHref: "https://www.landroverlehi.com/",
  },
  {
    name: "Salt Lake Valley Chrysler Dodge Jeep Ram",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2026/01/Charles-Ziska-768x439.png",
    websiteHref: "https://www.saltlakevalleychryslerdodgeramjeep.com/",
  },
];

const extras: Extra[] = [
  {
    name: "Ski Racks",
    price: "$20/day",
    quantity: "1",
    description: "Works for four pairs of skis or two snowboards.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/extra-1.jpg",
  },
  {
    name: "Stroller",
    price: "$20/day",
    quantity: "1",
    description: "A basic folding stroller ready with your rental.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/extra-2-289x300.jpg",
  },
  {
    name: "Car Seat",
    price: "$20/day",
    quantity: "4",
    description: "Toddler car seat for roughly ages 1-3.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/extra-3-300x300.webp",
  },
  {
    name: "Booster Seat",
    price: "$20/day",
    quantity: "4",
    description: "Booster seat for roughly ages 3-5.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/extra-4-300x180.webp",
  },
  {
    name: "Infant Car Seat",
    price: "$20/day",
    quantity: "4",
    description: "Infant car seat for roughly 1 month-1 year.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/extra-5-218x300.webp",
  },
  {
    name: "Cooler",
    price: "$10/day",
    quantity: "6",
    description: "Cooler options ranging from smaller personal coolers to 48-can sizes.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/extra-6-300x228.webp",
  },
  {
    name: "Personal Cooler",
    price: "$10/day",
    quantity: "6",
    description: "Smaller cooler option for lighter trips and personal items.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/extra-7-300x240.webp",
  },
  {
    name: "Lawn Chair",
    price: "$10/day",
    quantity: "2",
    description: "Folding lawn chairs with cup holders and storage bags.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/extra-8-300x300.webp",
  },
  {
    name: "Prepaid Fuel",
    price: "$150/trip",
    quantity: "1",
    description: "Return the car without stopping to refuel.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/extra-9-300x266.webp",
  },
  {
    name: "Post Trip Cleaning",
    price: "$50/day",
    quantity: "1",
    description: "Return the car hassle-free. Does not cover upholstery, spills, stains, pet hair, or smoke removal.",
    imageUrl: "https://goldenluxuryauto.com/wp-content/uploads/2025/08/extra-10-300x266.webp",
  },
];

const testimonialVideos = [
  { id: "KMBnH3Bg4Qg", title: "Client Testimonial 1" },
  { id: "nLOSfS22EhE", title: "Client Testimonial 2" },
  { id: "Z0D8S5yujiY", title: "Client Testimonial 3" },
  { id: "7Q-wuiwVO5w", title: "Client Testimonial 4" },
  { id: "Yq51rooYhQc", title: "Client Testimonial 5" },
  { id: "70MQFyLmrQI", title: "Client Testimonial 6" },
  { id: "D0CrLFe2-5E", title: "Client Testimonial 7" },
  { id: "rLf1tGVPtKE", title: "Client Testimonial 8" },
  { id: "ObR2xef_rXw", title: "Client Testimonial 9" },
  { id: "hc9LFgJff6Q", title: "Client Testimonial 10" },
  { id: "mZJpHZZVcbo", title: "Client Testimonial 11" },
  { id: "GIIRsz0IA6s", title: "Client Testimonial 12" },
  { id: "Mv6VcoLXPPs", title: "Client Testimonial 13" },
];

const reviewLinks = [
  { label: "Review On Google", href: "https://share.google/DoBc0jrr0SkT8Ggqg" },
  { label: "Review On Facebook", href: "https://www.facebook.com/Goldenluxuryauto/reviews" },
  { label: "Review On Yelp", href: "https://www.yelp.com/biz/golden-luxury-auto-salt-lake-city" },
  { label: "Subscribe On YouTube", href: "https://www.youtube.com/@goldenluxuryauto" },
];

function PageShell({
  page,
  children,
  ctaOverride,
  heroImage = "/homepage-hero-escalade.jpg",
  heroImagePosition = "center center",
}: {
  page: PageKey;
  children: ReactNode;
  ctaOverride?: Partial<Pick<(typeof pageMeta)[PageKey], "primaryCta" | "primaryHref" | "secondaryCta" | "secondaryHref">>;
  heroImage?: string;
  heroImagePosition?: string;
}) {
  const meta = { ...pageMeta[page], ...ctaOverride };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 lg:pt-24">
        <section className="relative overflow-hidden border-b border-border bg-[#0A0A0A] text-white">
          <div className="absolute inset-0">
            <img src={heroImage} alt="" className="h-full w-full object-cover" style={{ objectPosition: heroImagePosition }} />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(6,6,5,0.78) 0%, rgba(6,6,5,0.56) 44%, rgba(6,6,5,0.16) 100%), linear-gradient(180deg, rgba(6,6,5,0.08), rgba(6,6,5,0.46))",
              }}
            />
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
                <CtaLink href={meta.primaryHref}>
                  <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                    {meta.primaryCta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CtaLink>
                {meta.secondaryCta && meta.secondaryHref ? (
                  <CtaLink href={meta.secondaryHref}>
                    <Button size="lg" variant="outline" className="w-full border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto">
                      {meta.secondaryCta}
                    </Button>
                  </CtaLink>
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

function CtaLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
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
    <PageShell page="detail-shop" heroImage="/rent-a-car-interior.jpg" heroImagePosition="center center">
      <section id="packages" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Packages + Pricing"
          title="Rental-ready detail work with clear options"
          description="Cleanliness is still the standard. These packages make the service menu clear without changing the core offer."
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

export function DetailShopAppointmentPage() {
  return (
    <PageShell
      page="detail-shop"
      heroImage="/rent-a-car-interior.jpg"
      heroImagePosition="center center"
      ctaOverride={{
        primaryCta: "View Packages",
        primaryHref: "/detail-shop#packages",
        secondaryCta: "Contact Team",
        secondaryHref: "/contact",
      }}
    >
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <SectionHeader
              eyebrow="Live Booking"
              title="Book a detail appointment"
              description="Use the live calendar to pick an available detail appointment time without leaving the GLA site."
            />
            <div className="rounded-md border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Detail calendar</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Select the date and time that works for your detail appointment.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card className="overflow-hidden border-border bg-card">
            <CardContent className="p-0">
              <div className="border-b border-border p-5">
                <p className="text-sm font-semibold uppercase tracking-widest text-primary">Book Online</p>
                <h2 className="mt-2 font-serif text-2xl font-light text-foreground">Airport parking lot detail calendar</h2>
              </div>
              <iframe
                src="https://api.leadconnectorhq.com/widget/booking/koQOgzFBXBNtPzVJwPXW"
                title="Golden Luxury Auto detail shop booking calendar"
                className="h-[760px] w-full border-0 bg-white"
                loading="lazy"
              />
            </CardContent>
          </Card>
        </div>

        <div className="mt-12">
          <SectionHeader
            eyebrow="Services"
            title="Detail packages and add-ons available for booking"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Presidential detail package",
              "Executive detail package",
              "Basic detail packages for lighter cleanup needs",
              "Odor, pet, leather, headlight, wax, shampoo, ceramic, and paint correction add-ons",
              "Shop scheduling for rental vehicles, owner vehicles, and travel timing",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-md border border-border bg-card p-4 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      <ContactBand title="Prefer to call or email? The team can schedule it directly." label="Detail Shop" />
    </PageShell>
  );
}

export function DealsPage() {
  return (
    <PageShell page="deals" heroImage="/gateway-buildings-hero.jpg" heroImagePosition="center bottom">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Current Offers"
          title="Guest deals in one clean place"
          description="Rental specials and partner offers are listed here so guests can plan more of the trip in one place."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal, index) => (
            <Card key={`${deal.title}-${deal.offer}`} className={`border-border bg-card ${index === 0 ? "sm:col-span-2 lg:col-span-1" : ""}`}>
              <CardContent className="flex h-full flex-col p-6">
                <div className="mb-5 aspect-[4/3] overflow-hidden rounded-md bg-muted">
                  <img
                    src={deal.imageUrl}
                    alt={deal.title}
                    className="h-full w-full object-cover"
                    loading={index < 3 ? "eager" : "lazy"}
                  />
                </div>
                <div className="mb-5 flex items-start justify-between gap-4">
                  <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{deal.offer}</span>
                  <BadgePercent className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{deal.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{deal.description}</p>
                <CtaLink href={index === 0 ? "/fleet" : deal.websiteHref || "/contact"} className="mt-6 inline-flex items-center text-sm font-semibold text-primary">
                  {index === 0 ? "Book Now" : "Website"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </CtaLink>
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
          eyebrow="Careers"
          title="Careers At Golden Luxury Auto"
          description="Review the roles below and apply directly through the Golden Luxury Auto careers form."
        />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {jobListings.map((job) => (
            <Card key={job.title} className="border-border bg-card">
              <CardContent className="flex h-full flex-col p-5 lg:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <BriefcaseBusiness className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold text-foreground">{job.title}</h3>
                    </div>
                  </div>
                  <Link href={`/jobs/apply?position=${encodeURIComponent(job.title)}`}>
                    <Button className="w-full sm:w-auto">
                      Apply Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                <div className="mt-5 grid gap-5">
                  <div className="space-y-4 text-sm leading-7 text-muted-foreground">
                    {job.description.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                    {job.pay ? <p className="font-semibold text-primary">{job.pay}</p> : null}
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Requirements</p>
                    <div className="grid gap-3">
                      {job.requirements.map((item) => (
                        <div key={item} className="flex items-start gap-3 rounded-md border border-border bg-background/60 p-3 text-sm text-foreground">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/45 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="About Golden Luxury Auto"
            title="Car rental and vehicle management in Salt Lake City"
            description="Golden Luxury Auto is a car rental and management company with rental operations, managed vehicles, thousands of 5-star reviews, and Turo Power Host experience."
          />
        </div>
      </section>
      <ContactBand title="Interested in joining the operations team? Reach out today." label="Careers" />
    </PageShell>
  );
}

const applicationRoles = jobListings.map((job) => job.title);

function FieldLabel({
  label,
  children,
  className = "",
  required = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <label className={`grid min-w-0 gap-2 text-sm font-medium text-foreground ${className}`}>
      <span>
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </span>
      {children}
    </label>
  );
}

const fieldClass =
  "min-h-[44px] w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";

const DOCUMENT_CHUNK_SIZE = 700 * 1024;

function firstFile(input: FormDataEntryValue | null): File | null {
  return input instanceof File && input.size > 0 ? input : null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 1.5 * 1024 * 1024) return file;

  const imageUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imageUrl;
    });
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "document";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function uploadApplicationDocument(applicationId: number, fieldName: string, file: File) {
  const preparedFile = await compressImageFile(file);
  const totalChunks = Math.max(1, Math.ceil(preparedFile.size / DOCUMENT_CHUNK_SIZE));
  const uploadId = `${applicationId}-${fieldName}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * DOCUMENT_CHUNK_SIZE;
    const chunk = preparedFile.slice(start, start + DOCUMENT_CHUNK_SIZE);
    const response = await fetch(buildApiUrl("/api/job-application/document-chunk"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        applicationId,
        uploadId,
        fieldName,
        originalName: preparedFile.name,
        mimeType: preparedFile.type || "application/octet-stream",
        fileSize: preparedFile.size,
        chunkIndex,
        totalChunks,
        chunkBase64: arrayBufferToBase64(await chunk.arrayBuffer()),
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error || "Failed to save application document");
    }
  }
}

export function JobApplicationPage() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const initialRole = useMemo(() => {
    if (typeof window === "undefined") return applicationRoles[0];
    const position = new URLSearchParams(window.location.search).get("position");
    return position && applicationRoles.includes(position) ? position : applicationRoles[0];
  }, []);
  const [selectedRole, setSelectedRole] = useState(initialRole);
  const requiresLinkedIn = selectedRole === "Personal Assistant" || selectedRole === "Marketing";

  const updateFormReady = (form: HTMLFormElement) => {
    window.requestAnimationFrame(() => setFormReady(form.checkValidity()));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData(form);
      const resume = firstFile(formData.get("resume"));
      const driversLicense = firstFile(formData.get("driversLicense"));
      if (!resume || !driversLicense) {
        throw new Error("Resume and driver's license are required");
      }

      const startResponse = await fetch(buildApiUrl("/api/job-application/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          dateOfBirth: formData.get("dateOfBirth"),
          position: formData.get("position"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          linkedin: formData.get("linkedin"),
          notes: formData.get("notes"),
        }),
      });
      if (!startResponse.ok) {
        const error = await startResponse.json().catch(() => null);
        throw new Error(error?.error || "Failed to save application to HR Applications");
      }
      const startPayload = await startResponse.json();
      const applicationId = Number(startPayload.applicationId);
      if (!Number.isFinite(applicationId)) {
        throw new Error("Failed to save application to HR Applications");
      }

      await uploadApplicationDocument(applicationId, "resume", resume);
      await uploadApplicationDocument(applicationId, "driversLicense", driversLicense);
      const optionalDocuments = formData.getAll("optionalDocuments").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      for (const file of optionalDocuments) {
        await uploadApplicationDocument(applicationId, "optionalDocuments", file);
      }

      setSubmitted(true);
      form.reset();
      setFormReady(false);
      toast({
        title: "Application Sent",
        description: "The GLA team received the application and documents.",
      });
    } catch (error) {
      toast({
        title: "Application not sent",
        description: error instanceof Error ? error.message : "The application could not be saved to HR Applications.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell page="job-application">
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <BriefcaseBusiness className="h-7 w-7 text-primary" />
              <h2 className="mt-4 font-serif text-3xl font-light text-foreground">After You Apply</h2>
              <div className="mt-5 space-y-4 text-sm leading-7 text-muted-foreground">
                <p>
                  Golden Luxury Auto reviews every application against the role, our operating standards, and the goals of the company.
                </p>
                <p>
                  We will contact you if we think you are a good fit for our company, the open position, and the way our team works.
                </p>
                <p>
                  Fields marked with <span className="font-semibold text-primary">*</span> are required before submission.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5 sm:p-6 lg:p-7">
              {submitted ? (
                <div className="mb-5 rounded-md border border-primary/25 bg-primary/10 p-4 text-sm font-medium text-foreground">
                  Application submitted. The team will review it and follow up directly.
                </div>
              ) : null}
              <form
                className="grid gap-5"
                encType="multipart/form-data"
                onSubmit={onSubmit}
                onInput={(event) => updateFormReady(event.currentTarget)}
                onChange={(event) => updateFormReady(event.currentTarget)}
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FieldLabel label="First Name" required>
                    <input className={fieldClass} name="firstName" required autoComplete="given-name" />
                  </FieldLabel>
                  <FieldLabel label="Last Name" required>
                    <input className={fieldClass} name="lastName" required autoComplete="family-name" />
                  </FieldLabel>
                  <FieldLabel label="Date Of Birth" required>
                    <input className={fieldClass} name="dateOfBirth" type="date" required />
                  </FieldLabel>
                  <FieldLabel label="Role" required>
                    <select
                      className={fieldClass}
                      name="position"
                      value={selectedRole}
                      required
                      onChange={(event) => {
                        setSelectedRole(event.target.value);
                        updateFormReady(event.currentTarget.form!);
                      }}
                    >
                      {applicationRoles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </FieldLabel>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FieldLabel label="Email" className="xl:col-span-2" required>
                    <input className={fieldClass} name="email" type="email" required autoComplete="email" />
                  </FieldLabel>
                  <FieldLabel label="Phone" required>
                    <input className={fieldClass} name="phone" type="tel" required autoComplete="tel" />
                  </FieldLabel>
                  <FieldLabel label="LinkedIn Profile" required={requiresLinkedIn}>
                    <input
                      className={fieldClass}
                      name="linkedin"
                      type="url"
                      placeholder={requiresLinkedIn ? "https://linkedin.com/in/..." : "Optional"}
                      required={requiresLinkedIn}
                    />
                  </FieldLabel>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <FieldLabel label="Resume" required>
                    <span className="grid min-h-[110px] min-w-0 content-center gap-2 rounded-md border border-dashed border-primary/35 bg-background p-4 text-sm text-muted-foreground">
                      <FileText className="h-5 w-5 text-primary" />
                      <input className="w-full max-w-full text-xs" name="resume" type="file" accept=".pdf,.doc,.docx,image/*" required />
                    </span>
                  </FieldLabel>
                  <FieldLabel label="Driver's License" required>
                    <span className="grid min-h-[110px] min-w-0 content-center gap-2 rounded-md border border-dashed border-primary/35 bg-background p-4 text-sm text-muted-foreground">
                      <FileText className="h-5 w-5 text-primary" />
                      <input className="w-full max-w-full text-xs" name="driversLicense" type="file" accept=".pdf,image/*" required />
                    </span>
                  </FieldLabel>
                  <FieldLabel label="Optional Documents">
                    <span className="grid min-h-[110px] min-w-0 content-center gap-2 rounded-md border border-dashed border-primary/35 bg-background p-4 text-sm text-muted-foreground">
                      <Upload className="h-5 w-5 text-primary" />
                      <input className="w-full max-w-full text-xs" name="optionalDocuments" type="file" accept=".pdf,.doc,.docx,image/*" multiple />
                    </span>
                  </FieldLabel>
                </div>

                <FieldLabel label="Notes">
                  <textarea
                    className="min-h-[96px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                    name="notes"
                    placeholder="Availability, experience, or anything the team should know."
                  />
                </FieldLabel>

                <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting || !formReady}>
                  {submitting ? "Sending..." : "Submit Application"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </PageShell>
  );
}

type LegalSection = {
  title: string;
  body: string[];
};

const privacySections: LegalSection[] = [
  {
    title: "1. Information We Collect",
    body: [
      "Golden Luxury Auto may collect information you provide through this website, including your name, email address, phone number, rental questions, vehicle owner details, job application information, uploaded documents, and any message or form content you choose to submit.",
      "When you use the website, basic technical information may also be collected automatically, including device type, browser type, pages visited, referral source, approximate location derived from technical data, and similar website analytics information.",
    ],
  },
  {
    title: "2. How We Use Information",
    body: [
      "We use submitted information to respond to inquiries, review rental requests, evaluate vehicle management opportunities, process job applications, schedule appointments, provide customer service, operate the business, improve the website, and protect Golden Luxury Auto, guests, vehicle owners, applicants, and staff.",
      "We may contact you by phone, text message, email, or other reasonable communication methods based on the information you provide and the nature of your request.",
    ],
  },
  {
    title: "3. Documents And Uploads",
    body: [
      "Documents uploaded through employment, owner, or operations forms may include resumes, driver's licenses, insurance documents, vehicle information, photos, or other supporting materials.",
      "Uploaded files are used for review, verification, hiring, rental, vehicle management, operational, insurance, or compliance purposes. Access is limited to team members, service providers, or advisors who need the information for legitimate business purposes.",
    ],
  },
  {
    title: "4. Sharing And Disclosure",
    body: [
      "We do not sell personal information. We may share information with service providers, booking platforms, payment processors, software vendors, insurance providers, legal or professional advisors, operations partners, or government authorities when necessary to provide service, operate the business, protect rights and property, or comply with applicable law.",
      "Third-party platforms may maintain their own privacy policies and terms. Golden Luxury Auto is not responsible for the independent practices of third-party websites or platforms.",
    ],
  },
  {
    title: "5. Security And Retention",
    body: [
      "We use reasonable administrative, technical, and operational safeguards designed to protect submitted information. No website, file upload, email, or electronic storage method can be guaranteed completely secure.",
      "We retain information for as long as reasonably needed for business, legal, tax, insurance, hiring, operational, dispute-resolution, and compliance purposes, unless a longer retention period is required or permitted by law.",
    ],
  },
  {
    title: "6. Your Choices And Contact",
    body: [
      "You may contact us to request review, correction, or deletion of information you submitted, subject to legal, operational, insurance, fraud-prevention, and recordkeeping requirements.",
      `Questions about this Privacy Policy can be sent to ${SITE_CONTACT.emails[0]} or ${SITE_CONTACT.phone}.`,
    ],
  },
];

const termsSections: LegalSection[] = [
  {
    title: "1. Acceptance Of Terms",
    body: [
      "By accessing or using this website, submitting a form, uploading documents, or contacting Golden Luxury Auto through the website, you agree to these Terms and Conditions.",
      "If you do not agree, do not use the website or submit information through it.",
    ],
  },
  {
    title: "2. Website Information",
    body: [
      "This website provides general information about Golden Luxury Auto rentals, vehicle management, detailing, extras, careers, contact options, and related services.",
      "Availability, pricing, vehicle listings, offers, job openings, policies, and operational details may change without notice. Website content is not a binding offer unless confirmed in writing by Golden Luxury Auto or through an applicable booking platform.",
    ],
  },
  {
    title: "3. Bookings And Third-Party Platforms",
    body: [
      "Some vehicle bookings, guest eligibility requirements, trip modifications, fees, protection plans, cancellations, payments, disputes, and platform rules may be controlled by third-party platforms such as Turo or other service providers.",
      "When a third-party platform is used, that platform's terms, policies, fees, rules, and decisions may apply in addition to any Golden Luxury Auto policies.",
    ],
  },
  {
    title: "4. Forms, Applications, And Uploads",
    body: [
      "By submitting a form or application, you confirm that the information is accurate, current, and submitted by you or with proper authorization. Golden Luxury Auto may contact you about the request, application, vehicle, rental, service inquiry, or related business purpose.",
      "Only submit documents you are authorized to provide. Uploaded files must not contain malicious code, false information, misleading content, or documents belonging to another person without permission.",
    ],
  },
  {
    title: "5. No Guarantee",
    body: [
      "Submitting an inquiry, job application, owner request, vehicle management request, or service request does not guarantee approval, employment, rental availability, pricing, financing, acceptance into a program, or any specific business outcome.",
      "Golden Luxury Auto may decline requests or applications at its discretion, subject to applicable law.",
    ],
  },
  {
    title: "6. Limitation Of Liability And Contact",
    body: [
      "To the fullest extent permitted by law, Golden Luxury Auto is not liable for indirect, incidental, consequential, special, exemplary, or punitive damages arising from website use, third-party platforms, unavailable vehicles, interrupted service, errors, or user-submitted information.",
      `Questions about these Terms and Conditions can be sent to ${SITE_CONTACT.emails[0]} or ${SITE_CONTACT.phone}.`,
    ],
  },
];

function LegalPage({ page, sections }: { page: "privacy-policy" | "terms-and-conditions"; sections: LegalSection[] }) {
  const title = page === "privacy-policy" ? "Privacy Policy" : "Terms And Conditions";

  return (
    <PageShell page={page}>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <article className="mx-auto max-w-4xl rounded-md border border-border bg-card p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="border-b border-border pb-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Golden Luxury Auto</p>
            <h2 className="mt-3 font-serif text-3xl font-light text-foreground sm:text-4xl">{title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">Last updated: August 10, 2026</p>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              This document is intended to state the website policy and terms for Golden Luxury Auto in a formal, readable format. It should be reviewed by legal counsel for final jurisdiction-specific compliance.
            </p>
          </div>
          <div className="mt-8 grid gap-8">
          {sections.map((section) => (
            <section key={section.title}>
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{section.title}</h3>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}
          </div>
        </article>
      </section>
    </PageShell>
  );
}

export function PrivacyPolicyPage() {
  return <LegalPage page="privacy-policy" sections={privacySections} />;
}

export function TermsPage() {
  return <LegalPage page="terms-and-conditions" sections={termsSections} />;
}

export function SuggestedCarsPage() {
  return (
    <PageShell page="suggested-cars">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Fleet Dealer Partners"
          title="Connect with our fleet dealer partners"
          description="These suggested cars and partner contacts are here for owners who want to trade in or finance a qualifying vehicle for the program."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {suggestedCarPartners.map((partner, index) => (
            <Card key={`${partner.name}-${partner.imageUrl}`} className="overflow-hidden border-border bg-card">
              <CardContent className="flex h-full flex-col p-0">
                <div className="aspect-[1050/600] bg-muted">
                  <img
                    src={partner.imageUrl}
                    alt={partner.name}
                    className="h-full w-full object-cover"
                    loading={index < 3 ? "eager" : "lazy"}
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-semibold text-foreground">{partner.name}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                    Ask about vehicles that may qualify for the Golden Luxury Auto program.
                  </p>
                  <a href={partner.websiteHref} target="_blank" rel="noreferrer" className="mt-5">
                    <Button className="w-full">
                      Get More Info
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="request-car-information" className="bg-muted/45 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <SectionHeader
              eyebrow="Request Car Information"
              title="Request Car Information"
              description="Please complete the form to receive detailed information about this vehicle, including specifications, pricing, and availability. Our team will respond promptly."
            />
            <div className="grid gap-3 text-sm text-foreground">
              <a href={`mailto:${SITE_CONTACT.emails[0]}`} className="flex items-center gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary">
                <Mail className="h-4 w-4 text-primary" />
                {SITE_CONTACT.emails[0]}
              </a>
              <a href={SITE_CONTACT.phoneHref} className="flex items-center gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary">
                <Phone className="h-4 w-4 text-primary" />
                {SITE_CONTACT.phone}
              </a>
              <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
                <MapPin className="h-4 w-4 text-primary" />
                {SITE_CONTACT.address[0]}, {SITE_CONTACT.address[1]}
              </div>
            </div>
          </div>

          <Card className="border-border bg-card">
            <CardContent className="p-6 lg:p-8">
              <form className="grid gap-4" action="/contact">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Name
                  <input className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" name="name" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Phone
                  <input className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" name="phone" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Email
                  <input className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" name="email" type="email" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Car
                  <input className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" name="car" />
                </label>
                <Button type="submit" className="mt-2">
                  Contact Us
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
      <ContactBand title="Have a car in mind? The team can help you review the fit." label="Suggested Cars" />
    </PageShell>
  );
}

export function TestimonialsPage() {
  return (
    <PageShell page="testimonials">
      <RotatingGoogleReviews surface="light" className="border-b border-border" />
      <section id="video-testimonials" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Video Testimonials"
          title="Real client stories from the testimonial wall"
          description="The testimonial videos from the public GLA library are embedded here so guests can hear directly from past clients."
        />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {testimonialVideos.map((video) => (
            <Card key={video.id} className="overflow-hidden border-border bg-card">
              <CardContent className="p-0">
                <div className="aspect-video bg-black">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${video.id}`}
                    title={video.title}
                    className="h-full w-full border-0"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <div className="flex items-center gap-3 p-5">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  <p className="font-semibold text-foreground">{video.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/45 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Review Links"
            title="Public review paths from GLA"
            description="Guests who want to share their experience can choose the platform that fits them best."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {reviewLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border bg-card p-5 transition-colors hover:border-primary"
              >
                <MessageSquareText className="h-5 w-5 text-primary" />
                <h3 className="mt-4 font-semibold text-foreground">{item.label}</h3>
                <span className="mt-4 inline-flex items-center text-sm font-semibold text-primary">
                  Open Link
                  <ExternalLink className="ml-2 h-4 w-4" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
      <ContactBand title="Want to experience the same standard?" label="Testimonials" />
    </PageShell>
  );
}

export function ReviewsPage() {
  return (
    <PageShell page="reviews">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Share Feedback"
          title="Choose public review or private feedback"
          description="Happy guests can leave a public review. If something needs direct attention, the private feedback form goes straight to the team."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border bg-card">
            <CardContent className="flex h-full flex-col p-6 lg:p-8">
              <MessageSquareText className="h-7 w-7 text-primary" />
              <h3 className="mt-5 text-2xl font-semibold text-foreground">Great experience</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                Choose a public platform and share the experience with future Golden Luxury Auto guests.
              </p>
              <Link href="/reviews-options" className="mt-6">
                <Button size="lg" className="w-full sm:w-auto">
                  Review Options
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex h-full flex-col p-6 lg:p-8">
              <Mail className="h-7 w-7 text-primary" />
              <h3 className="mt-5 text-2xl font-semibold text-foreground">Send private feedback</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                Send details directly to the GLA team when the conversation should stay private.
              </p>
              <a href="https://forms.gle/Zy9QgGFjSsVUwYw26" target="_blank" rel="noreferrer" className="mt-6">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Feedback Form
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </section>
      <ContactBand title="Thank you for taking the time to review Golden Luxury Auto." label="Reviews" />
    </PageShell>
  );
}

export function ReviewsOptionsPage() {
  return (
    <PageShell page="reviews-options">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Public Review Options"
          title="Choose where to leave the review"
          description="These are the official review and social links carried over from the GLA review flow."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reviewLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border bg-card p-6 transition-colors hover:border-primary"
            >
              <MessageSquareText className="h-6 w-6 text-primary" />
              <h3 className="mt-5 text-lg font-semibold text-foreground">{item.label}</h3>
              <span className="mt-5 inline-flex items-center text-sm font-semibold text-primary">
                Continue
                <ExternalLink className="ml-2 h-4 w-4" />
              </span>
            </a>
          ))}
        </div>
      </section>
      <ContactBand title="Need help before leaving a review? Contact the team directly." label="Reviews" />
    </PageShell>
  );
}

export function ExtrasPage() {
  const [pathname] = useLocation();
  const location = getPublicLocationFromPath(pathname);
  const visibleExtras = location?.id === "wilmington"
    ? extras.filter((item) => item.name !== "Ski Racks")
    : extras;
  const extrasDescription = location?.id === "wilmington"
    ? "Choose practical add-ons for beach trips, family travel, airport pickups, and longer coastal stays."
    : "Choose practical add-ons for ski trips, family travel, airport pickups, and longer stays.";

  return (
    <PageShell page="extras" heroImage="/extras-child-seat-interior.jpg" heroImagePosition="center center">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <SectionHeader
          eyebrow="Available Extras"
          title="Travel lighter, arrive prepared"
          description={extrasDescription}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleExtras.map((item) => (
            <Card key={item.name} className="border-border bg-card">
              <CardContent className="flex h-full flex-col p-6">
                <div className="mb-5 aspect-[4/3] overflow-hidden rounded-md bg-muted">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{item.name}</h3>
                    <p className="mt-2 text-sm font-bold text-primary">{item.price}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <CarFront className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="flex-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
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
