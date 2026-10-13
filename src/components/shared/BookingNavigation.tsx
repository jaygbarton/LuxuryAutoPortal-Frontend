import { CalendarDays, Car, ClipboardList } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { bookingViewHref, type BookingView } from "@/lib/booking-navigation";

export function BookingNavigation({ bookingKey, currentView, developerAccess = false, date }: { bookingKey: string; currentView?: BookingView; developerAccess?: boolean; date?: string }) {
  const preview = bookingKey.startsWith("direct_booking_preview:");
  return <nav aria-label="Booking views" className="flex flex-wrap gap-2">
    {([
      ["calendar", "Internal calendar", CalendarDays],
      ["rental", preview ? "Worker" : "Car rental preview", Car],
      ["day-schedule", "Day schedule", ClipboardList],
    ] as const).map(([view, label, Icon]) => {
      const href = bookingViewHref(view, bookingKey, date);
      if (!href || (view === "rental" && !developerAccess)) return null;
      return <Button key={view} size="sm" variant={currentView === view ? "default" : "outline"} asChild>
        <Link href={href}><Icon className="mr-2 h-4 w-4" />{label}{preview ? " preview" : ""}</Link>
      </Button>;
    })}
  </nav>;
}
