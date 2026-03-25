import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays, subDays } from "date-fns";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, SummaryCard, DashboardTable } from "@/components/admin/dashboard";
import { formatCurrency } from "./utils";

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
  { key: "vehicle", label: "Vehicle", align: "left" as const },
  { key: "guest", label: "Guest", align: "left" as const },
  { key: "pickUp", label: "Pick Up", align: "left" as const },
  { key: "pickUpLocation", label: "Pick Up Location", align: "left" as const },
  { key: "dropOff", label: "Drop Off", align: "left" as const },
  { key: "dropOffLocation", label: "Drop Off Location", align: "left" as const },
  { key: "duration", label: "Duration", align: "left" as const },
  { key: "earnings", label: "Earnings", align: "right" as const },
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

function computeDuration(start: string, end: string): string {
  try {
    const days = differenceInDays(new Date(end), new Date(start));
    return `${days} day${days !== 1 ? "s" : ""}`;
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: TuroTrip["status"] }) {
  const styles: Record<TuroTrip["status"], string> = {
    booked: "bg-[#FFD700] text-black",
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
    queryKey: ["/api/turo-trips", "operations"],
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
    vehicle: trip.carName ?? "—",
    guest: trip.guestName ?? "—",
    pickUp: formatTripDate(trip.tripStart),
    pickUpLocation: trip.pickupLocation ? truncate(trip.pickupLocation, 35) : "—",
    dropOff: formatTripDate(trip.tripEnd),
    dropOffLocation: trip.returnLocation
      ? truncate(trip.returnLocation, 35)
      : trip.deliveryLocation
        ? truncate(trip.deliveryLocation, 35)
        : "—",
    duration: computeDuration(trip.tripStart, trip.tripEnd),
    earnings: formatCurrency(trip.earnings),
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
