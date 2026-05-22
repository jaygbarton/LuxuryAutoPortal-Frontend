import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardTable } from "@/components/admin/dashboard";

interface TuroTrip {
  id: number;
  reservationId: string;
  guestName: string | null;
  carName: string | null;
  plateNumber: string | null;
  tripStart: string | null;
  tripEnd: string | null;
  pickupLocation: string | null;
  returnLocation: string | null;
  deliveryLocation: string | null;
  status: "booked" | "cancelled" | "completed";
}

interface TuroTripsResponse {
  success: boolean;
  data: TuroTrip[];
  total: number;
}

const TABLE_COLUMNS = [
  { key: "reservationId", label: "Reservation #", align: "center" as const },
  { key: "car", label: "CAR", align: "center" as const },
  { key: "plateNumber", label: "Plate #", align: "center" as const },
  { key: "tripStart", label: "Trip Start", align: "center" as const },
  { key: "pickUpLocation", label: "Pick Up Location", align: "center" as const },
  { key: "tripEnds", label: "Trip Ends", align: "center" as const },
  { key: "dropOffLocation", label: "Drop Off Location", align: "center" as const },
  { key: "carIssues", label: "Car Issues", align: "center" as const },
  { key: "photos", label: "Photos", align: "center" as const },
  { key: "remarks", label: "Remarks", align: "center" as const },
  { key: "assignForMaintenance", label: "Assign for Maintenance", align: "center" as const },
  { key: "status", label: "Status", align: "center" as const },
];

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatTripDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy h:mm a");
}

function statusLabel(status: TuroTrip["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 py-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-gray-200" />
      ))}
    </div>
  );
}

export default function CarIssuesSection() {
  const { data, isLoading } = useQuery<TuroTripsResponse>({
    queryKey: ["/api/turo-trips", "limit=50"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/turo-trips?limit=50"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const trips = data?.data ?? [];
  const displayTrips = [...trips]
    .sort((a, b) => {
      const aTime = a.tripStart ? new Date(a.tripStart).getTime() : 0;
      const bTime = b.tripStart ? new Date(b.tripStart).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 20);

  const rows = displayTrips.map((trip) => ({
    reservationId: trip.reservationId || "—",
    car: trip.carName || "—",
    plateNumber: trip.plateNumber || "—",
    tripStart: formatTripDate(trip.tripStart),
    pickUpLocation: trip.pickupLocation ? truncate(trip.pickupLocation, 35) : "—",
    tripEnds: formatTripDate(trip.tripEnd),
    dropOffLocation: trip.returnLocation
      ? truncate(trip.returnLocation, 35)
      : trip.deliveryLocation
        ? truncate(trip.deliveryLocation, 35)
        : "—",
    carIssues: "—",
    photos: "—",
    remarks: "—",
    assignForMaintenance: "—",
    status: statusLabel(trip.status),
  }));

  return (
    <div className="mb-8">
      <SectionHeader title="CAR ISSUES / INSPECTIONS" />

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="mt-4">
          <DashboardTable columns={TABLE_COLUMNS} rows={rows} />
        </div>
      )}
    </div>
  );
}
