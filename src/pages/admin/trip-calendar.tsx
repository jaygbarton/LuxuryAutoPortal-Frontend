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
  return (
    <AdminLayout>
      {isCoHost ? <TripCalendar title="Trips Calendar" /> : <FleetCalendar />}
    </AdminLayout>
  );
}
