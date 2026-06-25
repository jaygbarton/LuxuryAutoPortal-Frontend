import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { StatusBadge } from "./StatusBadge";
import { InspectionModal } from "./InspectionModal";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, Wrench, History, CheckCircle2, RotateCcw } from "lucide-react";
import type { Inspection, MaintenanceRecord, TuroTrip } from "./types";
import { TaskAssignmentModal } from "./TaskAssignmentModal";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import { CarIssueTypesCell } from "./CarIssueTypesCell";
import { FuelReturnedCell } from "./FuelReturnedCell";
import { GasLevelCells } from "./GasLevelCells";

const formatDate = (dateStr: string | null): string => {
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

export function CarInspectionsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("manual");
  const [search, setSearch] = useState<string>("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  // Single date RANGE filter: show inspections whose trip's Trip Start OR Trip
  // End falls within [rangeFrom, rangeTo]. A single day = set both to the same
  // date.
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingInspection, setDeletingInspection] = useState<Inspection | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyInspection, setHistoryInspection] = useState<Inspection | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(
    "operations.carIssues",
  );

  // Inline odometer editing — mirrors Turo Trips page and other ops tabs.
  const [odoEdits, setOdoEdits] = useState<
    Record<number, { start?: string; end?: string }>
  >({});
  const [savingOdoRow, setSavingOdoRow] = useState<number | null>(null);

  const saveRowOdometers = async (trip: TuroTrip) => {
    const edit = odoEdits[trip.id];
    if (!edit) return;
    const startVal =
      edit.start !== undefined ? edit.start : String(trip.tripStartOdometer ?? "");
    const endVal =
      edit.end !== undefined ? edit.end : String(trip.tripEndOdometer ?? "");
    setSavingOdoRow(trip.id);
    try {
      const res = await fetch(buildApiUrl(`/api/turo-trips/${trip.id}/odometers`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripStartOdometer: startVal !== "" ? parseInt(startVal, 10) : null,
          tripEndOdometer: endVal !== "" ? parseInt(endVal, 10) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setOdoEdits((prev) => { const next = { ...prev }; delete next[trip.id]; return next; });
      toast({ title: "Odometer saved", description: `Reservation #${trip.reservationId}` });
    } catch {
      toast({ title: "Failed to save odometer", variant: "destructive" });
    } finally {
      setSavingOdoRow(null);
    }
  };

  const { data, isLoading } = useQuery<{ data: Inspection[]; total: number }>({
    queryKey: ["/api/operations/inspections", "car_issues", filterStatus, filterSource],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "2000" });
      if (filterStatus !== "all") {
        params.append("status", filterStatus);
      } else {
        // no_issues records are permanently resolved — never show them here
        params.append("excludeStatus", "no_issues");
      }
      // Exclude turo_return records — those belong to the Turo Messages tab.
      // When filterSource is "all" we still exclude turo_return so this tab
      // never duplicates Turo Messages content.
      if (filterSource !== "all") {
        params.append("source", filterSource);
      } else {
        params.append("excludeSource", "turo_return");
      }
      const response = await fetch(buildApiUrl(`/api/operations/inspections?${params}`), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch inspections");
      return response.json();
    },
  });

  const { data: maintenanceData, isLoading: isMaintLoading } = useQuery<{ data: MaintenanceRecord[] }>({
    queryKey: ["/api/operations/maintenance", "all"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/operations/maintenance?limit=5000"), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch maintenance");
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: tripsData } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", "inspections-join"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/turo-trips?limit=5000"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
  });
  const tripsById = new Map((tripsData?.data || []).map((t) => [t.id, t]));

  const rawInspections = data?.data || [];
  const maintenanceRecords = maintenanceData?.data || [];

  const isMovedToMaintenance = (inspectionId: number): boolean => {
    return maintenanceRecords.some(m => m.inspection_id === inspectionId);
  };

  // Convert a UTC ISO string to its YYYY-MM-DD calendar day in Mountain Time so
  // the date filter buckets a trip into the same day the Trip Start column
  // shows. Comparing raw getTime() against a date-input parsed as UTC midnight
  // mis-buckets trips near midnight MT (the displayed day and the filtered day
  // disagree) — this matches the server-side America/Denver filter the
  // /admin/turo-trips page uses and the client-side filter on Turo Messages.
  const toMtDate = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(iso));
    } catch { return null; }
  };

  const inspections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawInspections.filter((insp) => {
      // Hide inspections moved to maintenance or marked no issues
      if (isMovedToMaintenance(insp.id)) return false;
      if (insp.status === "no_issues") return false;
      // Hide inspections whose Turo trip was cancelled — a cancelled trip never
      // happened, so there is nothing to inspect. (Manual inspections have no
      // trip and are unaffected.)
      const linkedTrip = insp.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
      if (linkedTrip?.status?.toLowerCase() === "cancelled") return false;
      if (q) {
        const trip = insp.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
        // Mirror every visible column so the search box matches anything the
        // user can see in the table.
        const hay = [
          insp.car_name,
          insp.reservation_id,
          insp.assigned_to,
          insp.source,
          insp.status,
          insp.notes,
          insp.inspection_date,
          insp.due_date,
          insp.car_issue_types?.join(" "),
          // Joined-trip reservation # is shown when insp.reservation_id is null,
          // so it must be searchable too (insp.reservation_id alone misses it).
          trip?.reservationId,
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
      if (filterSource !== "all" && insp.source !== filterSource) return false;
      // Skip date filters when searching — a reservation ID or car name search
      // should find the record regardless of date. ONE date RANGE: show records
      // whose Trip Start OR Trip End falls within [rangeFrom, rangeTo] (cars
      // going out + cars coming back). The Trip Start column falls back to
      // inspection_date for manual rows with no trip, so startDay mirrors that
      // fallback to stay consistent with the displayed value. A single day =
      // rangeFrom == rangeTo.
      if (!q && (rangeFrom || rangeTo)) {
        const trip = insp.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
        const startDay = toMtDate(trip?.tripStart ?? insp.inspection_date);
        const endDay = toMtDate(trip?.tripEnd);
        const inRange = (day: string | null) =>
          day != null && (!rangeFrom || day >= rangeFrom) && (!rangeTo || day <= rangeTo);
        if (!inRange(startDay) && !inRange(endDay)) return false;
      }
      return true;
    });
  }, [rawInspections, maintenanceRecords, tripsById, search, filterSource, rangeFrom, rangeTo]);

  const hasActiveFilters =
    filterStatus !== "all" ||
    filterSource !== "all" ||
    search !== "" ||
    rangeFrom !== "" ||
    rangeTo !== "";

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterSource, search, rangeFrom, rangeTo, pageSize]);

  const pagedInspections = useMemo(
    () => inspections.slice((page - 1) * pageSize, page * pageSize),
    [inspections, page, pageSize],
  );

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      toast({ title: "Success", description: "Inspection updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Inline assignee edit for the Car Issues stage. Each operations stage
  // (Turo Messages / Car Issues / Maintenance) owns its own assignment so a
  // different employee can handle each step.
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
      const response = await fetch(buildApiUrl(`/api/operations/inspections/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assigned_to, assigned_to_id }),
      });
      if (!response.ok) throw new Error("Failed to update assignee");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      toast({ title: "Assigned employee updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const moveToTuroMessagesMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source: "turo_return" }),
      });
      if (!response.ok) throw new Error("Failed to move to Turo Messages");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      toast({ title: "Success", description: "Moved back to Turo Messages" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const moveToMaintenanceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections/${id}/move-to-maintenance`), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to move to maintenance");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations/maintenance"] });
      toast({ title: "Success", description: "Moved to Maintenance" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      toast({ title: "Success", description: "Inspection deleted" });
      setDeleteModalOpen(false);
      setDeletingInspection(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(buildApiUrl("/api/operations/inspections"), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete all");
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      toast({ title: "All deleted", description: `${data.deleted} inspection(s) deleted.` });
      setDeleteAllConfirm(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Car Inspections" variant="plain" className="mb-0" />
        <div className="flex gap-2">
          <Button onClick={() => setDeleteAllConfirm(true)} variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
            Delete All
          </Button>
          <Button onClick={() => { setTaskModalOpen(true); }} variant="outline" className="border-primary text-primary hover:bg-primary/10">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
          <Button onClick={() => { setEditingInspection(null); setModalOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary/80">
            <Plus className="w-4 h-4 mr-2" />
            Add Manual Inspection
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg">
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
              <label className="text-muted-foreground text-xs">Source</label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[150px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="turo_return">Turo Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Trip Start/End From</label>
              <Input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                title="Show inspections whose Trip Start OR Trip End is on/after this day"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">To</label>
              <Input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                title="Show inspections whose Trip Start OR Trip End is on/before this day"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilterStatus("all");
                  setFilterSource("all");
                  setSearch("");
                  setRangeFrom("");
                  setRangeTo("");
                }}
                className="text-red-700 hover:text-red-700 hover:bg-red-900/20 h-9 sm:col-span-2 lg:col-span-1 w-full lg:w-auto"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            Total: {inspections.length}
          </div>

          <div className="overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Reservation #</TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">CAR Name</TableHead>
                  <TableHead className="text-foreground font-medium">Plate #</TableHead>
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
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Gas Level Trip Start</TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Gas Level Trip End</TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Fuel Returned</TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Car Issues Type</TableHead>
                  <TableHead className="text-foreground font-medium">Inspection Status</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isMaintLoading ? (
                  <TableRow>
                    <TableCell colSpan={22} className="text-center py-12 text-muted-foreground">Loading inspections...</TableCell>
                  </TableRow>
                ) : inspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={22} className="text-center py-12 text-muted-foreground">No inspections found</TableCell>
                  </TableRow>
                ) : (
                  pagedInspections.map((insp) => {
                    const movedToMaint = isMovedToMaintenance(insp.id);
                    const trip = insp.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
                    const isManual = !trip;
                    const pickupLocation = trip?.pickupLocation || trip?.deliveryLocation || "--";
                    const dropOffLocation = trip?.returnLocation ?? trip?.deliveryLocation ?? "--";
                    const daysRented = trip ? calculateDaysRented(trip.tripStart, trip.tripEnd) : null;
                    const earnings = trip
                      ? (trip.status?.toLowerCase() === "cancelled"
                          ? trip.cancelledEarnings
                          : trip.earnings)
                      : null;
                    return (
                      <TableRow key={insp.id} className="border-border hover:bg-card/50 transition-colors">
                        <TableCell className="text-foreground font-mono text-sm whitespace-nowrap">
                          {insp.reservation_id || trip?.reservationId || "--"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">{insp.car_name || "--"}</span>
                            {movedToMaint && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-0 text-[10px] px-1.5 py-0 gap-1">
                                <Wrench className="w-2.5 h-2.5" />
                                In Maintenance
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-sm">{trip?.plateNumber || "--"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {trip ? formatDate(trip.tripStart) : formatDate(insp.inspection_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate" title={pickupLocation}>
                          {isManual ? "--" : pickupLocation}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {trip ? formatDate(trip.tripEnd) : "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm text-center">
                          {daysRented ?? "--"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate" title={dropOffLocation}>
                          {isManual ? "--" : dropOffLocation}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[120px] truncate" title={trip?.extras || undefined}>
                          {trip?.extras || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm">
                          {trip?.milesIncluded || trip?.totalDistance || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {!trip ? "--" : (() => {
                            const edit = odoEdits[trip.id];
                            const startStr = edit?.start !== undefined ? edit.start : trip.tripStartOdometer != null ? String(trip.tripStartOdometer) : "";
                            return (
                              <Input
                                type="number"
                                value={startStr}
                                onChange={(e) => setOdoEdits((prev) => ({ ...prev, [trip.id]: { ...prev[trip.id], start: e.target.value } }))}
                                placeholder="--"
                                className="h-7 w-[100px] text-sm"
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {!trip ? "--" : (() => {
                            const edit = odoEdits[trip.id];
                            const endStr = edit?.end !== undefined ? edit.end : trip.tripEndOdometer != null ? String(trip.tripEndOdometer) : "";
                            const dirty = edit !== undefined;
                            return (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={endStr}
                                  onChange={(e) => setOdoEdits((prev) => ({ ...prev, [trip.id]: { ...prev[trip.id], end: e.target.value } }))}
                                  placeholder="--"
                                  className="h-7 w-[100px] text-sm"
                                />
                                {dirty && (
                                  <Button variant="default" size="sm" className="h-7 px-2" onClick={() => saveRowOdometers(trip)} disabled={savingOdoRow === trip.id}>
                                    {savingOdoRow === trip.id ? "…" : "Save"}
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {(() => {
                            if (!trip) return "--";
                            const s = trip.tripStartOdometer; const e = trip.tripEndOdometer;
                            if (s != null && e != null && e >= s) return (e - s).toLocaleString();
                            return "--";
                          })()}
                        </TableCell>
                        <TableCell className="text-foreground text-sm">
                          {earnings != null ? formatCurrency(earnings) : "--"}
                        </TableCell>
                        <TableCell>
                          {trip ? <StatusBadge status={trip.status} /> : <span className="text-muted-foreground text-sm italic text-xs">Manual</span>}
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
                        <GasLevelCells
                          tripId={insp.turo_trip_id}
                          start={trip?.gasLevelTripStart ?? insp.gas_level_trip_start}
                          end={trip?.gasLevelTripEnd ?? insp.gas_level_trip_end}
                          onSaved={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
                          }}
                        />
                        <TableCell>
                          <FuelReturnedCell level={insp.fuel_level_returned} />
                        </TableCell>
                        <TableCell>
                          <CarIssueTypesCell types={insp.car_issue_types} />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={insp.status}
                            onValueChange={(v) => statusUpdateMutation.mutate({ id: insp.id, status: v })}
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
                              variant="ghost" size="sm"
                              onClick={() => { setEditingInspection(insp); setModalOpen(true); }}
                              className="text-muted-foreground hover:text-primary h-8 px-2"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setHistoryInspection(insp); setHistoryModalOpen(true); }}
                              className="text-muted-foreground hover:text-blue-400 h-8 px-2"
                              title="View History"
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => moveToTuroMessagesMutation.mutate(insp.id)}
                              className="text-muted-foreground hover:text-yellow-500 h-8 px-2"
                              title="Move back to Turo Messages"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                            {!movedToMaint && insp.status !== "no_issues" && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => moveToMaintenanceMutation.mutate(insp.id)}
                                className="text-muted-foreground hover:text-blue-400 h-8 px-2"
                                title="Move to Maintenance"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {!movedToMaint && insp.status !== "no_issues" && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => statusUpdateMutation.mutate({ id: insp.id, status: "no_issues" })}
                                className="text-muted-foreground hover:text-emerald-400 h-8 px-2"
                                title="Mark No Car Issues"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setDeletingInspection(insp); setDeleteModalOpen(true); }}
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
          totalItems={inspections.length}
          itemsPerPage={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setPageSize}
          isLoading={isLoading || isMaintLoading}
        />
      </div>

      <InspectionModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingInspection(null); }}
        inspection={editingInspection}
      />

      {deleteModalOpen && deletingInspection && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Inspection</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete this inspection for {deletingInspection.car_name}?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteModalOpen(false)} className="bg-card text-foreground border-border">Cancel</Button>
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
              <DialogTitle className="text-foreground">Edit History</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">{formatDate(historyInspection.created_at)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground">{formatDate(historyInspection.updated_at)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Current Status</span>
                <StatusBadge status={historyInspection.status} />
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Source</span>
                <span className="text-foreground capitalize">{historyInspection.source?.replace(/_/g, " ") || "Manual"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Moved to Maintenance</span>
                <span className="text-foreground">{isMovedToMaintenance(historyInspection.id) ? "Yes" : "No"}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <TaskAssignmentModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
      />

      {deleteAllConfirm && (
        <Dialog open onOpenChange={() => setDeleteAllConfirm(false)}>
          <DialogContent className="bg-card border-border text-foreground max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete All Car Issues</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                This will permanently delete <strong>all</strong> car inspection records. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteAllConfirm(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteAllMutation.isPending}
                onClick={() => deleteAllMutation.mutate()}
              >
                {deleteAllMutation.isPending ? "Deleting..." : "Delete All"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
