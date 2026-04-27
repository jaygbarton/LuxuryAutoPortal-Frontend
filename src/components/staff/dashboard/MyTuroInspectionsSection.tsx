/**
 * Turo Messages / Inspections — reservations assigned to me for inspection.
 * Endpoint: /api/me/turo-inspections (graceful fallback).
 */
import ReservationsTableSection, { Column } from "./ReservationsTableSection";

const COLUMNS: Column[] = [
  { key: "reservation_no", label: "Reservation #" },
  { key: "car", label: "Car" },
  { key: "plate", label: "Plate #" },
  { key: "trip_start", label: "Trip Start" },
  { key: "pickup_location", label: "Pick Up Location" },
  { key: "trip_end", label: "Trip Ends" },
  { key: "dropoff_location", label: "Drop Off Location" },
  { key: "car_issues", label: "Car Issues" },
  { key: "remarks", label: "Remarks" },
  { key: "assigned_for_maintenance", label: "Assign for Maintenance", align: "center" },
  { key: "status", label: "Status", align: "center" },
];

export default function MyTuroInspectionsSection() {
  return (
    <ReservationsTableSection
      title="TURO MESSAGES / INSPECTIONS"
      subtitle="Inspections assigned to you."
      endpoint="/api/me/turo-inspections"
      queryKey="me-turo-inspections"
      columns={COLUMNS}
    />
  );
}
