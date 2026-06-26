import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardRecordCard } from "@/components/admin/dashboard";

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

function PhotoLightbox({ photos, startIndex, onClose }: { photos: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const proxied = getProxiedImageUrl(photos[idx]);
  const src = proxied.includes("/api/gcs-image-proxy")
    ? proxied + (proxied.includes("?") ? "&" : "?") + "size=1200"
    : proxied;
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <img src={src} alt={`Photo ${idx + 1}`} className="max-h-[80vh] max-w-full object-contain rounded" />
        {photos.length > 1 && (
          <div className="flex items-center gap-4 mt-3">
            <button onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
              className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-white text-sm">{idx + 1} / {photos.length}</span>
            <button onClick={() => setIdx(i => (i + 1) % photos.length)}
              className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
        <button onClick={onClose} className="absolute -top-8 right-0 text-white/70 hover:text-white text-sm">✕ Close</button>
      </div>
    </div>,
    document.body
  );
}

/** Render the Photos cell as a clickable thumbnail (opens lightbox). */
function PhotosCell({ photos }: { photos: string[] | null }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (!photos || photos.length === 0) return null;
  const proxied = getProxiedImageUrl(photos[0]);
  const src = proxied.includes("/api/gcs-image-proxy")
    ? proxied + (proxied.includes("?") ? "&" : "?") + "size=128"
    : proxied;
  return (
    <>
      <div
        className="relative inline-block cursor-pointer"
        onClick={() => setLightboxIndex(0)}
        title="Click to view photos"
      >
        <img
          src={src}
          alt="Maintenance photo"
          className="h-10 w-16 object-cover rounded mx-auto hover:opacity-90 transition-opacity"
        />
        {photos.length > 1 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-black px-1.5 text-[10px] font-bold leading-4 text-white">
            {photos.length}
          </span>
        )}
      </div>
      {lightboxIndex !== null && (
        <PhotoLightbox photos={photos} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
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

const MAINT_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "delivered", label: "Delivered" },
];

function StatusSelect({ id, value }: { id: number; value: string }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(buildApiUrl(`/api/operations/maintenance/${id}`), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/maintenance"] });
    },
  });

  return (
    <select
      value={value}
      onChange={(e) => mutation.mutate(e.target.value)}
      disabled={mutation.isPending}
      className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D] bg-white cursor-pointer"
    >
      {MAINT_STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const toMtDate = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(iso));
    } catch { return null; }
  };

  const allTasks = useMemo(() =>
    [...(data?.data ?? [])].sort((a, b) => {
      const aTime = a.trip_start ? new Date(a.trip_start).getTime() : (a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0);
      const bTime = b.trip_start ? new Date(b.trip_start).getTime() : (b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0);
      return aTime - bTime;
    }),
    [data]
  );

  const displayTasks = useMemo(() => {
    let f = allTasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter(t => [t.car_name, t.task_description, t.assigned_to, t.repair_shop, t.notes]
        .some(v => v && v.toLowerCase().includes(q)));
    }
    if (statusFilter !== "all") {
      f = f.filter(t => t.status === statusFilter);
    }
    if (fromDate || toDate) {
      const inRange = (day: string | null) =>
        day != null && (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
      f = f.filter(t => inRange(toMtDate(t.trip_start)) || inRange(toMtDate(t.trip_end)));
    }
    return f.slice(0, 20);
  }, [allTasks, search, statusFilter, fromDate, toDate]);

  const isFiltered = search || statusFilter !== "all" || fromDate || toDate;

  return (
    <div className="mb-8">
      <SectionHeader title="MAINTENANCE" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 mt-2">
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search car, description, assigned to…"
            className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]">
          <option value="all">All Statuses</option>
          {MAINT_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Trip Start/End</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          <span className="text-xs text-gray-400">–</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
          {(fromDate || toDate) && <button onClick={() => { setFromDate(""); setToDate(""); }} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
        </div>
        {isFiltered && (
          <>
            <span className="text-xs text-gray-500">{displayTasks.length} result{displayTasks.length !== 1 ? "s" : ""}</span>
            <button onClick={() => { setSearch(""); setStatusFilter("all"); setFromDate(""); setToDate(""); }} className="text-xs text-[#B8860B] hover:underline">Clear all</button>
          </>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="mt-4">
          {displayTasks.length === 0 ? (
            <div className="rounded-md bg-gray-50 border border-gray-200 px-6 py-8 text-center">
              <p className="text-sm text-gray-500">{isFiltered ? "No matching results." : "No maintenance tasks found"}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayTasks.map((task) => {
                const hasTrip = !!(task.trip_id || task.trip_reservation_id || task.trip_start);
                const pickupLocation = task.trip_pickup_location || task.trip_delivery_location || "—";
                const dropOffLocation = task.trip_return_location || task.trip_delivery_location || task.trip_pickup_location || "—";
                const daysRented = calculateDaysRented(task.trip_start, task.trip_end);
                const earnings = task.trip_status?.toLowerCase() === "cancelled"
                  ? task.trip_cancelled_earnings
                  : task.trip_earnings;
                const plateNumber = task.car_plate || task.trip_plate_number || "—";
                return (
                  <DashboardRecordCard
                    key={task.id}
                    accentBg="bg-orange-500"
                    accentBorder="border-orange-300"
                    typeLabel="Maintenance"
                    reservationId={task.trip_reservation_id}
                    carName={carLabel(task)}
                    plate={plateNumber}
                    assignedTo={task.assigned_to}
                    tripStart={hasTrip ? formatDateTime(task.trip_start) : "—"}
                    tripEnd={hasTrip ? formatDateTime(task.trip_end) : "—"}
                    pickupLocation={hasTrip ? pickupLocation : "—"}
                    dropoffLocation={hasTrip ? dropOffLocation : "—"}
                    media={<PhotosCell photos={task.photos} />}
                    details={[
                      { label: "Task Description", value: task.task_description || "—" },
                      { label: "Days Rented", value: daysRented != null ? daysRented : "—" },
                      { label: "Extras", value: task.trip_extras || "—" },
                      { label: "Miles Included", value: task.trip_miles_included || (task.trip_total_distance != null ? String(task.trip_total_distance) : null) || "—" },
                      { label: "Earnings", value: earnings != null ? formatCurrency(earnings) : "—" },
                      { label: "Trip Status", value: tripStatusLabel(task.trip_status) },
                      { label: "Scheduled Date", value: formatDate(task.scheduled_date) },
                      { label: "Due Date", value: formatDate(task.due_date) },
                      { label: "Repair Shop", value: task.repair_shop || "—" },
                    ]}
                    notes={task.notes || "—"}
                    statusControl={<StatusSelect id={task.id} value={task.status} />}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
