import { useState, useEffect, useMemo } from "react";
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
import { useCarNameWithYear } from "@/hooks/use-car-name-with-year";
import { StatusBadge } from "./StatusBadge";
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
      const qs = params.toString();
      const response = await fetch(
        buildApiUrl(`/api/operations/maintenance${qs ? `?${qs}` : ""}`),
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
    queryKey: ["/api/turo-trips", { limit: 5000 }],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/turo-trips?limit=5000"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const inspectionsById = new Map((inspectionsData?.data || []).map((i) => [i.id, i]));
  const tripsById = new Map((tripsData?.data || []).map((t) => [t.id, t]));

  const rawRecords = data?.data || [];

  const records = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo
      ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1
      : null;
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
          rec.task_description,
          rec.assigned_to,
          rec.repair_shop,
          rec.status,
          rec.notes,
          rec.inspection_car_issue_types?.join(" "),
          rec.scheduled_date,
          rec.due_date,
          // Joined inspection / trip fields
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
      if (from != null || to != null) {
        const d = rec.scheduled_date
          ? new Date(rec.scheduled_date).getTime()
          : null;
        if (d == null) return false;
        if (from != null && d < from) return false;
        if (to != null && d > to) return false;
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
                      Damage Reported
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
                Scheduled From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">
                Scheduled To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
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
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Fuel Returned</TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Car Issues Type</TableHead>
                  <TableHead className="text-foreground font-medium">Description</TableHead>
                  <TableHead className="text-foreground font-medium">Assigned To</TableHead>
                  <TableHead className="text-foreground font-medium">Scheduled Date</TableHead>
                  <TableHead className="text-foreground font-medium">Due Date</TableHead>
                  <TableHead className="text-foreground font-medium">Maint. Status</TableHead>
                  <TableHead className="text-foreground font-medium">Repair Shop</TableHead>
                  <TableHead className="text-foreground font-medium">Notes</TableHead>
                  <TableHead className="text-foreground font-medium">Photos</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={26}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Loading maintenance records...
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={26}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No maintenance records found
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRecords.map((rec) => {
                    const insp = rec.inspection_id != null ? inspectionsById.get(rec.inspection_id) : undefined;
                    const clientTrip = insp?.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
                    // Prefer trip context joined on the backend (rec.trip_*) — it's
                    // attached to every row regardless of the client's fetch window.
                    // Fall back to the client-side inspection→trip lookup for any
                    // field the backend join didn't supply.
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
                    const pickupLocation = trip?.pickupLocation || trip?.deliveryLocation || "--";
                    const dropOffLocation = trip?.returnLocation ?? trip?.deliveryLocation ?? "--";
                    const daysRented = trip ? calculateDaysRented(trip.tripStart, trip.tripEnd) : null;
                    const tripEarnings = trip
                      ? (trip.status?.toLowerCase() === "cancelled"
                          ? trip.cancelledEarnings
                          : trip.earnings)
                      : null;
                    const reservationId = rec.trip_reservation_id || insp?.reservation_id || trip?.reservationId || "--";
                    const plateNumber = rec.car_plate || trip?.plateNumber || "--";
                    // Prefer joined car fields; fall back to car_name for legacy rows
                    const fallbackParts = (rec.car_name || "").trim().split(/\s+/);
                    const make = rec.car_make || fallbackParts[0] || "--";
                    const model = rec.car_model || (fallbackParts.length > 1 ? fallbackParts.slice(1).join(" ") : "--");
                    let year = rec.car_year != null ? String(rec.car_year) : "";
                    if (!year && rec.car_name) {
                      const enriched = carNameWithYear(rec.car_name, rec.car_plate);
                      const match = enriched.match(/\b(19|20)\d{2}\b/);
                      if (match) year = match[0];
                    }
                    const carDisplayName = rec.car_name || (make !== "--" ? `${make} ${model}${year ? " " + year : ""}`.trim() : "--");
                    return (
                      <TableRow
                        key={rec.id}
                        className="border-border hover:bg-card/50 transition-colors"
                      >
                        <TableCell className="text-foreground font-mono text-sm whitespace-nowrap">
                          {reservationId}
                        </TableCell>
                        <TableCell className="text-foreground whitespace-nowrap">
                          {carDisplayName}
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-sm">
                          {plateNumber}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {trip ? formatDateTime(trip.tripStart) : formatDateTime(insp?.inspection_date ?? null)}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-sm max-w-[150px] truncate"
                          title={pickupLocation}
                        >
                          {trip ? pickupLocation : "--"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {trip ? formatDateTime(trip.tripEnd) : "--"}
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
                          {trip?.milesIncluded || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm">
                          {trip?.tripStartOdometer ?? "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm">
                          {trip?.tripEndOdometer ?? "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm">
                          {trip?.totalDistance || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm">
                          {tripEarnings != null ? formatCurrency(tripEarnings) : "--"}
                        </TableCell>
                        <TableCell>
                          {trip?.status ? <StatusBadge status={trip.status} /> : <span className="text-muted-foreground text-sm italic text-xs">Manual</span>}
                        </TableCell>
                        <TableCell>
                          <FuelReturnedCell level={rec.inspection_fuel_level_returned} />
                        </TableCell>
                        <TableCell>
                          <CarIssueTypesCell types={rec.inspection_car_issue_types} />
                        </TableCell>
                        <TableCell
                          className="text-foreground text-sm max-w-[200px] truncate"
                          title={rec.task_description}
                        >
                          {rec.task_description}
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <EmployeeSelectCombobox
                            value={rec.assigned_to || ""}
                            onChange={(v) => {
                              if (!v) {
                                assigneeUpdateMutation.mutate({
                                  id: rec.id,
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
                                  id: rec.id,
                                  assigned_to: fullName,
                                  assigned_to_id: emp.employee_aid,
                                });
                              }
                            }}
                            placeholder="Assign..."
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDateTime(rec.scheduled_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDateTime(rec.due_date)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={rec.status}
                            onValueChange={(v) =>
                              statusUpdateMutation.mutate({
                                id: rec.id,
                                status: v,
                              })
                            }
                          >
                            <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                              <StatusBadge status={rec.status} />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="damage_reported">
                                Damage Reported
                              </SelectItem>
                              <SelectItem value="in_review">
                                In Review
                              </SelectItem>
                              <SelectItem value="in_progress">
                                In Progress
                              </SelectItem>
                              <SelectItem value="in_repair">
                                In Repair
                              </SelectItem>
                              <SelectItem value="completed">
                                Completed
                              </SelectItem>
                              <SelectItem value="charged_customer">
                                Charged Customer
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-sm max-w-[160px] truncate"
                          title={rec.repair_shop || undefined}
                        >
                          {rec.repair_shop || "--"}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-sm max-w-[200px] truncate"
                          title={rec.notes || undefined}
                        >
                          {rec.notes || "--"}
                        </TableCell>
                        <TableCell>
                          {rec.photos && rec.photos.length > 0 ? (
                            <PhotoUpload
                              photos={rec.photos}
                              onPhotosChange={() => {}}
                              entityType="maintenance"
                              entityId={rec.id}
                              disabled
                            />
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              --
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingRecord(rec);
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
                                setHistoryRecord(rec);
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
                              onClick={() => {
                                setDeletingRecord(rec);
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
