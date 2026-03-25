import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardTable } from "@/components/admin/dashboard";
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
  totalDistance: string | null;
  emailSubject: string | null;
  emailReceivedAt: string | null;
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
  { key: "tripStart", label: "Trip Start", align: "left" as const },
  { key: "tripEnd", label: "Trip End", align: "left" as const },
  { key: "duration", label: "Duration", align: "right" as const },
  { key: "distance", label: "Distance", align: "right" as const },
  { key: "earnings", label: "Earnings", align: "right" as const },
  { key: "emailReceived", label: "Email Received", align: "center" as const },
  { key: "status", label: "Status", align: "center" as const },
  { key: "notes", label: "Notes", align: "left" as const },
];

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatDate(dateStr: string, fmt: string): string {
  try {
    return format(new Date(dateStr), fmt);
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

export default function TuroInspectionsSection() {
  const { data, isLoading } = useQuery<TuroTripsResponse>({
    queryKey: ["/api/turo-trips", "dashboard"],
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

  // Sort by tripStart descending, limit to 30
  const displayTrips = [...trips]
    .sort((a, b) => new Date(b.tripStart).getTime() - new Date(a.tripStart).getTime())
    .slice(0, 30);

  const rows = displayTrips.map((trip) => ({
    reservationId: trip.reservationId,
    vehicle: trip.carName ?? "—",
    guest: trip.guestName ?? "—",
    tripStart: formatDate(trip.tripStart, "MMM d, yyyy"),
    tripEnd: formatDate(trip.tripEnd, "MMM d, yyyy"),
    duration: computeDuration(trip.tripStart, trip.tripEnd),
    distance: trip.totalDistance ?? "—",
    earnings: formatCurrency(trip.earnings),
    emailReceived: trip.emailReceivedAt
      ? formatDate(trip.emailReceivedAt, "MMM d")
      : "—",
    status: <StatusBadge status={trip.status} />,
    notes: trip.emailSubject ? truncate(trip.emailSubject, 40) : "—",
  }));

  return (
    <div className="mb-8">
      <SectionHeader title="TURO MESSAGES INSPECTIONS" />

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="mt-4 px-4">
          {rows.length === 0 ? (
            <div className="rounded-md bg-[#111111] px-6 py-8 text-center">
              <p className="text-sm text-white/60">No trips found</p>
            </div>
          ) : (
            <DashboardTable columns={TABLE_COLUMNS} rows={rows} />
          )}
        </div>
      )}
    </div>
  );
}
