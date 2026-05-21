/**
 * Car Issues / Inspections — issues assigned to me.
 * Endpoint: /api/me/car-issues (graceful fallback).
 */
import ReservationsTableSection, { Column } from "./ReservationsTableSection";

const COLUMNS: Column[] = [
  { key: "reservation_no", label: "Reservation #" },
  { key: "car", label: "CAR" },
  { key: "plate", label: "Plate #" },
  { key: "trip_start", label: "Trip Start" },
  { key: "pickup_location", label: "Pick Up Location" },
  { key: "trip_end", label: "Trip Ends" },
  { key: "dropoff_location", label: "Drop Off Location" },
  { key: "car_issues", label: "Car Issues" },
  { key: "photos", label: "Photos" },
  { key: "remarks", label: "Remarks" },
  { key: "assign_for_maintenance", label: "Assign for Maintenance" },
  { key: "status", label: "Status" },
];

export default function MyCarIssuesSection() {
  return (
    <ReservationsTableSection
      title="CAR ISSUES / INSPECTIONS"
      subtitle="Car issues assigned to you."
      endpoint="/api/me/car-issues"
      queryKey="me-car-issues"
      columns={COLUMNS}
    />
  );
}
