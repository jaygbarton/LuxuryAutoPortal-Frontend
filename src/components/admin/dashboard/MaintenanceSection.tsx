import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
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
  // Trip context fields from backend join
  trip_id?: number | null;
  trip_reservation_id?: string | null;
  trip_start?: string | null;
  trip_end?: string | null;
  trip_pickup_location?: string | null;
  trip_delivery_location?: string | null;
  trip_return_location?: string | null;
  trip_extras?: string | null;
  trip_miles_included?: string | null;
  trip_total_distance?: string | number | null;
  trip_start_odometer?: number | null;
  trip_end_odometer?: number | null;
  trip_earnings?: number | null;
  trip_cancelled_earnings?: number | null;
  trip_status?: string | null;
  trip_plate_number?: string | null;
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
  { key: "reservationId", label: "Reservation #", align: "center" as const },
  { key: "car", label: "Car", align: "center" as const },
  { key: "plateNumber", label: "Plate #", align: "center" as const },
  { key: "tripStart", label: "Trip Start", align: "center" as const },
  { key: "pickupLocation", label: "Pick Up Location", align: "center" as const },
  { key: "tripEnd", label: "Trip Ends", align: "center" as const },
  { key: "daysRented", label: "Days Rented", align: "center" as const },
  { key: "dropOffLocation", label: "Drop Off Location", align: "center" as const },
  { key: "extras", label: "Extras", align: "center" as const },
  { key: "milesIncluded", label: "Miles Included", align: "center" as const },
  { key: "earnings", label: "Earnings", align: "center" as const },
  { key: "tripStatus", label: "Trip Status", align: "center" as const },
  { key: "taskDescription", label: "Task Description", align: "center" as const },
  { key: "assignedTo", label: "Assigned To", align: "center" as const },
  { key: "scheduledDate", label: "Scheduled Date", align: "center" as const },
  { key: "dueDate", label: "Due Date", align: "center" as const },
  { key: "repairShop", label: "Repair Shop", align: "center" as const },
  { key: "photos", label: "Photos", align: "center" as const },
  { key: "notes", label: "Notes", align: "center" as const },
  { key: "status", label: "Maint. Status", align: "center" as const },
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

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy h:mm a");
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

/** Render the Photos cell as a thumbnail of the first photo (with a count badge
 *  when there's more than one) instead of plain "N photos" text. Matches the
 *  thumbnail style used in TuroInspectionsSection. */
function renderPhotosCell(photos: string[] | null): ReactNode {
  if (!photos || photos.length === 0) return "—";
  const proxied = getProxiedImageUrl(photos[0]);
  const src = proxied.includes("/api/gcs-image-proxy")
    ? proxied + (proxied.includes("?") ? "&" : "?") + "size=128"
    : proxied;
  return (
    <div className="relative inline-block">
      <img
        src={src}
        alt="Maintenance photo"
        className="h-10 w-16 object-cover rounded mx-auto"
      />
      {photos.length > 1 && (
        <span className="absolute -top-1 -right-1 rounded-full bg-black px-1.5 text-[10px] font-bold leading-4 text-white">
          {photos.length}
        </span>
      )}
    </div>
  );
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

function tripStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const labels: Record<string, string> = {
    booked: "Booked",
    ended: "Ended",
    returned: "Returned",
    cancelled: "Cancelled",
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

function calculateDaysRented(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
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

  const rows = displayTasks.map((task) => {
    const hasTrip = !!(task.trip_id || task.trip_reservation_id || task.trip_start);
    const pickupLocation = task.trip_pickup_location || task.trip_delivery_location || "—";
    const dropOffLocation = task.trip_return_location || task.trip_delivery_location || task.trip_pickup_location || "—";
    const daysRented = calculateDaysRented(task.trip_start, task.trip_end);
    const earnings = task.trip_status?.toLowerCase() === "cancelled"
      ? task.trip_cancelled_earnings
      : task.trip_earnings;
    const plateNumber = task.car_plate || task.trip_plate_number || "—";

    return {
      reservationId: task.trip_reservation_id || "—",
      car: carLabel(task),
      plateNumber,
      tripStart: hasTrip ? formatDateTime(task.trip_start) : "—",
      pickupLocation: hasTrip ? pickupLocation : "—",
      tripEnd: hasTrip ? formatDateTime(task.trip_end) : "—",
      daysRented: daysRented != null ? daysRented : "—",
      dropOffLocation: hasTrip ? dropOffLocation : "—",
      extras: task.trip_extras || "—",
      milesIncluded: task.trip_miles_included || (task.trip_total_distance != null ? String(task.trip_total_distance) : null) || "—",
      earnings: earnings != null ? formatCurrency(earnings) : "—",
      tripStatus: tripStatusLabel(task.trip_status),
      taskDescription: task.task_description ? truncate(task.task_description, 50) : "—",
      assignedTo: task.assigned_to || "—",
      scheduledDate: formatDate(task.scheduled_date),
      dueDate: formatDate(task.due_date),
      repairShop: task.repair_shop || "—",
      photos: renderPhotosCell(task.photos),
      notes: task.notes ? truncate(task.notes, 50) : "—",
      status: statusLabel(task.status),
    };
  });

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
