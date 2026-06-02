/**
 * Turo Messages / Inspections — reservations assigned to me for inspection.
 * Endpoint: /api/me/turo-inspections (graceful fallback).
 *
 * Columns mirror the admin Operations → Car Inspections tab, limited to the
 * fields the /api/me/turo-inspections endpoint actually returns.
 */
import ReservationsTableSection, {
  Column,
  ReservationRow,
  StatusOption,
  fmtMoney,
  fmtNum,
  fmtDays,
} from "./ReservationsTableSection";
import { FuelReturnedCell } from "@/pages/admin/operations/FuelReturnedCell";
import { CarIssueTypesCell } from "@/pages/admin/operations/CarIssueTypesCell";

// inspections.status enum, shared by the Turo Messages and Car Issues tables.
export const INSPECTION_STATUS_OPTIONS: StatusOption[] = [
  { value: "new", label: "New", className: "bg-gray-100 text-gray-700" },
  { value: "in_progress", label: "In Progress", className: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "Completed", className: "bg-green-100 text-green-700" },
  { value: "no_issues", label: "No Issues", className: "bg-emerald-100 text-emerald-700" },
];

// car_issue_types is stored as a JSON string; parse to the string[] the
// shared admin cell expects.
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
  { key: "assigned_to", label: "Assigned To" },
  { key: "fuel_returned", label: "Fuel Returned", render: (r: ReservationRow) => <FuelReturnedCell level={(r.fuel_returned as any) ?? null} /> },
  { key: "car_issue_types", label: "Car Issues Type", render: (r: ReservationRow) => <CarIssueTypesCell types={parseIssueTypes(r.car_issue_types)} /> },
  { key: "photos", label: "Photos" },
  { key: "remarks", label: "Remarks" },
  { key: "status", label: "Inspection Status" },
];

export default function MyTuroInspectionsSection() {
  return (
    <ReservationsTableSection
      title="TURO MESSAGES / INSPECTIONS"
      subtitle="Inspections assigned to you."
      endpoint="/api/me/turo-inspections"
      queryKey="me-turo-inspections"
      columns={COLUMNS}
      statusEdit={{
        columnKey: "status",
        idKey: "id",
        endpoint: "/api/me/inspections",
        options: INSPECTION_STATUS_OPTIONS,
      }}
    />
  );
}
