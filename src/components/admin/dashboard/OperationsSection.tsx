import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, SummaryCard, DashboardTable } from "@/components/admin/dashboard";

interface TuroTrip {
  id: number;
  reservationId: string;
  dateBooked: string;
  guestName: string | null;
  carName: string | null;
  tripStart: string;
  tripEnd: string;
  earnings: number;
  cancelledEarnings: number;
  status: "booked" | "cancelled" | "completed";
  pickupLocation: string | null;
  returnLocation: string | null;
  deliveryLocation: string | null;
  totalDistance: string | null;
  phoneNumber: string | null;
}

interface TuroTripsResponse {
  success: boolean;
  data: TuroTrip[];
  total: number;
}

const TABLE_COLUMNS = [
  { key: "reservationId", label: "Reservation #", align: "left" as const },
  { key: "car", label: "CAR", align: "left" as const },
  { key: "plateNumber", label: "Plate #", align: "left" as const },
  { key: "tripStart", label: "Trip Start", align: "left" as const },
  { key: "pickUpLocation", label: "Pick Up Location", align: "left" as const },
  { key: "assignedTo", label: "Assigned to", align: "left" as const },
  { key: "tripEnds", label: "Trip Ends", align: "left" as const },
  { key: "dropOffLocation", label: "Drop Off Location", align: "left" as const },
  { key: "status", label: "Status", align: "left" as const },
];

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatTripDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "MMM d, yyyy h:mm a");
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: TuroTrip["status"] }) {
  const styles: Record<TuroTrip["status"], string> = {
    booked: "bg-[#d3bc8d] text-black",
    completed: "bg-green-600 text-white",
    cancelled: "bg-red-600 text-white",
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 px-4 py-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-8 animate-pulse rounded bg-white/10"
        />
      ))}
    </div>
  );
}

export default function OperationsSection() {
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

  // Filter: booked OR tripStart within last 7 days or in the future
  const cutoff = subDays(new Date(), 7);
  const relevantTrips = trips.filter(
    (t) => t.status === "booked" || new Date(t.tripStart) >= cutoff,
  );

  // Counts
  const activeCount = trips.filter((t) => t.status === "booked").length;
  const completedCount = trips.filter((t) => t.status === "completed").length;
  const cancelledCount = trips.filter((t) => t.status === "cancelled").length;

  // Sort by tripStart desc (most recent first), limit to 20
  const displayTrips = [...relevantTrips]
    .sort((a, b) => new Date(b.tripStart).getTime() - new Date(a.tripStart).getTime())
    .slice(0, 20);

  const rows = displayTrips.map((trip) => ({
    reservationId: trip.reservationId,
    car: trip.carName ?? "—",
    plateNumber: "—",
    tripStart: formatTripDate(trip.tripStart),
    pickUpLocation: trip.pickupLocation ? truncate(trip.pickupLocation, 35) : "—",
    tripEnds: formatTripDate(trip.tripEnd),
    dropOffLocation: trip.returnLocation
      ? truncate(trip.returnLocation, 35)
      : trip.deliveryLocation
        ? truncate(trip.deliveryLocation, 35)
        : "—",
    assignedTo: "—",
    status: <StatusBadge status={trip.status} />,
  }));

  return (
    <div className="mb-8">
      <SectionHeader title="OPERATIONS — PICK UP AND DROP OFF" />

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:grid-cols-3">
            <SummaryCard
              label="Active Trips"
              value={String(activeCount)}
              variant="gold"
            />
            <SummaryCard
              label="Completed Trips"
              value={String(completedCount)}
              variant="dark"
            />
            <SummaryCard
              label="Cancelled Trips"
              value={String(cancelledCount)}
              variant="dark"
            />
          </div>

          {/* Trips Table */}
          <div className="mt-4 px-4">
            {rows.length === 0 ? (
              <div className="rounded-md bg-[#111111] px-6 py-8 text-center">
                <p className="text-sm text-white/60">No trips found</p>
              </div>
            ) : (
              <DashboardTable columns={TABLE_COLUMNS} rows={rows} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
