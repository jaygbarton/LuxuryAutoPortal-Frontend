import type { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { getPreferredPublicLocation, withLocationPath } from '@/lib/location-config';
import { ListYourCarHero, ListYourCarConsultation, ListYourCarTestimonials } from './ListYourCarIntro';

export function ListYourCarApplicationLayout({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const location = getPreferredPublicLocation(path);
  const suggestedCarsHref = location?.availablePages.suggestedCars === false
    ? null : withLocationPath('/suggested-cars', location);
  return <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pb-20 pt-20 lg:pt-24">
      <ListYourCarHero />
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-16">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <aside aria-label="About the List Your Car program" className="order-2 lg:order-1">
            <ListYourCarConsultation suggestedCarsHref={suggestedCarsHref} />
            <ListYourCarTestimonials allTestimonialsHref={withLocationPath('/testimonials', location)} />
          </aside>
          <section aria-label="LYC application" className="order-1 min-w-0 lg:order-2">{children}</section>
        </div>
      </div>
    </main>
    <Footer />
  </div>;
}
