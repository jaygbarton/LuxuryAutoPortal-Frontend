/**
 * Pick Up & Drop Off — reservations assigned to me.
 * Endpoint: /api/me/pickup-dropoff (graceful fallback if not implemented).
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
  { key: "status", label: "Status", align: "center" },
];

export default function MyPickupDropoffSection() {
  return (
    <ReservationsTableSection
      title="PICK UP AND DROP OFF"
      subtitle="Trips assigned to you for pick up or drop off."
      endpoint="/api/me/pickup-dropoff"
      queryKey="me-pickup-dropoff"
      columns={COLUMNS}
    />
  );
}
