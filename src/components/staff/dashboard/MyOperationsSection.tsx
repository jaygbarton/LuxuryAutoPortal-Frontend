/**
 * Operations — trips with miles and earnings, assigned to me.
 * Endpoint: /api/me/operations (graceful fallback).
 */
import ReservationsTableSection, { Column, ReservationRow } from "./ReservationsTableSection";

function fmt$(v: unknown): string {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(v: unknown): string {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

const COLUMNS: Column[] = [
  { key: "reservation_no", label: "Reservation #" },
  { key: "car", label: "Car" },
  { key: "plate", label: "Plate #" },
  { key: "trip_start", label: "Trip Start" },
  { key: "trip_end", label: "Trip Ends" },
  { key: "miles_included", label: "Miles Included", align: "right", render: (r: ReservationRow) => fmtNum(r.miles_included) },
  { key: "miles_driven", label: "Miles Driven", align: "right", render: (r: ReservationRow) => fmtNum(r.miles_driven) },
  { key: "total_miles", label: "Total Miles", align: "right", render: (r: ReservationRow) => fmtNum(r.total_miles) },
  { key: "earnings", label: "Earnings", align: "right", render: (r: ReservationRow) => fmt$(r.earnings) },
  { key: "status", label: "Status", align: "center" },
];

export default function MyOperationsSection() {
  return (
    <ReservationsTableSection
      title="OPERATIONS"
      subtitle="Trips and earnings under your responsibility."
      endpoint="/api/me/operations"
      queryKey="me-operations"
      columns={COLUMNS}
    />
  );
}
