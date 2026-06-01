/**
 * Maintenance — maintenance scheduled / assigned to me.
 * Endpoint: /api/me/maintenance (graceful fallback).
 *
 * Columns mirror the admin Operations → Maintenance tab, limited to the fields
 * the /api/me/maintenance endpoint actually returns.
 */
import ReservationsTableSection, {
  Column,
  ReservationRow,
  fmtMoney,
  fmtNum,
  fmtDays,
} from "./ReservationsTableSection";
import { FuelReturnedCell } from "@/pages/admin/operations/FuelReturnedCell";
import { CarIssueTypesCell } from "@/pages/admin/operations/CarIssueTypesCell";

function parseIssueTypes(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

const COLUMNS: Column[] = [
  { key: "reservation_no", label: "Reservation #" },
  { key: "car", label: "CAR Name" },
  { key: "plate", label: "Plate #" },
  { key: "trip_start", label: "Trip Start" },
  { key: "pickup_location", label: "Pick Up Location" },
  { key: "trip_end", label: "Trip Ends" },
  { key: "days_rented", label: "Days Rented", render: (r: ReservationRow) => fmtDays(r.days_rented) },
  { key: "dropoff_location", label: "Drop Off Location" },
  { key: "extras", label: "Extras" },
  { key: "miles_included", label: "Miles Included", render: (r: ReservationRow) => fmtNum(r.miles_included) },
  { key: "trip_start_odometer", label: "Trip Start Odometer", render: (r: ReservationRow) => fmtNum(r.trip_start_odometer) },
  { key: "trip_end_odometer", label: "Trip Ends Odometer", render: (r: ReservationRow) => fmtNum(r.trip_end_odometer) },
  { key: "total_miles", label: "Total Miles", render: (r: ReservationRow) => fmtNum(r.total_miles) },
  { key: "earnings", label: "Earnings", render: (r: ReservationRow) => fmtMoney(r.earnings) },
  { key: "trip_status", label: "Trip Status" },
  { key: "fuel_returned", label: "Fuel Returned", render: (r: ReservationRow) => <FuelReturnedCell level={(r.fuel_returned as any) ?? null} /> },
  { key: "car_issue_types", label: "Car Issues Type", render: (r: ReservationRow) => <CarIssueTypesCell types={parseIssueTypes(r.car_issue_types)} /> },
  { key: "car_issues", label: "Description" },
  { key: "assigned_to", label: "Assigned To" },
  { key: "scheduled_date", label: "Scheduled Date" },
  { key: "due_date", label: "Due Date" },
  { key: "status", label: "Maint. Status" },
  { key: "repair_shop", label: "Repair Shop" },
  { key: "remarks", label: "Notes" },
  { key: "photos", label: "Photos" },
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
