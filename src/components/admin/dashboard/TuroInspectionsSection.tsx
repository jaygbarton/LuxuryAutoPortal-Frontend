import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardTable } from "@/components/admin/dashboard";

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
  { key: "car", label: "CAR", align: "left" as const },
  { key: "plateNumber", label: "Plate #", align: "left" as const },
  { key: "tripStart", label: "Trip Start", align: "left" as const },
  { key: "pickUpLocation", label: "Pick Up Location", align: "left" as const },
  { key: "tripEnds", label: "Trip Ends", align: "left" as const },
  { key: "dropOffLocation", label: "Drop Off Location", align: "left" as const },
  { key: "assignedTo", label: "Assigned to", align: "left" as const },
  { key: "carIssues", label: "Car Issues", align: "left" as const },
  { key: "photos", label: "Photos", align: "left" as const },
  { key: "remarks", label: "Remarks", align: "left" as const },
  { key: "assignForInspection", label: "Assign for Inspection", align: "left" as const },
  { key: "status", label: "Status", align: "center" as const },
];

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

type InspectionStatus = "booked" | "cancelled" | "completed";

function StatusBadge({ status }: { status: InspectionStatus }) {
  const styles: Record<InspectionStatus, string> = {
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

export default function TuroInspectionsSection() {
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
    .sort((a, b) => new Date(b.tripStart).getTime() - new Date(a.tripStart).getTime())
    .slice(0, 30);

  const rows = displayTrips.map((trip) => ({
    reservationId: trip.reservationId,
    car: trip.carName ?? "—",
    plateNumber: "—",
    tripStart: formatDate(trip.tripStart),
    pickUpLocation: trip.pickupLocation ? truncate(trip.pickupLocation, 35) : "—",
    tripEnds: formatDate(trip.tripEnd),
    dropOffLocation: trip.returnLocation
      ? truncate(trip.returnLocation, 35)
      : trip.deliveryLocation
        ? truncate(trip.deliveryLocation, 35)
        : "—",
    assignedTo: "—",
    carIssues: "—",
    photos: "No Photos",
    remarks: "—",
    assignForInspection: "—",
    status: <StatusBadge status={trip.status} />,
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
