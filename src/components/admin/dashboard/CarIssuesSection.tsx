import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardTable } from "@/components/admin/dashboard";

interface Inspection {
  id: number;
  turo_trip_id: number | null;
  reservation_id: string | null;
  car_name: string | null;
  source: "turo_return" | "manual";
  assigned_to: string | null;
  status: "new" | "in_progress" | "completed" | "no_issues";
  inspection_date: string | null;
  due_date: string | null;
  notes: string | null;
  photos: string[] | null;
  created_at: string;
  updated_at: string;
}

interface InspectionsResponse {
  success: boolean;
  data: Inspection[];
  total: number;
}

const TABLE_COLUMNS = [
  { key: "reservationId", label: "Reservation #", align: "center" as const },
  { key: "car", label: "Car", align: "center" as const },
  { key: "source", label: "Source", align: "center" as const },
  { key: "inspectionDate", label: "Inspection Date", align: "center" as const },
  { key: "dueDate", label: "Due Date", align: "center" as const },
  { key: "assignedTo", label: "Assigned To", align: "center" as const },
  { key: "photos", label: "Photos", align: "center" as const },
  { key: "notes", label: "Notes / Car Issues", align: "center" as const },
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

function statusLabel(status: Inspection["status"]): string {
  const labels: Record<string, string> = {
    new: "New",
    in_progress: "In Progress",
    completed: "Completed",
    no_issues: "No Issues",
  };
  return labels[status] ?? status;
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
  const { data, isLoading } = useQuery<InspectionsResponse>({
    queryKey: ["/api/operations/inspections", "car-issues"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/inspections?limit=50"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch inspections");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const inspections = data?.data ?? [];
  const displayInspections = [...inspections]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  const rows = displayInspections.map((insp) => ({
    reservationId: insp.reservation_id || "—",
    car: insp.car_name || "—",
    source: insp.source === "turo_return" ? "Turo Return" : "Manual",
    inspectionDate: formatTripDate(insp.inspection_date),
    dueDate: insp.due_date ? format(new Date(insp.due_date), "MMM d, yyyy") : "—",
    assignedTo: insp.assigned_to || "—",
    photos: insp.photos && insp.photos.length > 0
      ? `${insp.photos.length} photo${insp.photos.length > 1 ? "s" : ""}`
      : "—",
    notes: insp.notes ? truncate(insp.notes, 50) : "—",
    status: statusLabel(insp.status),
  }));

  return (
    <div className="mb-8">
      <SectionHeader title="CAR ISSUES / INSPECTIONS" />

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="mt-4">
          {rows.length === 0 ? (
            <div className="rounded-md bg-gray-50 border border-gray-200 px-6 py-8 text-center">
              <p className="text-sm text-gray-500">No inspections found</p>
            </div>
          ) : (
            <DashboardTable columns={TABLE_COLUMNS} rows={rows} />
          )}
        </div>
      )}
    </div>
  );
}
