/**
 * Maintenance — maintenance scheduled / assigned to me.
 * Endpoint: /api/me/maintenance (graceful fallback).
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
  { key: "scheduled_date", label: "Scheduled Date" },
  { key: "assigned_to", label: "Assigned to" },
  { key: "drop_off_date", label: "Drop Off Date" },
  { key: "pick_up_date", label: "Pick Up Date" },
  { key: "assigned_to_2", label: "Assigned to" },
  { key: "status", label: "Status" },
];

export default function MyMaintenanceSection() {
  return (
    <ReservationsTableSection
      title="MAINTENANCE"
      subtitle="Maintenance scheduled for cars assigned to you."
      endpoint="/api/me/maintenance"
      queryKey="me-maintenance"
      columns={COLUMNS}
    />
  );
}
