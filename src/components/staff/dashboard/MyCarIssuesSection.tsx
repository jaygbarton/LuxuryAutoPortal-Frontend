/**
 * Car Issues / Inspections — issues assigned to me.
 * Endpoint: /api/me/car-issues (graceful fallback).
 */
import ReservationsTableSection, { Column } from "./ReservationsTableSection";

const COLUMNS: Column[] = [
  { key: "reservation_no", label: "Reservation #" },
  { key: "car", label: "Car" },
  { key: "plate", label: "Plate #" },
  { key: "issue_date", label: "Date" },
  { key: "car_issues", label: "Car Issues" },
  { key: "remarks", label: "Remarks" },
  { key: "scheduled_date", label: "Scheduled Date" },
  { key: "assigned_to", label: "Assigned To" },
  { key: "status", label: "Status", align: "center" },
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
