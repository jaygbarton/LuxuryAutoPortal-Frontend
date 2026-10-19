import { Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { TripCalendar } from "@/components/shared/TripCalendar";
import { FleetCalendar } from "@/components/shared/FleetCalendar";
import { useCoHost } from "@/hooks/use-co-host";

/**
 * Internal calendar for admins and staff. Co-hosts keep their existing scoped
 * booking timeline, using its separate protected endpoint.
 */
export default function TripCalendarPage() {
  const { isCoHost } = useCoHost();
  const [path] = useLocation();
  const scope = path === "/admin/service-calendar" ? "services" : path === "/admin/internal-calendar" ? "master" : "trips";
  return (
    <AdminLayout>
      {isCoHost ? <TripCalendar title="Trips Calendar" /> : <div className="min-w-0 space-y-3">
        <nav aria-label="Internal calendars" className="flex flex-wrap gap-2">{[["master", "Master calendar", "/admin/internal-calendar"], ["trips", "Vehicle trips", "/admin/trip-calendar"], ["services", "Services", "/admin/service-calendar"]].map(([id, label, href]) => <Link key={id} href={href} aria-current={scope === id ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium ${scope === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{label}</Link>)}</nav>
        <FleetCalendar calendarScope={scope} />
      </div>}
    </AdminLayout>
  );
}
