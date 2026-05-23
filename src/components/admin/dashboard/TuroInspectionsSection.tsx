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
  { key: "reservationId", label: "Reservation #", align: "left" as const },
  { key: "car", label: "Car", align: "left" as const },
  { key: "source", label: "Source", align: "left" as const },
  { key: "inspectionDate", label: "Inspection Date", align: "left" as const },
  { key: "dueDate", label: "Due Date", align: "left" as const },
  { key: "assignedTo", label: "Assigned To", align: "left" as const },
  { key: "photos", label: "Photos", align: "center" as const },
  { key: "notes", label: "Notes", align: "left" as const },
  { key: "status", label: "Status", align: "center" as const },
];

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy");
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

function sourceLabel(source: Inspection["source"]): string {
  return source === "turo_return" ? "Turo Return" : "Manual";
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 py-6">
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
  const { data, isLoading } = useQuery<InspectionsResponse>({
    queryKey: ["/api/operations/inspections"],
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
    .slice(0, 30);

  const rows = displayInspections.map((insp) => ({
    reservationId: insp.reservation_id || "—",
    car: insp.car_name || "—",
    source: sourceLabel(insp.source),
    inspectionDate: formatDate(insp.inspection_date),
    dueDate: formatDate(insp.due_date),
    assignedTo: insp.assigned_to || "—",
    photos: insp.photos && insp.photos.length > 0
      ? `${insp.photos.length} photo${insp.photos.length > 1 ? "s" : ""}`
      : "—",
    notes: insp.notes ? truncate(insp.notes, 50) : "—",
    status: statusLabel(insp.status),
  }));

  return (
    <div className="mb-8">
      <SectionHeader title="TURO MESSAGES INSPECTIONS" />

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="mt-4">
          {rows.length === 0 ? (
            <div className="rounded-md bg-[#111111] px-6 py-8 text-center">
              <p className="text-sm text-white/60">No inspections found</p>
            </div>
          ) : (
            <DashboardTable columns={TABLE_COLUMNS} rows={rows} />
          )}
        </div>
      )}
    </div>
  );
}
