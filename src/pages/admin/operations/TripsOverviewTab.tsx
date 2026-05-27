import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { useCarNameWithYear } from "@/hooks/use-car-name-with-year";
import { StatusBadge } from "./StatusBadge";
import { TaskAssignmentModal } from "./TaskAssignmentModal";
import { Truck, Sparkles, Package, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TuroTrip, OperationTask, TaskType } from "./types";

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " " +
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

/**
 * Compute days rented as ceil(hours / 24).
 * We compute this for every trip — including cancelled ones — so the column
 * is never blank. Earnings/financials handle the cancelled case separately.
 * Mirrors the logic on the Turo Trips page so the two screens agree.
 */
const calculateDaysRented = (
  tripStart: string | null,
  tripEnd: string | null,
): number | null => {
  if (!tripStart || !tripEnd) return null;
  try {
    const start = new Date(tripStart).getTime();
    const end = new Date(tripEnd).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return null;
    }
    const hours = (end - start) / (1000 * 60 * 60);
    return Math.max(1, Math.ceil(hours / 24));
  } catch {
    return null;
  }
};

const formatCurrency = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
};

// A single per-task-type action chip used in the Actions column.
//   • If `task` is null → renders one grey icon button; click calls onAssign
//   • If `task` exists  → renders a coloured pill (icon body + corner ×).
//       - Click body  → onEdit
//       - Click ×     → onDelete (parent shows confirm dialog)
// Replaces the older "edit icon + separate trash icon" pair so each row has
// at most one button per task type.
function TaskChip({
  icon: Icon,
  task,
  assignedColor,
  assignedBg,
  labelEmpty,
  labelAssigned,
  labelDelete,
  onAssign,
  onEdit,
  onDelete,
}: {
  icon: typeof Sparkles;
  task: OperationTask | undefined;
  assignedColor: string;
  assignedBg: string;
  labelEmpty: string;
  labelAssigned: string;
  labelDelete: string;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!task) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAssign}
        title={labelEmpty}
        className="h-8 px-2 text-muted-foreground hover:text-primary"
      >
        <Icon className="w-3.5 h-3.5" />
      </Button>
    );
  }
  return (
    <div className="relative inline-flex">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onEdit}
        title={labelAssigned}
        className={`h-8 px-2 ${assignedBg} ${assignedColor} hover:opacity-80`}
      >
        <Icon className="w-3.5 h-3.5" />
      </Button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title={labelDelete}
        aria-label={labelDelete}
        className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

export function TripsOverviewTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Create-new-task modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<{
    turo_trip_id?: number;
    reservation_id?: string;
    car_name?: string;
    guest_name?: string;
    task_type?: TaskType;
    trip_start?: string;
    trip_end?: string;
    return_location?: string;
    delivery_location?: string;
  }>({});
  const [search, setSearch] = useState("");
  // Debounced copy of `search` so we don't refetch on every keystroke. The
  // server-side endpoint is fine handling our load but a 300ms gate keeps it
  // friendly and avoids flashing the loading state mid-typing.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAssigned, setFilterAssigned] = useState<string>("all");
  // Two independent date filters (per design): "Trip Start" lower-bounds the
  // trip_start column, "Trip Ends" upper-bounds the trip_end column. Both can
  // be set independently — leave either blank to skip that side of the range.
  const [tripStartFrom, setTripStartFrom] = useState<string>("");
  const [tripEndOn, setTripEndOn] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(
    "operations.tripsOverview",
  );

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const carNameWithYear = useCarNameWithYear();

  // Edit existing task modal state
  const [editingTask, setEditingTask] = useState<OperationTask | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Delete task confirmation state
  const [confirmDeleteTask, setConfirmDeleteTask] =
    useState<OperationTask | null>(null);

  // ── Inline edit state for Miles Included / Trip Start Odometer / Trip Ends
  // Odometer. Mirrors the same affordance on /admin/turo-trips so admins can
  // edit these in either place. tripId → string ('' for cleared, undefined
  // for "no pending edit yet"). Save buttons appear only when at least one
  // pending edit exists for the row.
  const [odoEdits, setOdoEdits] = useState<
    Record<number, { start?: string; end?: string }>
  >({});
  const [milesEdits, setMilesEdits] = useState<Record<number, string>>({});
  const [savingOdoRow, setSavingOdoRow] = useState<number | null>(null);
  const [savingMilesRow, setSavingMilesRow] = useState<number | null>(null);

  const saveRowOdometers = async (trip: TuroTrip) => {
    const edit = odoEdits[trip.id];
    if (!edit) return;
    const startVal =
      edit.start !== undefined
        ? edit.start
        : String(trip.tripStartOdometer ?? "");
    const endVal =
      edit.end !== undefined ? edit.end : String(trip.tripEndOdometer ?? "");
    setSavingOdoRow(trip.id);
    try {
      const res = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/odometers`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripStartOdometer: startVal !== "" ? parseInt(startVal, 10) : null,
            tripEndOdometer: endVal !== "" ? parseInt(endVal, 10) : null,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setOdoEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({
        title: "Odometer saved",
        description: `Reservation #${trip.reservationId}`,
      });
    } catch {
      toast({ title: "Failed to save odometer", variant: "destructive" });
    } finally {
      setSavingOdoRow(null);
    }
  };

  const saveRowMiles = async (trip: TuroTrip) => {
    const edited = milesEdits[trip.id];
    if (edited === undefined) return;
    setSavingMilesRow(trip.id);
    try {
      // /locations endpoint also writes milesIncluded — reuse it rather than
      // building a new endpoint just for one field. Send the row's existing
      // pickup/return values so they aren't wiped.
      const res = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/locations`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupLocation: trip.pickupLocation ?? "",
            returnLocation: trip.returnLocation ?? "",
            milesIncluded: edited.trim(),
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setMilesEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({
        title: "Miles included saved",
        description: `Reservation #${trip.reservationId}`,
      });
    } catch {
      toast({
        title: "Failed to save miles included",
        variant: "destructive",
      });
    } finally {
      setSavingMilesRow(null);
    }
  };

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await fetch(buildApiUrl(`/api/operations/tasks/${taskId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/tasks"] });
      toast({ title: "Task deleted" });
      setConfirmDeleteTask(null);
    },
    onError: () => {
      toast({ title: "Failed to delete task", variant: "destructive" });
    },
  });

  // Server-side filtered + paginated trip fetch. Previously this tab pulled
  // the first 100 trips and filtered client-side, which made every trip past
  // row 100 invisible AND silently excluded plate-# searches from the
  // haystack. We now mirror the /admin/turo-trips page: pass q / status /
  // date bounds / offset / limit to the backend so all rows are reachable.
  const { data, isLoading } = useQuery<{ data: TuroTrip[]; total: number }>({
    queryKey: [
      "/api/turo-trips",
      "operations-tab",
      debouncedSearch,
      filterStatus,
      tripStartFrom,
      tripEndOn,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String(offset));
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (filterStatus !== "all") params.set("status", filterStatus);
      // When the user types a search term, skip date filters so a reservation
      // ID / guest name / plate search always finds the trip regardless of
      // which date range the filters happen to be set to.
      if (!debouncedSearch.trim()) {
        if (tripStartFrom) params.set("startDate", tripStartFrom);
        if (tripEndOn) params.set("tripEndOn", tripEndOn);
      }
      const response = await fetch(
        buildApiUrl(`/api/turo-trips?${params.toString()}`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
  });

  // Unfiltered summary counts (Active / Completed / Cancelled cards). Kept
  // independent of the search/date filters so the cards always show fleet-wide
  // totals — matching what users expect from a "summary" row.
  const { data: summaryData } = useQuery<{
    data: { totalTrips: number; bookedTrips: number; cancelledTrips: number };
  }>({
    queryKey: ["/api/turo-trips/summary", "operations-tab-cards"],
    queryFn: async () => {
      const response = await fetch(
        buildApiUrl("/api/turo-trips/summary"),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch summary");
      return response.json();
    },
  });

  const { data: tasksData } = useQuery<{ data: OperationTask[] }>({
    queryKey: ["/api/operations/tasks", "all", "all"],
    queryFn: async () => {
      const response = await fetch(
        buildApiUrl("/api/operations/tasks?limit=500"),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    },
  });

  // `pageTrips` is the current page from the server. `total` is the count of
  // rows that match the active server-side filters (excluding the client-side
  // "Assigned" filter). Summary cards use the unfiltered counts from the
  // /summary endpoint so they always show fleet totals.
  const pageTrips = data?.data || [];
  const totalServerMatches = data?.total ?? pageTrips.length;
  const allTasks = tasksData?.data || [];
  const summary = summaryData?.data;
  // The DB schema uses statuses 'booked' and 'cancelled' only — there's no
  // 'completed'. We expose Completed = 0 to preserve the existing UI layout
  // (and match the value the old client-side count was returning).
  const activeTripCount = summary?.bookedTrips ?? 0;
  const completedTripCount = 0;
  const cancelledTripCount = summary?.cancelledTrips ?? 0;

  const getTasksForTrip = (tripId: number) => {
    return allTasks.filter((t) => t.turo_trip_id === tripId);
  };

  const hasTaskType = (tripId: number, taskType: TaskType) => {
    return allTasks.some(
      (t) => t.turo_trip_id === tripId && t.task_type === taskType,
    );
  };

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    allTasks.forEach((t) => {
      if (t.assigned_to) names.add(t.assigned_to);
    });
    return Array.from(names).sort();
  }, [allTasks]);

  // The search box, status, and date filters are all handled server-side now.
  // The Assigned-To filter still runs client-side because it joins against a
  // separate /api/operations/tasks query — applied to the current page only.
  const pagedTrips = useMemo(() => {
    if (filterAssigned === "all") return pageTrips;
    return pageTrips.filter((trip) => {
      const tripTasks = getTasksForTrip(trip.id);
      if (filterAssigned === "__unassigned__") {
        return tripTasks.length === 0;
      }
      return tripTasks.some((t) => t.assigned_to === filterAssigned);
    });
  }, [pageTrips, allTasks, filterAssigned]);

  // Reset to page 1 whenever any server-side filter changes so we don't end
  // up on an out-of-range page after the matched set shrinks.
  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    filterStatus,
    tripStartFrom,
    tripEndOn,
    pageSize,
  ]);

  // Status dropdown options. The DB only has 'booked' and 'cancelled'; expose
  // both unconditionally so the filter is usable even on an empty page.
  const statusOptions = ["booked", "cancelled"];

  const hasActiveFilters =
    search !== "" ||
    filterStatus !== "all" ||
    filterAssigned !== "all" ||
    tripStartFrom !== "" ||
    tripEndOn !== "";

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("all");
    setFilterAssigned("all");
    setTripStartFrom("");
    setTripEndOn("");
  };

  const openTaskModal = (trip: TuroTrip, taskType: TaskType) => {
    setTaskPrefill({
      turo_trip_id: trip.id,
      reservation_id: trip.reservationId,
      car_name: trip.carName || "",
      guest_name: trip.guestName || "",
      task_type: taskType,
      trip_start: trip.tripStart,
      trip_end: trip.tripEnd,
      return_location: trip.returnLocation || "",
      delivery_location: trip.deliveryLocation || trip.pickupLocation || "",
    });
    setTaskModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Trips Overview" variant="plain" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          label="Active Trips"
          value={String(activeTripCount)}
          variant="gold"
        />
        <SummaryCard
          label="Completed"
          value={String(completedTripCount)}
          variant="dark"
        />
        <SummaryCard
          label="Cancelled"
          value={String(cancelledTripCount)}
          variant="white"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-auto">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Reservation #, car, plate, guest, location..."
                className="bg-card border-border text-foreground h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">
                Assigned To
              </label>
              <Select value={filterAssigned} onValueChange={setFilterAssigned}>
                <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {assigneeOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">
                Trip Start From
              </label>
              <Input
                type="date"
                value={tripStartFrom}
                onChange={(e) => setTripStartFrom(e.target.value)}
                title="Show trips whose trip_start is on or after this date"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">
                Trip Ends To
              </label>
              <Input
                type="date"
                value={tripEndOn}
                onChange={(e) => setTripEndOn(e.target.value)}
                title="Show trips whose trip_end is on or before this date"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-red-700 hover:text-red-700 hover:bg-red-900/20 h-9 sm:col-span-2 lg:col-span-1 w-full lg:w-auto"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            {filterAssigned !== "all"
              ? `Showing ${pagedTrips.length} of ${totalServerMatches} matched trip${totalServerMatches === 1 ? "" : "s"} (Assigned filter applied to current page)`
              : `Total: ${totalServerMatches} trip${totalServerMatches === 1 ? "" : "s"}`}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="sticky left-0 z-20 bg-muted/40 text-foreground font-medium whitespace-nowrap">
                    Reservation #
                  </TableHead>
                  <TableHead className="sticky left-[130px] z-20 bg-muted/40 text-foreground font-medium whitespace-nowrap">
                    CAR Name
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Plate #
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    VIN #
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Trip Start
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Pick Up Location
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Trip Ends
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Days Rented
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Drop Off Location
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Extras
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Miles Included
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Trip Start Odometer
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Trip Ends Odometer
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Total Miles
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Earnings
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Status
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Assigned
                  </TableHead>
                  <TableHead className="text-center text-foreground font-medium whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={17}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Loading trips...
                    </TableCell>
                  </TableRow>
                ) : pagedTrips.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={17}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No trips found
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedTrips.map((trip) => {
                    const tripTasks = getTasksForTrip(trip.id);
                    const cleaningTask = tripTasks.find(
                      (t) => t.task_type === "cleaning",
                    );
                    const deliveryTask = tripTasks.find(
                      (t) => t.task_type === "delivery",
                    );
                    const pickupTask = tripTasks.find(
                      (t) => t.task_type === "pickup",
                    );
                    const daysRented = calculateDaysRented(
                      trip.tripStart,
                      trip.tripEnd,
                    );
                    const totalMiles =
                      trip.tripStartOdometer != null &&
                      trip.tripEndOdometer != null &&
                      trip.tripEndOdometer >= trip.tripStartOdometer
                        ? trip.tripEndOdometer - trip.tripStartOdometer
                        : null;

                    return (
                      <TableRow
                        key={trip.id}
                        className="border-border hover:bg-card/50 transition-colors"
                      >
                        <TableCell className="sticky left-0 z-10 bg-card text-foreground font-mono text-sm whitespace-nowrap">
                          {trip.reservationId || "--"}
                        </TableCell>
                        <TableCell className="sticky left-[130px] z-10 bg-card text-foreground whitespace-nowrap">
                          {carNameWithYear(trip.carName, trip.plateNumber)}
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-sm whitespace-nowrap">
                          {trip.plateNumber || "--"}
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-sm whitespace-nowrap">
                          {trip.vinNumber || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm whitespace-nowrap">
                          {formatDateTime(trip.tripStart)}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-sm max-w-[160px] truncate"
                          title={
                            trip.pickupLocation || trip.deliveryLocation || ""
                          }
                        >
                          {trip.pickupLocation || trip.deliveryLocation || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm whitespace-nowrap">
                          {formatDateTime(trip.tripEnd)}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {daysRented != null ? daysRented : "--"}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-sm max-w-[160px] truncate"
                          title={trip.returnLocation || ""}
                        >
                          {trip.returnLocation || "--"}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-sm max-w-[140px] truncate"
                          title={trip.extras || ""}
                        >
                          {trip.extras || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm whitespace-nowrap">
                          {(() => {
                            const pending = milesEdits[trip.id];
                            const value =
                              pending !== undefined
                                ? pending
                                : trip.milesIncluded ?? trip.totalDistance ?? "";
                            const dirty = pending !== undefined;
                            return (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={value}
                                  onChange={(e) =>
                                    setMilesEdits((prev) => ({
                                      ...prev,
                                      [trip.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="--"
                                  className="h-7 w-[110px] text-sm"
                                />
                                {dirty && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => saveRowMiles(trip)}
                                    disabled={savingMilesRow === trip.id}
                                  >
                                    {savingMilesRow === trip.id
                                      ? "…"
                                      : "Save"}
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {(() => {
                            const edit = odoEdits[trip.id];
                            const startStr =
                              edit?.start !== undefined
                                ? edit.start
                                : trip.tripStartOdometer != null
                                  ? String(trip.tripStartOdometer)
                                  : "";
                            return (
                              <Input
                                type="number"
                                value={startStr}
                                onChange={(e) =>
                                  setOdoEdits((prev) => ({
                                    ...prev,
                                    [trip.id]: {
                                      ...prev[trip.id],
                                      start: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="--"
                                className="h-7 w-[100px] text-sm"
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {(() => {
                            const edit = odoEdits[trip.id];
                            const endStr =
                              edit?.end !== undefined
                                ? edit.end
                                : trip.tripEndOdometer != null
                                  ? String(trip.tripEndOdometer)
                                  : "";
                            const dirty = edit !== undefined;
                            return (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={endStr}
                                  onChange={(e) =>
                                    setOdoEdits((prev) => ({
                                      ...prev,
                                      [trip.id]: {
                                        ...prev[trip.id],
                                        end: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="--"
                                  className="h-7 w-[100px] text-sm"
                                />
                                {/* Save button on the end cell saves BOTH
                                    odometer fields in one PATCH — same UX as
                                    /admin/turo-trips. */}
                                {dirty && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => saveRowOdometers(trip)}
                                    disabled={savingOdoRow === trip.id}
                                  >
                                    {savingOdoRow === trip.id ? "…" : "Save"}
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {totalMiles != null
                            ? totalMiles.toLocaleString()
                            : "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {formatCurrency(trip.earnings)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={trip.status} />
                        </TableCell>
                        <TableCell>
                          {tripTasks.length === 0 ? (
                            <span className="text-muted-foreground text-xs">
                              --
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1 text-xs">
                              {tripTasks.map((t) => {
                                const Icon =
                                  t.task_type === "cleaning"
                                    ? Sparkles
                                    : t.task_type === "delivery"
                                      ? Truck
                                      : Package;
                                const color =
                                  t.task_type === "cleaning"
                                    ? "text-yellow-500"
                                    : t.task_type === "delivery"
                                      ? "text-blue-400"
                                      : "text-green-500";
                                return (
                                  <div
                                    key={t.id}
                                    className="flex items-center gap-1.5"
                                    title={`${t.task_type}: ${t.assigned_to}${t.scheduled_date ? ` — ${new Date(t.scheduled_date).toLocaleString("en-US", { timeZone: "America/Denver", month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}` : ""}`}
                                  >
                                    <Icon className={`w-3 h-3 ${color} shrink-0`} />
                                    <span className={`${color} capitalize text-[10px] font-medium shrink-0`}>
                                      {t.task_type}:
                                    </span>
                                    <span className="text-foreground truncate max-w-[120px]">
                                      {t.assigned_to || "--"}
                                    </span>
                                    {t.scheduled_date && (
                                      <span className="text-muted-foreground text-[10px] whitespace-nowrap shrink-0">
                                        {(() => { try { return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(t.scheduled_date)); } catch { return ""; } })()}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                        {/* Actions — one chip per task type.
                            • Empty (grey icon)     → click to assign
                            • Assigned (colored)    → click body to edit, click × to delete
                            The × is only rendered for assigned tasks, so the row
                            never shows three identical trash icons. */}
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <TaskChip
                              icon={Sparkles}
                              task={cleaningTask}
                              assignedColor="text-yellow-500"
                              assignedBg="bg-yellow-500/10"
                              labelEmpty="Assign Cleaning"
                              labelAssigned="Edit Cleaning Task"
                              labelDelete="Delete Cleaning Task"
                              onAssign={() => openTaskModal(trip, "cleaning")}
                              onEdit={() => {
                                if (cleaningTask) {
                                  setEditingTask(cleaningTask);
                                  setEditModalOpen(true);
                                }
                              }}
                              onDelete={() =>
                                cleaningTask &&
                                setConfirmDeleteTask(cleaningTask)
                              }
                            />
                            <TaskChip
                              icon={Truck}
                              task={deliveryTask}
                              assignedColor="text-blue-400"
                              assignedBg="bg-blue-400/10"
                              labelEmpty="Assign Delivery"
                              labelAssigned="Edit Delivery Task"
                              labelDelete="Delete Delivery Task"
                              onAssign={() => openTaskModal(trip, "delivery")}
                              onEdit={() => {
                                if (deliveryTask) {
                                  setEditingTask(deliveryTask);
                                  setEditModalOpen(true);
                                }
                              }}
                              onDelete={() =>
                                deliveryTask &&
                                setConfirmDeleteTask(deliveryTask)
                              }
                            />
                            <TaskChip
                              icon={Package}
                              task={pickupTask}
                              assignedColor="text-green-500"
                              assignedBg="bg-green-500/10"
                              labelEmpty="Assign Pickup"
                              labelAssigned="Edit Pickup Task"
                              labelDelete="Delete Pickup Task"
                              onAssign={() => openTaskModal(trip, "pickup")}
                              onEdit={() => {
                                if (pickupTask) {
                                  setEditingTask(pickupTask);
                                  setEditModalOpen(true);
                                }
                              }}
                              onDelete={() =>
                                pickupTask && setConfirmDeleteTask(pickupTask)
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <TablePagination
          totalItems={totalServerMatches}
          itemsPerPage={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setPageSize}
          isLoading={isLoading}
        />
      </div>

      {/* Create new task modal */}
      <TaskAssignmentModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        prefill={taskPrefill}
      />

      {/* Edit existing task modal */}
      <TaskAssignmentModal
        open={editModalOpen}
        onOpenChange={(open) => {
          setEditModalOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
      />

      {/* Delete task confirmation */}
      {confirmDeleteTask && (
        <Dialog
          open
          onOpenChange={(open) => !open && setConfirmDeleteTask(null)}
        >
          <DialogContent className="bg-card border-border text-foreground max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Task?</DialogTitle>
              <DialogDescription>
                Delete the{" "}
                <strong className="capitalize">
                  {confirmDeleteTask.task_type}
                </strong>{" "}
                task assigned to{" "}
                <strong>{confirmDeleteTask.assigned_to}</strong>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDeleteTask(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteTaskMutation.mutate(confirmDeleteTask.id)}
                disabled={deleteTaskMutation.isPending}
              >
                {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
