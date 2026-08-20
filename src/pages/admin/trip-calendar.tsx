import { AdminLayout } from "@/components/admin/admin-layout";
import { TripCalendar } from "@/components/shared/TripCalendar";

/**
 * Fleet booking calendar for admins and co-hosts. The vehicles shown are
 * decided server-side (admins see every car, co-hosts only their co-hosted
 * fleet), so this page just renders the shared timeline.
 */
export default function TripCalendarPage() {
  return (
    <AdminLayout>
      <TripCalendar title="Trips Calendar" />
    </AdminLayout>
  );
}
