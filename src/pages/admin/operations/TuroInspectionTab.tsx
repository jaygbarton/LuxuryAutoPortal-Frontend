import { useState, useMemo, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { StatusBadge } from "./StatusBadge";
import { InspectionModal } from "./InspectionModal";
import { useToast } from "@/hooks/use-toast";
import {
  Edit,
  Trash2,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  History,
  Plus,
} from "lucide-react";
import type { Inspection, TuroTrip } from "./types";
import { TaskAssignmentModal } from "./TaskAssignmentModal";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";

const formatDate = (dateStr: string | null): string => {
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

export function TuroInspectionTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<Record<string, any>>({});
  // Two independent date filters (mirrors the Trips Overview tab):
  //   Trip Start ⟶ trip.tripStart ≥ X
  //   Trip Ends  ⟶ trip.tripEnd   ≤ Y
  // Either can be set alone. Leave both blank to disable.
  const [tripStartFrom, setTripStartFrom] = useState<string>("");
  const [tripEndOn, setTripEndOn] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(
    "operations.turoMessages",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(
    null,
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingInspection, setDeletingInspection] =
    useState<Inspection | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyInspection, setHistoryInspection] = useState<Inspection | null>(
    null,
  );

  // ── Inline edit state for Miles Included / Trip Start Odometer /
  // Trip Ends Odometer. Mirrors the same affordance on the Trips Overview
  // tab and on /admin/turo-trips — admins can edit the value in whichever
  // tab they happen to have open. Keyed by trip.id (NOT inspection id)
  // because the backend PATCH endpoints address the underlying trip.
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
      // building a new endpoint. Send the existing pickup/return values so
      // they aren't wiped.
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

  // Auto-sync ended Turo trips into inspection stubs on first load
  useEffect(() => {
    fetch(buildApiUrl("/api/operations/inspections/auto-sync-ended-trips"), {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.json())
      .then((body) => {
        if (body?.created > 0) {
          queryClient.invalidateQueries({
            queryKey: ["/api/operations/inspections"],
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useQuery<{ data: Inspection[]; total: number }>({
    queryKey: ["/api/operations/inspections", "turo_return", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ source: "turo_return", limit: "2000" });
      if (filterStatus !== "all") {
        params.append("status", filterStatus);
      } else {
        // no_issues rows have been resolved — they live in No Car Issues tab
        params.append("excludeStatus", "no_issues");
      }
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections?${params}`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch inspections");
      return response.json();
    },
  });

  const { data: maintenanceData } = useQuery<{ data: { inspection_id: number | null }[] }>({
    queryKey: ["/api/operations/maintenance", "all"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/maintenance?limit=500"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch maintenance");
      return res.json();
    },
  });
  const maintenanceInspectionIds = new Set(
    (maintenanceData?.data ?? []).map(m => m.inspection_id).filter((id): id is number => id != null)
  );

  // Fetch trips that overlap the active date filter window so the client-side
  // join is accurate. When no date filter is set, fetch a large page to cover
  // the full fleet. Keyed on the date filters so a filter change refreshes it.
  const { data: tripsData } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", "turo-messages-join", tripStartFrom, tripEndOn],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "2000" });
      // Use trip-overlap logic: trips that are active during the filter window.
      if (tripStartFrom) params.set("startDate", tripStartFrom);
      if (tripEndOn) params.set("endDate", tripEndOn);
      const res = await fetch(buildApiUrl(`/api/turo-trips?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
  });
  const tripsById = new Map((tripsData?.data || []).map((t) => [t.id, t]));

  const inspections = data?.data || [];

  // Convert a UTC ISO string to a YYYY-MM-DD date in Mountain Time so date
  // comparisons match what the admin sees in the Trip Start / Trip Ends columns.
  const toMtDate = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(iso));
    } catch { return null; }
  };

  const filteredInspections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inspections.filter((insp) => {
      // Rows moved to Maintenance or No Car Issues belong in those tabs
      if (maintenanceInspectionIds.has(insp.id)) return false;
      if (insp.status === "no_issues") return false;

      const trip = insp.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;

      if (q) {
        const hay = [
          insp.car_name, insp.reservation_id, insp.assigned_to, insp.status,
          insp.source, insp.notes, insp.inspection_date, insp.due_date,
          trip?.plateNumber, trip?.pickupLocation, trip?.deliveryLocation,
          trip?.returnLocation, trip?.extras, trip?.milesIncluded,
          trip?.totalDistance, trip?.status, trip?.tripStart, trip?.tripEnd,
          trip?.earnings != null ? String(trip.earnings) : null,
          trip?.tripStartOdometer != null ? String(trip.tripStartOdometer) : null,
          trip?.tripEndOdometer != null ? String(trip.tripEndOdometer) : null,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // Date filters compare YYYY-MM-DD strings in Mountain Time so they match
      // the displayed Trip Start / Trip Ends values exactly.
      if (!q && tripStartFrom) {
        const startDate = toMtDate(trip?.tripStart ?? insp.inspection_date);
        if (!startDate || startDate < tripStartFrom) return false;
      }
      if (!q && tripEndOn) {
        const endDate = toMtDate(trip?.tripEnd ?? insp.inspection_date);
        if (!endDate || endDate > tripEndOn) return false;
      }

      return true;
    });
  }, [inspections, maintenanceInspectionIds, tripsById, search, tripStartFrom, tripEndOn]);

  useEffect(() => {
    setPage(1);
  }, [search, tripStartFrom, tripEndOn, filterStatus, pageSize]);

  const pagedInspections = useMemo(
    () => filteredInspections.slice((page - 1) * pageSize, page * pageSize),
    [filteredInspections, page, pageSize],
  );

  const hasActiveFilters =
    filterStatus !== "all" ||
    search !== "" ||
    tripStartFrom !== "" ||
    tripEndOn !== "";

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}`),
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
        queryKey: ["/api/operations/inspections"],
      });
      toast({ title: "Success", description: "Inspection status updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Inline assignee edit for the Turo Messages stage. Independent from the
  // Car Issues and Maintenance stage assignments.
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
        buildApiUrl(`/api/operations/inspections/${id}`),
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
        queryKey: ["/api/operations/inspections"],
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

  const moveToInspectionsMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ source: "manual" }),
        },
      );
      if (!response.ok) throw new Error("Failed to move to Car Inspections");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      toast({ title: "Success", description: "Moved to Car Inspections" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveToMaintenanceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}/move-to-maintenance`),
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Failed to move to maintenance");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/maintenance"],
      });
      toast({ title: "Success", description: "Moved to Maintenance" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveToNoIssuesMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: "no_issues" }),
        },
      );
      if (!response.ok) throw new Error("Failed to move to No Car Issues");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      toast({ title: "Success", description: "Moved to No Car Issues" });
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
        buildApiUrl(`/api/operations/inspections/${id}`),
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
        queryKey: ["/api/operations/inspections"],
      });
      toast({ title: "Success", description: "Inspection deleted" });
      setDeleteModalOpen(false);
      setDeletingInspection(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <SectionHeader
          title="Turo Messages"
          subtitle="Completed trips auto-appear here for post-return inspection"
          variant="plain"
          className="mb-0"
        />
        <Button
          onClick={() => { setTaskPrefill({}); setTaskModalOpen(true); }}
          className="bg-primary text-primary-foreground hover:bg-primary/80 shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-auto">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Car, reservation, location, assignee..."
                className="bg-card border-border text-foreground h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Trip Start</label>
              <Input
                type="date"
                value={tripStartFrom}
                onChange={(e) => setTripStartFrom(e.target.value)}
                title="Show inspections whose trip_start is on or after this date"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Trip Ends</label>
              <Input
                type="date"
                value={tripEndOn}
                onChange={(e) => setTripEndOn(e.target.value)}
                title="Show inspections whose trip_end is on or before this date"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilterStatus("all");
                  setSearch("");
                  setTripStartFrom("");
                  setTripEndOn("");
                }}
                className="text-red-700 hover:text-red-700 hover:bg-red-900/20 h-9 sm:col-span-2 lg:col-span-1 w-full lg:w-auto"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            {filteredInspections.length !== (data?.total ?? filteredInspections.length)
              ? `Showing ${filteredInspections.length} of ${data?.total ?? inspections.length}`
              : `Total: ${data?.total ?? filteredInspections.length}`}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-medium">Reservation #</TableHead>
                  <TableHead className="text-foreground font-medium">CAR Name</TableHead>
                  <TableHead className="text-foreground font-medium">Plate #</TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">VIN #</TableHead>
                  <TableHead className="text-foreground font-medium">Trip Start</TableHead>
                  <TableHead className="text-foreground font-medium">Pick Up Location</TableHead>
                  <TableHead className="text-foreground font-medium">Trip Ends</TableHead>
                  <TableHead className="text-foreground font-medium">Days Rented</TableHead>
                  <TableHead className="text-foreground font-medium">Drop Off Location</TableHead>
                  <TableHead className="text-foreground font-medium">Extras</TableHead>
                  <TableHead className="text-foreground font-medium">Miles Included</TableHead>
                  <TableHead className="text-foreground font-medium">Trip Start Odometer</TableHead>
                  <TableHead className="text-foreground font-medium">Trip Ends Odometer</TableHead>
                  <TableHead className="text-foreground font-medium">Total Miles</TableHead>
                  <TableHead className="text-foreground font-medium">Earnings</TableHead>
                  <TableHead className="text-foreground font-medium">Trip Status</TableHead>
                  <TableHead className="text-foreground font-medium">Assigned To</TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Fuel Returned</TableHead>
                  <TableHead className="text-foreground font-medium">Inspection Status</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={19}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Loading inspections...
                    </TableCell>
                  </TableRow>
                ) : filteredInspections.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={19}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No Turo return inspections found
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedInspections.map((insp) => {
                    const trip =
                      insp.turo_trip_id != null
                        ? tripsById.get(insp.turo_trip_id)
                        : undefined;
                    const pickupLocation = trip?.pickupLocation || trip?.deliveryLocation || "--";
                    const dropOffLocation = trip?.returnLocation ?? trip?.deliveryLocation ?? "--";
                    const daysRented = trip ? calculateDaysRented(trip.tripStart, trip.tripEnd) : null;
                    const earnings = trip
                      ? (trip.status?.toLowerCase() === "cancelled"
                          ? trip.cancelledEarnings
                          : trip.earnings)
                      : null;
                    return (
                      <TableRow
                        key={insp.id}
                        className="border-border hover:bg-card/50 transition-colors"
                      >
                        <TableCell className="text-foreground font-mono text-sm">
                          {insp.reservation_id || trip?.reservationId || "--"}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {insp.car_name || "--"}
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-sm">
                          {trip?.plateNumber || "--"}
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-sm whitespace-nowrap">
                          {trip?.vinNumber || "--"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {trip ? formatDate(trip.tripStart) : "--"}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-sm max-w-[150px] truncate"
                          title={pickupLocation}
                        >
                          {pickupLocation}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {trip ? formatDate(trip.tripEnd) : "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm text-center">
                          {daysRented ?? "--"}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-sm max-w-[150px] truncate"
                          title={dropOffLocation}
                        >
                          {dropOffLocation}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-sm max-w-[120px] truncate"
                          title={trip?.extras || undefined}
                        >
                          {trip?.extras || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm">
                          {!trip ? (
                            "--"
                          ) : (
                            (() => {
                              const totalMiles =
                                trip.tripStartOdometer != null &&
                                trip.tripEndOdometer != null &&
                                trip.tripEndOdometer >= trip.tripStartOdometer
                                  ? (trip.tripEndOdometer - trip.tripStartOdometer).toLocaleString()
                                  : "--";
                              return (
                                <span>{totalMiles}</span>
                              );
                            })()
                          )}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums">
                          {!trip ? (
                            "--"
                          ) : (
                            (() => {
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
                            })()
                          )}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums">
                          {!trip ? (
                            "--"
                          ) : (
                            (() => {
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
                                      odometer fields in one PATCH. */}
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
                            })()
                          )}
                        </TableCell>
                        <TableCell className="text-foreground text-sm">
                          {trip?.totalDistance || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm">
                          {earnings != null ? formatCurrency(earnings) : "--"}
                        </TableCell>
                        <TableCell>
                          {trip ? <StatusBadge status={trip.status} /> : <span className="text-muted-foreground text-sm">--</span>}
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <EmployeeSelectCombobox
                            value={insp.assigned_to || ""}
                            onChange={(v) => {
                              if (!v) {
                                assigneeUpdateMutation.mutate({
                                  id: insp.id,
                                  assigned_to: null,
                                  assigned_to_id: null,
                                });
                              }
                            }}
                            onSelectEmployee={(emp) => {
                              if (emp) {
                                const fullName =
                                  [emp.employee_first_name, emp.employee_last_name]
                                    .filter(Boolean)
                                    .join(" ")
                                    .trim() ||
                                  emp.employee_email ||
                                  `Employee #${emp.employee_aid}`;
                                assigneeUpdateMutation.mutate({
                                  id: insp.id,
                                  assigned_to: fullName,
                                  assigned_to_id: emp.employee_aid,
                                });
                              }
                            }}
                            placeholder="Assign..."
                          />
                        </TableCell>
                        <TableCell>
                          {/* Fuel-returned chip. Red = empty/quarter (high
                              priority charge-back), amber = half/three_quarters,
                              green = full, gray = unknown / not yet recorded.
                              Mirrors the colors of the "not full" alert path. */}
                          {(() => {
                            const lvl = insp.fuel_level_returned ?? "unknown";
                            const style =
                              lvl === "empty"
                                ? "bg-red-100 text-red-800 border-red-200"
                                : lvl === "quarter"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : lvl === "half"
                                    ? "bg-amber-100 text-amber-800 border-amber-200"
                                    : lvl === "three_quarters"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : lvl === "full"
                                        ? "bg-green-100 text-green-800 border-green-200"
                                        : "bg-gray-100 text-gray-600 border-gray-200";
                            const label =
                              lvl === "empty"
                                ? "Empty"
                                : lvl === "quarter"
                                  ? "1/4"
                                  : lvl === "half"
                                    ? "1/2"
                                    : lvl === "three_quarters"
                                      ? "3/4"
                                      : lvl === "full"
                                        ? "Full"
                                        : "—";
                            return (
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${style}`}
                              >
                                {label}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={insp.status}
                            onValueChange={(v) =>
                              statusUpdateMutation.mutate({
                                id: insp.id,
                                status: v,
                              })
                            }
                          >
                            <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                              <StatusBadge status={insp.status} />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingInspection(insp);
                                setModalOpen(true);
                              }}
                              className="text-muted-foreground hover:text-primary h-8 px-2"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setHistoryInspection(insp);
                                setHistoryModalOpen(true);
                              }}
                              className="text-muted-foreground hover:text-blue-400 h-8 px-2"
                              title="View History"
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                statusUpdateMutation.mutate({
                                  id: insp.id,
                                  status: "completed",
                                })
                              }
                              className="text-muted-foreground hover:text-green-500 h-8 px-2"
                              title="Mark Complete"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                moveToInspectionsMutation.mutate(insp.id)
                              }
                              className="text-muted-foreground hover:text-primary h-8 px-2"
                              title="Move to Car Inspections"
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                moveToMaintenanceMutation.mutate(insp.id)
                              }
                              className="text-muted-foreground hover:text-blue-400 h-8 px-2"
                              title="Move to Maintenance"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveToNoIssuesMutation.mutate(insp.id)}
                              className="text-muted-foreground hover:text-emerald-400 h-8 px-2"
                              title="Move to No Car Issues"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingInspection(insp);
                                setDeleteModalOpen(true);
                              }}
                              className="text-muted-foreground hover:text-red-700 h-8 px-2"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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
          totalItems={filteredInspections.length}
          itemsPerPage={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setPageSize}
          isLoading={isLoading}
        />
      </div>

      <InspectionModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingInspection(null);
        }}
        inspection={editingInspection}
      />

      {deleteModalOpen && deletingInspection && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Delete Inspection
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete this inspection for{" "}
                {deletingInspection.car_name}?
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
                onClick={() => deleteMutation.mutate(deletingInspection.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-500/20 text-red-700 hover:bg-red-500/30"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {historyModalOpen && historyInspection && (
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
                  {formatDate(historyInspection.created_at)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground">
                  {formatDate(historyInspection.updated_at)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Current Status</span>
                <StatusBadge status={historyInspection.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="text-foreground">
                  {historyInspection.assigned_to}
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <TaskAssignmentModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        prefill={taskPrefill}
      />
    </div>
  );
}
