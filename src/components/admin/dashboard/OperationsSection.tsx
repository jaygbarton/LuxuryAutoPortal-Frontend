import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardTable } from "@/components/admin/dashboard";

interface OperationTask {
  id: number;
  turo_trip_id: number | null;
  reservation_id: string | null;
  car_name: string | null;
  guest_name: string | null;
  task_type: "cleaning" | "delivery" | "pickup";
  assigned_to: string | null;
  scheduled_date: string | null;
  scheduled_location: string | null;
  due_date: string | null;
  status: "new" | "in_progress" | "completed" | "delivered";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface OperationTasksResponse {
  success: boolean;
  data: OperationTask[];
  total: number;
}

const TABLE_COLUMNS = [
  { key: "reservationId", label: "Reservation #", align: "left" as const },
  { key: "car", label: "Car", align: "left" as const },
  { key: "guestName", label: "Guest Name", align: "left" as const },
  { key: "taskType", label: "Task Type", align: "left" as const },
  { key: "scheduledDate", label: "Scheduled Date", align: "left" as const },
  { key: "location", label: "Location", align: "left" as const },
  { key: "dueDate", label: "Due Date", align: "left" as const },
  { key: "assignedTo", label: "Assigned To", align: "left" as const },
  { key: "notes", label: "Notes", align: "left" as const },
  { key: "status", label: "Status", align: "left" as const },
];

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function statusLabel(status: OperationTask["status"]): string {
  const labels: Record<string, string> = {
    new: "New",
    in_progress: "In Progress",
    completed: "Completed",
    delivered: "Delivered",
  };
  return labels[status] ?? status;
}

function taskTypeLabel(type: OperationTask["task_type"]): string {
  const labels: Record<string, string> = {
    cleaning: "Cleaning",
    delivery: "Delivery",
    pickup: "Pickup",
  };
  return labels[type] ?? type;
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

export default function OperationsSection() {
  const { data, isLoading } = useQuery<OperationTasksResponse>({
    queryKey: ["/api/operations/tasks"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/tasks?limit=50"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch tasks");
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
    reservationId: task.reservation_id || "—",
    car: task.car_name || "—",
    guestName: task.guest_name || "—",
    taskType: taskTypeLabel(task.task_type),
    scheduledDate: formatDate(task.scheduled_date),
    location: task.scheduled_location ? truncate(task.scheduled_location, 35) : "—",
    dueDate: formatDate(task.due_date),
    assignedTo: task.assigned_to || "—",
    notes: task.notes ? truncate(task.notes, 50) : "—",
    status: statusLabel(task.status),
  }));

  return (
    <div className="mb-8">
      <SectionHeader title="OPERATIONS" subtitle="PICK UP AND DROP OFF" />

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <div className="mt-4">
            {rows.length === 0 ? (
              <div className="rounded-md bg-[#111111] px-6 py-8 text-center">
                <p className="text-sm text-white/60">No tasks found</p>
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
