import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";
import { DashboardRecordCard } from "@/components/admin/dashboard/DashboardRecordCard";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { useCarNameWithYear } from "@/hooks/use-car-name-with-year";
import { StatusBadge } from "./StatusBadge";
import { Badge } from "@/components/ui/badge";
import { MaintenanceModal } from "./MaintenanceModal";
import { PhotoUpload } from "./PhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, History } from "lucide-react";
import type { Inspection, MaintenanceRecord, TuroTrip } from "./types";
import { TaskAssignmentModal } from "./TaskAssignmentModal";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import { CarIssueTypesCell } from "./CarIssueTypesCell";
import { FuelReturnedCell } from "./FuelReturnedCell";

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      timeZone: "America/Denver",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        weekday: "short",
        month: "short",
        day: "numeric",
      }) +
      ", " +
      d.toLocaleTimeString("en-US", {
        timeZone: "America/Denver",
        hour: "numeric",
        minute: "2-digit",
      })
    );
  } catch {
    return dateStr;
  }
};

const formatCurrency = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
};

const calculateDaysRented = (
  tripStart: string | null,
  tripEnd: string | null,
): number | null => {
  if (!tripStart || !tripEnd) return null;
  try {
    const start = new Date(tripStart).getTime();
    const end = new Date(tripEnd).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const hours = (end - start) / (1000 * 60 * 60);
    return Math.max(1, Math.ceil(hours / 24));
  } catch {
    return null;
  }
};

/** Car Owner Approval Status chip for the Maintenance table. Shows
 *  Email Sent / Approved / Declined (with reason + self-pickup on hover). */
function OwnerApprovalBadge({ rec }: { rec: MaintenanceRecord }) {
  const s = rec.owner_approval_status || "not_sent";
  if (s === "not_sent") {
    // The SOP only emails owners who have an app account. If this task is
    // already "Maintenance Reported" but no email went out because the owner
    // can't log in, say so instead of a bare "--" that reads as "nothing
    // happened" (the case Cathy flagged on cars owned by non-app clients).
    const isReported = rec.status === "damage_reported";
    const hasAppAccess =
      rec.owner_has_app_access === 1 || rec.owner_has_app_access === true;
    if (isReported && !hasAppAccess) {
      return (
        <Badge
          className="bg-slate-500/20 text-slate-400 border-0 text-xs font-medium"
          title="The car owner does not have an app account, so the approval email was not sent. Handle approval manually."
        >
          No App Access
        </Badge>
      );
    }
    return <span className="text-xs text-muted-foreground">--</span>;
  }
  const map: Record<string, { label: string; cls: string }> = {
    email_sent: { label: "Email Sent", cls: "bg-blue-500/20 text-blue-400" },
    approved: { label: "Approved", cls: "bg-green-500/20 text-green-500" },
    declined: { label: "Declined", cls: "bg-red-500/20 text-red-500" },
    auto_approved: { label: "Auto-Approved", cls: "bg-amber-500/20 text-amber-500" },
  };
  const m = map[s] || map.email_sent;
  const wantsPickup = rec.owner_wants_pickup === 1 || rec.owner_wants_pickup === true;
  const title =
    s === "declined"
      ? `Reason: ${rec.owner_decline_reason || "—"}${wantsPickup ? "\nOwner will pick up the vehicle to self-manage (block-off forms required)." : ""}`
      : undefined;
  return (
    <span className="inline-flex flex-col items-start gap-0.5" title={title}>
      <Badge className={`${m.cls} border-0 text-xs font-medium`}>{m.label}</Badge>
      {s === "declined" && wantsPickup && (
        <span className="text-[10px] text-amber-500">Self-pickup</span>
      )}
    </span>
  );
}

interface MaintenanceTabProps {
  defaultStatus?: string;
  lockedStatus?: boolean;
}

export function MaintenanceTab({
  defaultStatus = "all",
  lockedStatus = false,
}: MaintenanceTabProps = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>(defaultStatus);
  const [search, setSearch] = useState<string>("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(
    null,
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] =
    useState<MaintenanceRecord | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<MaintenanceRecord | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(
    "operations.maintenance",
  );
  const carNameWithYear = useCarNameWithYear();

  const { data, isLoading } = useQuery<{ data: MaintenanceRecord[]; total: number }>({
    queryKey: ["/api/operations/maintenance", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      params.append("limit", "5000");
      const response = await fetch(
        buildApiUrl(`/api/operations/maintenance?${params.toString()}`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch maintenance records");
      return response.json();
    },
  });

  // Fetch inspections so we can resolve inspection_id → turo_trip_id
  const { data: inspectionsData } = useQuery<{ data: Inspection[] }>({
    queryKey: ["/api/operations/inspections", "all_sources", "all"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/operations/inspections?limit=5000"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch inspections");
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: tripsData } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", "maintenance-join"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/turo-trips?limit=5000"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
  });

  const inspectionsById = new Map((inspectionsData?.data || []).map((i) => [i.id, i]));
  const tripsById = new Map((tripsData?.data || []).map((t) => [t.id, t]));

  const rawRecords = data?.data || [];

  // UTC ISO → YYYY-MM-DD calendar day in Mountain Time, so the Scheduled
  // From/To filter buckets a record into the same day the Scheduled Date
  // column shows (a naive getTime() compare against a UTC-midnight date input
  // mis-buckets records scheduled near midnight MT).
  const toMtDate = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(iso));
    } catch { return null; }
  };

  const records = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawRecords.filter((rec) => {
      if (q) {
        const insp = rec.inspection_id != null ? inspectionsById.get(rec.inspection_id) : undefined;
        const trip = insp?.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
        // Mirror every visible column so the search box matches anything the
        // user can see in the table.
        const hay = [
          // Maintenance record fields
          rec.car_name,
          rec.car_make,
          rec.car_model,
          rec.car_plate,
          rec.car_vin,
          rec.task_description,
          rec.assigned_to,
          rec.repair_shop,
          rec.status,
          rec.notes,
          rec.inspection_car_issue_types?.join(" "),
          rec.scheduled_date,
          rec.due_date,
          // Backend-joined trip fields (rec.trip_*) — these are what the row
          // actually renders (e.g. Reservation #), attached to every row
          // regardless of the client's limited trips fetch window. Must be in
          // the haystack or searching a visible reservation id matches nothing.
          rec.trip_reservation_id,
          rec.trip_plate_number,
          rec.trip_pickup_location,
          rec.trip_delivery_location,
          rec.trip_return_location,
          rec.trip_extras,
          rec.trip_miles_included,
          rec.trip_status,
          rec.trip_start,
          rec.trip_end,
          // Joined inspection / client-side trip fields (fallback context)
          insp?.reservation_id,
          insp?.notes,
          trip?.plateNumber,
          trip?.pickupLocation,
          trip?.deliveryLocation,
          trip?.returnLocation,
          trip?.extras,
          trip?.milesIncluded,
          trip?.totalDistance,
          trip?.status,
          trip?.tripStart,
          trip?.tripEnd,
          trip?.earnings != null ? String(trip.earnings) : null,
          trip?.tripStartOdometer != null ? String(trip.tripStartOdometer) : null,
          trip?.tripEndOdometer != null ? String(trip.tripEndOdometer) : null,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dateFrom || dateTo) {
        const inRange = (day: string | null) =>
          day != null && (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
        const startDay = toMtDate(rec.trip_start ?? null);
        const endDay = toMtDate(rec.trip_end ?? null);
        if (!inRange(startDay) && !inRange(endDay)) return false;
      }
      return true;
    });
  }, [rawRecords, inspectionsById, tripsById, search, dateFrom, dateTo]);

  const hasActiveFilters =
    filterStatus !== (defaultStatus ?? "all") ||
    search !== "" ||
    dateFrom !== "" ||
    dateTo !== "";

  useEffect(() => {
    setPage(1);
  }, [filterStatus, search, dateFrom, dateTo, pageSize]);

  const pagedRecords = useMemo(
    () => records.slice((page - 1) * pageSize, page * pageSize),
    [records, page, pageSize],
  );

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/maintenance/${id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/maintenance"],
      });
      toast({ title: "Success", description: "Maintenance status updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Inline assignee edit for the Maintenance stage. Each stage owns its own
  // assignment so a different employee can handle Maintenance vs. the earlier
  // Car Issues / Turo Messages stages.
  const assigneeUpdateMutation = useMutation({
    mutationFn: async ({
      id,
      assigned_to,
      assigned_to_id,
    }: {
      id: number;
      assigned_to: string | null;
      assigned_to_id: number | null;
    }) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/maintenance/${id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ assigned_to, assigned_to_id }),
        },
      );
      if (!response.ok) throw new Error("Failed to update assignee");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/maintenance"],
      });
      toast({ title: "Assigned employee updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/maintenance/${id}`),
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/maintenance"],
      });
      toast({ title: "Success", description: "Maintenance record deleted" });
      setDeleteModalOpen(false);
      setDeletingRecord(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const newCount = rawRecords.filter((r) => r.status === "new").length;
  const inProgressCount = rawRecords.filter((r) =>
    ["in_review", "in_progress", "in_repair", "damage_reported"].includes(r.status)
  ).length;
  const completedCount = rawRecords.filter((r) =>
    ["completed", "charged_customer"].includes(r.status)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Maintenance" variant="plain" className="mb-0" />
        <div className="flex gap-2">
          <Button onClick={() => setTaskModalOpen(true)} variant="outline" className="border-primary text-primary hover:bg-primary/10">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
          <Button
            onClick={() => { setEditingRecord(null); setModalOpen(true); }}
            className="bg-primary text-primary-foreground hover:bg-primary/80"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Maintenance
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="New" value={String(newCount)} variant="gold" />
        <SummaryCard label="In Progress" value={String(inProgressCount)} variant="dark" />
        <SummaryCard label="Completed" value={String(completedCount)} variant="white" />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Car, plate, description, assignee, location..."
                className="bg-card border-border text-foreground h-9 w-full"
              />
            </div>
            {!lockedStatus && (
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground text-xs">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[170px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="damage_reported">
                      Maintenance Reported
                    </SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="in_repair">In Repair</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="charged_customer">
                      Charged Customer
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">
                Trip Start/End From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Show records whose Trip Start OR Trip End is on/after this day"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">
                To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Show records whose Trip Start OR Trip End is on/before this day"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilterStatus(defaultStatus ?? "all");
                  setSearch("");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-red-700 hover:text-red-700 hover:bg-red-900/20 h-9 sm:col-span-2 lg:col-span-1 w-full lg:w-auto"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            Total: {records.length}
          </div>

          <div className="flex flex-col gap-3">
            {isLoading ? (
              <p className="text-center py-12 text-muted-foreground">Loading maintenance records...</p>
            ) : records.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No maintenance records found</p>
            ) : (
              pagedRecords.map((rec) => {
                const insp = rec.inspection_id != null ? inspectionsById.get(rec.inspection_id) : undefined;
                const clientTrip = insp?.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
                const num = (v: string | number | null | undefined): number | null =>
                  v == null || v === "" ? null : Number(v);
                const trip = (rec.trip_id != null || rec.trip_reservation_id || rec.trip_start)
                  ? {
                      reservationId: rec.trip_reservation_id ?? clientTrip?.reservationId ?? null,
                      tripStart: rec.trip_start ?? clientTrip?.tripStart ?? null,
                      tripEnd: rec.trip_end ?? clientTrip?.tripEnd ?? null,
                      pickupLocation: rec.trip_pickup_location ?? clientTrip?.pickupLocation ?? null,
                      deliveryLocation: rec.trip_delivery_location ?? clientTrip?.deliveryLocation ?? null,
                      returnLocation: rec.trip_return_location ?? clientTrip?.returnLocation ?? null,
                      extras: rec.trip_extras ?? clientTrip?.extras ?? null,
                      milesIncluded: rec.trip_miles_included ?? clientTrip?.milesIncluded ?? null,
                      totalDistance: num(rec.trip_total_distance ?? clientTrip?.totalDistance),
                      tripStartOdometer: num(rec.trip_start_odometer ?? clientTrip?.tripStartOdometer),
                      tripEndOdometer: num(rec.trip_end_odometer ?? clientTrip?.tripEndOdometer),
                      earnings: num(rec.trip_earnings ?? clientTrip?.earnings),
                      cancelledEarnings: num(rec.trip_cancelled_earnings ?? clientTrip?.cancelledEarnings),
                      status: rec.trip_status ?? clientTrip?.status ?? null,
                      plateNumber: rec.trip_plate_number ?? clientTrip?.plateNumber ?? null,
                    }
                  : clientTrip;
                const pickupLocation = trip?.pickupLocation || trip?.deliveryLocation || null;
                const dropOffLocation = trip?.returnLocation ?? trip?.deliveryLocation ?? trip?.pickupLocation ?? null;
                const daysRented = trip ? calculateDaysRented(trip.tripStart, trip.tripEnd) : null;
                const tripEarnings = trip
                  ? (trip.status?.toLowerCase() === "cancelled" ? trip.cancelledEarnings : trip.earnings)
                  : null;
                const reservationId = rec.trip_reservation_id || insp?.reservation_id || trip?.reservationId || null;
                const plateNumber = rec.car_plate || trip?.plateNumber || null;
                const fallbackParts = (rec.car_name || "").trim().split(/\s+/);
                const make = rec.car_make || fallbackParts[0] || "--";
                const model = rec.car_model || (fallbackParts.length > 1 ? fallbackParts.slice(1).join(" ") : "--");
                let year = rec.car_year != null ? String(rec.car_year) : "";
                if (!year && rec.car_name) {
                  const enriched = carNameWithYear(rec.car_name, rec.car_plate);
                  const match = enriched.match(/\b(19|20)\d{2}\b/);
                  if (match) year = match[0];
                }
                // rec.car_name comes from maintenance_tasks.car_name, set at task
                // creation time — some rows stored it without the year (e.g. "Hyundai
                // Santa Fe") even though the car's year is known via the c.car_year
                // join, so append it here rather than trusting car_name as-is.
                const carNameHasYear = !!rec.car_name && /\b(19|20)\d{2}\b/.test(rec.car_name);
                const carDisplayName = rec.car_name
                  ? (carNameHasYear || !year ? rec.car_name : `${rec.car_name} ${year}`)
                  : (make !== "--" ? `${make} ${model}${year ? " " + year : ""}`.trim() : "--");
                // "CAR Name" details cell shows the full "Make Model Year - Plate #"
                // label (same convention as Claims / Ticket Violation) — carDisplayName
                // alone omits the plate, which is why it read as e.g. just "BMW X2 2.0L".
                const carNameWithPlateLabel = plateNumber
                  ? `${carDisplayName} - ${plateNumber}`
                  : carDisplayName;

                const statusAccent = rec.status === "completed" || rec.status === "charged_customer"
                  ? { bg: "bg-green-600", border: "border-green-300" }
                  : rec.status === "in_repair" || rec.status === "in_progress"
                  ? { bg: "bg-amber-500", border: "border-amber-300" }
                  : rec.status === "damage_reported"
                  ? { bg: "bg-orange-500", border: "border-orange-300" }
                  : rec.status === "in_review"
                  ? { bg: "bg-blue-500", border: "border-blue-300" }
                  : { bg: "bg-slate-500", border: "border-slate-300" };

                const statusControl = (
                  <Select
                    value={rec.status}
                    onValueChange={(v) => statusUpdateMutation.mutate({ id: rec.id, status: v })}
                  >
                    <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                      <StatusBadge status={rec.status} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="damage_reported">Maintenance Reported</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="in_repair">In Repair</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="charged_customer">Charged Customer</SelectItem>
                    </SelectContent>
                  </Select>
                );

                const actionsEl = (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingRecord(rec); setModalOpen(true); }} className="text-muted-foreground hover:text-primary h-7 px-2" title="Edit">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setHistoryRecord(rec); setHistoryModalOpen(true); }} className="text-muted-foreground hover:text-blue-400 h-7 px-2" title="View History">
                      <History className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setDeletingRecord(rec); setDeleteModalOpen(true); }} className="text-muted-foreground hover:text-red-700 h-7 px-2" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );

                const assigneeEl = (
                  <EmployeeSelectCombobox
                    value={rec.assigned_to || ""}
                    onChange={(v) => { if (!v) assigneeUpdateMutation.mutate({ id: rec.id, assigned_to: null, assigned_to_id: null }); }}
                    onSelectEmployee={(emp) => {
                      if (emp) {
                        const fullName = [emp.employee_first_name, emp.employee_last_name].filter(Boolean).join(" ").trim() || emp.employee_email || `Employee #${emp.employee_aid}`;
                        assigneeUpdateMutation.mutate({ id: rec.id, assigned_to: fullName, assigned_to_id: emp.employee_aid });
                      }
                    }}
                    placeholder="Assign..."
                  />
                );

                const tripIdForGas = rec.trip_id ?? clientTrip?.id;
                const gasStart = rec.gas_level_trip_start ?? clientTrip?.gasLevelTripStart ?? "";
                const gasEnd = rec.gas_level_trip_end ?? clientTrip?.gasLevelTripEnd ?? "";
                const GAS_OPTS = [
                  { value: "__none__", label: "--" },
                  { value: "empty", label: "Empty" },
                  { value: "quarter", label: "1/4" },
                  { value: "half", label: "1/2" },
                  { value: "three_quarters", label: "3/4" },
                  { value: "full", label: "Full" },
                ];
                const saveGas = async (newStart: string, newEnd: string) => {
                  if (!tripIdForGas) return;
                  try {
                    const res = await fetch(buildApiUrl(`/api/turo-trips/${tripIdForGas}/gas-levels`), {
                      method: "PATCH", credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ gasLevelTripStart: newStart || null, gasLevelTripEnd: newEnd || null }),
                    });
                    if (!res.ok) throw new Error();
                    queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/operations/maintenance"] });
                  } catch { toast({ title: "Failed to save gas levels", variant: "destructive" }); }
                };
                const gasEl = tripIdForGas ? (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Select value={gasStart || "__none__"} onValueChange={(v) => saveGas(v === "__none__" ? "" : v, gasEnd)}>
                      <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue placeholder="Start" /></SelectTrigger>
                      <SelectContent>{GAS_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-muted-foreground text-xs">→</span>
                    <Select value={gasEnd || "__none__"} onValueChange={(v) => saveGas(gasStart, v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue placeholder="End" /></SelectTrigger>
                      <SelectContent>{GAS_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : <span className="text-muted-foreground text-xs">--</span>;

                const photosEl = rec.photos && rec.photos.length > 0 ? (
                  <PhotoUpload photos={rec.photos} onPhotosChange={() => {}} entityType="maintenance" entityId={rec.id} disabled compact />
                ) : null;

                return (
                  <DashboardRecordCard
                    key={rec.id}
                    accentBg={statusAccent.bg}
                    accentBorder={statusAccent.border}
                    typeLabel="Maintenance"
                    reservationId={reservationId}
                    carName={rec.car_id ? undefined : carDisplayName}
                    plate={plateNumber}
                    assignedTo={rec.assigned_to || null}
                    tripStart={trip ? formatDateTime(trip.tripStart) : formatDateTime(insp?.inspection_date ?? null)}
                    tripEnd={trip ? formatDateTime(trip.tripEnd) : null}
                    pickupLocation={pickupLocation}
                    dropoffLocation={dropOffLocation}
                    statusControl={statusControl}
                    media={photosEl}
                    notes={rec.notes}
                    details={[
                      { label: "CAR Name", value: rec.car_id ? (
                        <Link href={`/admin/cars/${rec.car_id}/maintenance`} className="text-[#D3BC8D] hover:underline">{carNameWithPlateLabel}</Link>
                      ) : carNameWithPlateLabel },
                      { label: "Plate #", value: plateNumber || "--" },
                      { label: "VIN #", value: rec.car_vin || "--" },
                      { label: "Description", value: rec.task_description },
                      { label: "Assigned To", value: assigneeEl },
                      { label: "Scheduled", value: formatDateTime(rec.scheduled_date) },
                      { label: "Due Date", value: formatDateTime(rec.due_date) },
                      { label: "Trip Status", value: trip?.status ? <StatusBadge status={trip.status} /> : "Manual" },
                      { label: "Days Rented", value: daysRented ?? "--" },
                      { label: "Earnings", value: tripEarnings != null ? formatCurrency(tripEarnings) : "--" },
                      { label: "Miles Included", value: trip?.milesIncluded || (trip?.totalDistance != null ? String(trip.totalDistance) : null) || "--" },
                      { label: "Start Odo", value: trip?.tripStartOdometer != null ? String(trip.tripStartOdometer) : "--" },
                      { label: "End Odo", value: trip?.tripEndOdometer != null ? String(trip.tripEndOdometer) : "--" },
                      { label: "Total Miles", value: (() => { if (!trip) return "--"; const s = trip.tripStartOdometer; const e = trip.tripEndOdometer; return s != null && e != null && e >= s ? (e - s).toLocaleString() : "--"; })() },
                      { label: "Extras", value: trip?.extras || "--" },
                      { label: "Gas Levels", value: gasEl },
                      { label: "Fuel Returned", value: <FuelReturnedCell level={rec.inspection_fuel_level_returned} /> },
                      { label: "Car Issues", value: <CarIssueTypesCell types={rec.inspection_car_issue_types} /> },
                      { label: "Owner Approval", value: <OwnerApprovalBadge rec={rec} /> },
                      { label: "Repair Shop", value: rec.repair_shop || "--" },
                      { label: "Actions", value: actionsEl },
                    ]}
                  />
                );
              })
            )}
          </div>
        </div>
        <TablePagination
          totalItems={records.length}
          itemsPerPage={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setPageSize}
          isLoading={isLoading}
        />
      </div>

      <MaintenanceModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingRecord(null);
        }}
        record={editingRecord}
      />

      {deleteModalOpen && deletingRecord && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Delete Maintenance Record
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete this maintenance record for{" "}
                {deletingRecord.car_name}?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setDeleteModalOpen(false)}
                className="bg-card text-foreground border-border"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteMutation.mutate(deletingRecord.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-500/20 text-red-700 hover:bg-red-500/30"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {historyModalOpen && historyRecord && (
        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Edit History
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">
                  {formatDate(historyRecord.created_at)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground">
                  {formatDate(historyRecord.updated_at)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Current Status</span>
                <StatusBadge status={historyRecord.status} />
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">From Inspection</span>
                <span className="text-foreground">
                  {historyRecord.inspection_id
                    ? `#${historyRecord.inspection_id}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="text-foreground">
                  {historyRecord.assigned_to}
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <TaskAssignmentModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
      />
    </div>
  );
}
