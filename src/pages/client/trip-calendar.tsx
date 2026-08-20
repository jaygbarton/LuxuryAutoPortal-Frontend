import { AdminLayout } from "@/components/admin/admin-layout";
import { TripCalendar } from "@/components/shared/TripCalendar";

/**
 * Car owner's booking calendar. The backend scopes the response to vehicles
 * this client owns, so no filtering happens here.
 */
export default function ClientTripCalendarPage() {
  return (
    <AdminLayout>
      <TripCalendar title="My Booking Calendar" />
    </AdminLayout>
  );
}
