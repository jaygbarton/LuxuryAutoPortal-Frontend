import { CalendarDays, Car, ClipboardList } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { bookingViewHref, type BookingView } from "@/lib/booking-navigation";

export function BookingNavigation({ bookingKey, currentView, developerAccess = false, date }: { bookingKey: string; currentView?: BookingView; developerAccess?: boolean; date?: string }) {
  const preview = bookingKey.startsWith("direct_booking_preview:");
  return <nav aria-label="Booking views" className="flex min-w-0 flex-wrap gap-2">
    {([
      ["calendar", "Internal calendar", CalendarDays],
      ["rental", preview ? "Worker" : "Car rental preview", Car],
      ["day-schedule", "Day schedule", ClipboardList],
    ] as const).map(([view, label, Icon]) => {
      const href = bookingViewHref(view, bookingKey, date);
      if (!href || (view === "rental" && !developerAccess)) return null;
      return <Button key={view} size="sm" className="min-w-0 flex-1 whitespace-normal px-2 text-xs leading-4 sm:flex-none sm:px-3" variant={currentView === view ? "default" : "outline"} asChild>
        <Link href={href} aria-current={currentView === view ? "page" : undefined}><Icon className="h-4 w-4" aria-hidden="true" /><span>{label}{preview ? " preview" : ""}</span></Link>
      </Button>;
    })}
  </nav>;
}
