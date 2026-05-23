import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardTable } from "@/components/admin/dashboard";

interface MaintenanceTask {
  id: number;
  inspection_id: number | null;
  car_id: number | null;
  car_name: string | null;
  task_description: string | null;
  assigned_to: string | null;
  scheduled_date: string | null;
  due_date: string | null;
  status: string;
  notes: string | null;
  photos: string[] | null;
  repair_shop: string | null;
  created_at: string;
  updated_at: string;
  car_make?: string | null;
  car_model?: string | null;
  car_year?: number | null;
  car_plate?: string | null;
}

interface MaintenanceResponse {
  success: boolean;
  data: MaintenanceTask[];
  total: number;
}

interface MaintenanceSectionProps {
  year: string;
}

const TABLE_COLUMNS = [
  { key: "car", label: "Car", align: "center" as const },
  { key: "plateNumber", label: "Plate #", align: "center" as const },
  { key: "taskDescription", label: "Task Description", align: "center" as const },
  { key: "assignedTo", label: "Assigned To", align: "center" as const },
  { key: "scheduledDate", label: "Scheduled Date", align: "center" as const },
  { key: "dueDate", label: "Due Date", align: "center" as const },
  { key: "repairShop", label: "Repair Shop", align: "center" as const },
  { key: "photos", label: "Photos", align: "center" as const },
  { key: "notes", label: "Notes", align: "center" as const },
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

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: "New",
    in_progress: "In Progress",
    completed: "Completed",
    delivered: "Delivered",
  };
  return labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

function carLabel(task: MaintenanceTask): string {
  if (task.car_make || task.car_model) {
    const parts = [task.car_make, task.car_model, task.car_year].filter(Boolean);
    return parts.join(" ") || task.car_name || "—";
  }
  return task.car_name || "—";
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

export default function MaintenanceSection(_props: MaintenanceSectionProps) {
  const { data, isLoading } = useQuery<MaintenanceResponse>({
    queryKey: ["/api/operations/maintenance"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/maintenance?limit=50"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch maintenance tasks");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const tasks = data?.data ?? [];
  const displayTasks = [...tasks]
    .sort((a, b) => {
      const aTime = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
      const bTime = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 20);

  const rows = displayTasks.map((task) => ({
    car: carLabel(task),
    plateNumber: task.car_plate || "—",
    taskDescription: task.task_description ? truncate(task.task_description, 50) : "—",
    assignedTo: task.assigned_to || "—",
    scheduledDate: formatDate(task.scheduled_date),
    dueDate: formatDate(task.due_date),
    repairShop: task.repair_shop || "—",
    photos: task.photos && task.photos.length > 0
      ? `${task.photos.length} photo${task.photos.length > 1 ? "s" : ""}`
      : "—",
    notes: task.notes ? truncate(task.notes, 50) : "—",
    status: statusLabel(task.status),
  }));

  return (
    <div className="mb-8">
      <SectionHeader title="MAINTENANCE" />

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="mt-4">
          {rows.length === 0 ? (
            <div className="rounded-md bg-gray-50 border border-gray-200 px-6 py-8 text-center">
              <p className="text-sm text-gray-500">No maintenance tasks found</p>
            </div>
          ) : (
            <DashboardTable columns={TABLE_COLUMNS} rows={rows} />
          )}
        </div>
      )}
    </div>
  );
}
