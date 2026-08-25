/**
 * Trips Calendar — vehicle-timeline view scoped to the logged-in employee.
 * Reuses the shared TripCalendar component (same one admin/client use);
 * the backend's resolveCalendarCarScope restricts the car set to vehicles
 * the employee has an assigned task or inspection on.
 */
import { TripCalendar } from "@/components/shared/TripCalendar";

export default function MyTripsCalendarSection() {
  return (
    <div className="mb-8">
      <TripCalendar title="My Trips Calendar" />
    </div>
  );
}
