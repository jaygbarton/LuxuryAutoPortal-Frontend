/**
 * Maintenance — maintenance scheduled / assigned to me.
 * Endpoint: /api/me/maintenance (graceful fallback).
 */
import ReservationsTableSection, { Column } from "./ReservationsTableSection";

const COLUMNS: Column[] = [
  { key: "reservation_no", label: "Reservation #" },
  { key: "car", label: "Car" },
  { key: "plate", label: "Plate #" },
  { key: "car_issues", label: "Car Issues" },
  { key: "remarks", label: "Remarks" },
  { key: "scheduled_date", label: "Scheduled Date" },
  { key: "drop_off_date", label: "Drop Off Date" },
  { key: "pick_up_date", label: "Pick Up Date" },
  { key: "assigned_to", label: "Assigned To" },
  { key: "status", label: "Status", align: "center" },
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
