import { optionKeywords } from "@/lib/select-search";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { getActiveTimezone } from "@/hooks/use-timezone";
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
import { MaintenanceRecordCard } from "./MaintenanceRecordCard";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { useCarNameWithYear } from "@/hooks/use-car-name-with-year";
import { StatusBadge } from "./StatusBadge";
import { Badge } from "@/components/ui/badge";
import { MaintenanceModal } from "./MaintenanceModal";
import { PhotoUpload } from "./PhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Plus, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OperationEditHistoryList } from "@/components/admin/OperationEditHistory";
import type { Inspection, MaintenanceRecord, TuroTrip } from "./types";
import { MAINTENANCE_SERVICE_TYPE_LABELS } from "./types";
import { TaskAssignmentModal } from "./TaskAssignmentModal";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import { CarIssueTypesCell } from "./CarIssueTypesCell";
import { FuelReturnedCell } from "./FuelReturnedCell";
import { CarPhotoCell } from "@/components/admin/dashboard/CarPhotoCell";
import { operationLocationMatches, useOperationLocationFilter } from "./OperationLocationFilter";
import { mtDayKeyOrNull } from "@/lib/mt-datetime";

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      timeZone: getActiveTimezone(),
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
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
        timeZone: getActiveTimezone(),
        weekday: "short",
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }) +
      ", " +
      d.toLocaleTimeString("en-US", {
        timeZone: getActiveTimezone(),
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

function oneMaintenancePerInspection(recs: MaintenanceRecord[]): MaintenanceRecord[] {
  const seen = new Set<number>();
  const out: MaintenanceRecord[] = [];
  for (const rec of recs) {
    if (rec.inspection_id == null) {
      out.push(rec);
      continue;
    }
    if (seen.has(rec.inspection_id)) continue;
    seen.add(rec.inspection_id);
    out.push(rec);
  }
  return out;
}

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

function OwnerApprovalBadge({ rec }: { rec: MaintenanceRecord }) {
  const s = rec.owner_approval_status || "not_sent";
  if (s === "not_sent") {
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
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge className={`${m.cls} border-0 text-xs font-medium`}>{m.label}</Badge>
      {rec.approval_email_sent_at && (
        <span className="text-[10px] text-muted-foreground">
          Requested: {formatDateTime(rec.approval_email_sent_at)}
        </span>
      )}
      {rec.owner_responded_at && (s === "approved" || s === "declined") && (
        <span className="text-[10px] text-muted-foreground">
          Responded: {formatDateTime(rec.owner_responded_at)}
        </span>
      )}
      {s === "declined" && (
        <span className="text-[10px] text-red-400 max-w-[220px] whitespace-normal">
          Reason: {rec.owner_decline_reason || "—"}
        </span>
      )}
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
  const locationFilter = useOperationLocationFilter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>(defaultStatus);
  const [search, setSearch] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      return api.get("/api/operations/inspections?limit=5000", {
        fallbackMessage: "Failed to fetch inspections",
      });
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: tripsData } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", "maintenance-join"],
    queryFn: async () => {
      return api.get("/api/turo-trips?limit=5000", {
        fallbackMessage: "Failed to fetch trips",
      });
    },
  });

  const inspectionsById = new Map((inspectionsData?.data || []).map((i) => [i.id, i]));
  const tripsById = new Map((tripsData?.data || []).map((t) => [t.id, t]));

  const rawRecords = oneMaintenancePerInspection(data?.data || []);

  const toMtDate = (iso: string | null | undefined): string | null =>
    mtDayKeyOrNull(iso, getActiveTimezone());

  const records = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawRecords.filter((rec) => {
      const insp = rec.inspection_id != null ? inspectionsById.get(rec.inspection_id) : undefined;
      const trip = insp?.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
      if (!operationLocationMatches(locationFilter, [
        rec.trip_pickup_location,
        rec.trip_delivery_location,
        rec.trip_return_location,
        trip?.pickupLocation,
        trip?.deliveryLocation,
        trip?.returnLocation,
        rec.car_name,
        rec.car_plate,
        rec.trip_plate_number,
      ])) return false;
      if (q) {
        const hay = [
          // Maintenance record fields
          rec.car_name,
          rec.car_make,
          rec.car_model,
          rec.car_plate,
          rec.car_vin,
          rec.service_type ? MAINTENANCE_SERVICE_TYPE_LABELS[rec.service_type] : null,
          rec.task_description,
          rec.assigned_to,
          rec.repair_shop,
          rec.repair_shop_license,
          rec.status,
          rec.notes,
          rec.car_issue_type,
          rec.inspection_car_issue_types?.join(" "),
          rec.scheduled_date,
          rec.due_date,
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
  }, [rawRecords, inspectionsById, tripsById, search, dateFrom, dateTo, locationFilter]);

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
    ["completed", "completed_no_receipt", "charged_customer"].includes(r.status)
  ).length;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeader title="Maintenance" variant="plain" className="mb-0" />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            onClick={() => { setEditingRecord(null); setModalOpen(true); }}
            className="min-h-11 bg-primary px-3 text-primary-foreground hover:bg-primary/80 sm:min-h-9"
          >
            <Plus className="h-4 w-4" />
            Add Maintenance
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="More maintenance actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="min-h-11" onSelect={() => setTaskModalOpen(true)}><Plus /> Add Task</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryCard label="New" value={String(newCount)} variant="gold" />
        <SummaryCard label="In Progress" value={String(inProgressCount)} variant="dark" />
        <SummaryCard label="Completed" value={String(completedCount)} variant="white" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="p-3 sm:p-4">
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <label htmlFor="maintenance-search" className="sr-only">Search maintenance</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="maintenance-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search cars, plates, tasks..."
                  className="h-11 w-full border-border bg-card pl-9 text-base text-foreground sm:h-9 sm:text-sm"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-controls="maintenance-filters"
                className="min-h-11 shrink-0 px-3 sm:hidden"
              >
                <SlidersHorizontal /> Filters
                {(filterStatus !== defaultStatus || dateFrom || dateTo) && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Filters applied" />}
              </Button>
            </div>
            <div id="maintenance-filters" className={`${filtersOpen ? "grid" : "hidden"} grid-cols-2 items-end gap-3 sm:grid lg:grid-cols-[minmax(150px,1fr)_150px_150px_auto]`}>
              {!lockedStatus && (
                <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
                  <label htmlFor="maintenance-status-filter" className="text-xs text-muted-foreground">Status</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger id="maintenance-status-filter" className="h-11 w-full border-border bg-card text-foreground sm:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="damage_reported">Maintenance Reported</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="in_repair">In Repair</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="completed_no_receipt">Completed-No Receipt Yet</SelectItem>
                      <SelectItem value="charged_customer">Charged Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor="maintenance-date-from" className="text-xs text-muted-foreground">Trip start/end from</label>
                <Input
                  id="maintenance-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  title="Show records whose Trip Start OR Trip End is on/after this day"
                  className="h-11 min-w-0 w-full border-border bg-card text-base text-foreground sm:h-9 sm:text-sm"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor="maintenance-date-to" className="text-xs text-muted-foreground">To</label>
                <Input
                  id="maintenance-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  title="Show records whose Trip Start OR Trip End is on/before this day"
                  className="h-11 min-w-0 w-full border-border bg-card text-base text-foreground sm:h-9 sm:text-sm"
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
                  className="col-span-2 min-h-11 text-muted-foreground sm:col-span-1 sm:min-h-9"
                >
                  Clear Filters
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{records.length} {records.length === 1 ? "record" : "records"}</span>
              {hasActiveFilters && !filtersOpen && <Button variant="ghost" onClick={() => { setFilterStatus(defaultStatus); setSearch(""); setDateFrom(""); setDateTo(""); }} className="min-h-11 px-2 text-xs sm:hidden">Clear Filters</Button>}
            </div>
          </div>
          <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
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
                const pickupLocation = trip?.returnLocation ?? trip?.deliveryLocation ?? trip?.pickupLocation ?? null;
                const dropOffLocation = trip?.pickupLocation || trip?.deliveryLocation || null;
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
                const carNameHasYear = !!rec.car_name && /\b(19|20)\d{2}\b/.test(rec.car_name);
                const carDisplayName = rec.car_name
                  ? (carNameHasYear || !year ? rec.car_name : `${rec.car_name} ${year}`)
                  : (make !== "--" ? `${make} ${model}${year ? " " + year : ""}`.trim() : "--");
                const carNameWithPlateLabel = plateNumber
                  ? `${carDisplayName} - ${plateNumber}`
                  : carDisplayName;

                const statusAccent = rec.status === "completed" || rec.status === "charged_customer"
                  ? { bg: "bg-green-600", border: "border-green-300" }
                  : rec.status === "completed_no_receipt"
                  ? { bg: "bg-lime-500", border: "border-lime-300" }
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
                    <SelectTrigger aria-label={`Change maintenance status for ${carDisplayName}`} className="h-auto min-h-11 min-w-0 w-full border-border bg-card px-3 py-2 sm:min-h-9">
                      <StatusBadge status={rec.status} className="min-w-0 whitespace-normal text-left leading-4" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="damage_reported">Maintenance Reported</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="in_repair">In Repair</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="completed_no_receipt">Completed-No Receipt Yet</SelectItem>
                      <SelectItem value="charged_customer">Charged Customer</SelectItem>
                    </SelectContent>
                  </Select>
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
                    placeholder="Assign employee..."
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
                      <SelectTrigger aria-label={`Trip starting gas for ${carDisplayName}`} className="h-11 w-[100px] text-sm sm:h-9"><SelectValue placeholder="Start" /></SelectTrigger>
                      <SelectContent>{GAS_OPTS.map((o) => <SelectItem searchKeywords={optionKeywords(o)} key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-muted-foreground text-xs">→</span>
                    <Select value={gasEnd || "__none__"} onValueChange={(v) => saveGas(gasStart, v === "__none__" ? "" : v)}>
                      <SelectTrigger aria-label={`Trip ending gas for ${carDisplayName}`} className="h-11 w-[100px] text-sm sm:h-9"><SelectValue placeholder="End" /></SelectTrigger>
                      <SelectContent>{GAS_OPTS.map((o) => <SelectItem searchKeywords={optionKeywords(o)} key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : <span className="text-muted-foreground text-xs">--</span>;

                const photosEl = rec.photos && rec.photos.length > 0 ? (
                  <PhotoUpload photos={rec.photos} onPhotosChange={() => {}} entityType="maintenance" entityId={rec.id} disabled compact />
                ) : null;
                const carPhotoEl = rec.car_photo ? (
                  <CarPhotoCell carPhoto={rec.car_photo} carName={carDisplayName} className="h-14 w-20 sm:h-16 sm:w-24" size={240} />
                ) : null;

                return (
                  <MaintenanceRecordCard
                    key={rec.id}
                    accentBg={statusAccent.bg}
                    carLabel={carDisplayName}
                    carName={rec.car_id ? <Link href={`/admin/cars/${rec.car_id}/maintenance`} className="hover:underline">{carDisplayName}</Link> : carDisplayName}
                    plate={plateNumber}
                    image={carPhotoEl}
                    service={rec.service_type ? MAINTENANCE_SERVICE_TYPE_LABELS[rec.service_type] : null}
                    description={rec.task_description}
                    scheduled={formatDateTime(rec.scheduled_date)}
                    due={formatDateTime(rec.due_date)}
                    statusControl={statusControl}
                    assigneeControl={assigneeEl}
                    approval={(rec.owner_approval_status && rec.owner_approval_status !== "not_sent") || (rec.status === "damage_reported" && !(rec.owner_has_app_access === 1 || rec.owner_has_app_access === true)) ? <OwnerApprovalBadge rec={rec} /> : undefined}
                    photos={photosEl}
                    notes={rec.notes}
                    onEdit={() => { setEditingRecord(rec); setModalOpen(true); }}
                    onHistory={() => { setHistoryRecord(rec); setHistoryModalOpen(true); }}
                    onDelete={() => { setDeletingRecord(rec); setDeleteModalOpen(true); }}
                    details={[
                      { label: "CAR Name", value: rec.car_id ? (
                        <Link href={`/admin/cars/${rec.car_id}/maintenance`} className="text-[#D3BC8D] hover:underline">{carNameWithPlateLabel}</Link>
                      ) : carNameWithPlateLabel },
                      { label: "Plate #", value: plateNumber || "--" },
                      { label: "VIN #", value: rec.car_vin || "--" },
                      { label: "Service Type", value: rec.service_type ? MAINTENANCE_SERVICE_TYPE_LABELS[rec.service_type] : "--" },
                      { label: "Description", value: rec.task_description },
                      { label: "Reservation #", value: reservationId || "--" },
                      { label: "Trip Start", value: trip ? formatDateTime(trip.tripStart) : formatDateTime(insp?.inspection_date ?? null) },
                      { label: "Trip End", value: trip ? formatDateTime(trip.tripEnd) : "--" },
                      { label: "Pick Up", value: pickupLocation || "--" },
                      { label: "Drop Off", value: dropOffLocation || "--" },
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
                      // The record's OWN issue — one record per reported issue.
                      // Legacy rows created before the split fall back to the
                      // inspection's full list.
                      { label: "Car Issue", value: <CarIssueTypesCell types={rec.car_issue_type ? [rec.car_issue_type] : rec.inspection_car_issue_types} /> },
                      { label: "Owner Approval", value: <OwnerApprovalBadge rec={rec} /> },
                      { label: "Repair Shop", value: rec.repair_shop || "--" },
                      { label: "Repair Shop License #", value: rec.repair_shop_license || "--" },
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
          <DialogContent className="bg-card border-border text-foreground max-w-lg">
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
            <div className="border-t border-border pt-3 mt-1">
              <h4 className="text-sm font-medium text-foreground mb-1">Edit Log</h4>
              <div className="max-h-[40vh] overflow-y-auto">
                <OperationEditHistoryList entityType="maintenance" entityId={historyRecord.id} />
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
