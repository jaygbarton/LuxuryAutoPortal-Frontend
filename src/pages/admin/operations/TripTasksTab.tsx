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
import { GasLevelCells } from "./GasLevelCells";
import { TaskAssignmentModal } from "./TaskAssignmentModal";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, History } from "lucide-react";
import type { OperationTask, TaskType, TaskStatus, TuroTrip } from "./types";

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

export function TripTasksTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterType, setFilterType] = useState<string>("no-refuel");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  // Single-day operations filters: Trip Start = cars going out that day,
  // Trip Ends = cars coming back that day. Each is one exact MT calendar date
  // and works independently (set either alone). This is the daily-ops model the
  // team uses for assigning cleaners/delivery/pickup — not a booking date range.
  const [tripStartOn, setTripStartOn] = useState<string>("");
  const [tripEndOn, setTripEndOn] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(
    "operations.tripTasks",
  );
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<OperationTask | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<OperationTask | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTask, setHistoryTask] = useState<OperationTask | null>(null);

  // Inline odometer editing — mirrors the same affordance on /admin/turo-trips
  // and the other operations tabs. tripId → string.
  const [odoEdits, setOdoEdits] = useState<
    Record<number, { start?: string; end?: string }>
  >({});
  const [savingOdoRow, setSavingOdoRow] = useState<number | null>(null);

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

  const { data, isLoading } = useQuery<{ data: OperationTask[]; total: number }>({
    queryKey: ["/api/operations/tasks", filterType, filterStatus, tripStartOn, tripEndOn, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType !== "all" && filterType !== "no-refuel") params.append("task_type", filterType);
      if (filterStatus !== "all") params.append("status", filterStatus);
      // Skip date filters when search is active so a reservation ID or name
      // search finds rows regardless of which date filters are set.
      if (!search.trim()) {
        if (tripStartOn) params.append("tripStartOn", tripStartOn);
        if (tripEndOn) params.append("tripEndOn", tripEndOn);
      }
      const qs = params.toString();
      const response = await fetch(
        buildApiUrl(`/api/operations/tasks${qs ? `?${qs}` : ""}`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    },
  });

  const { data: tripsData } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", "tasks-join"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/turo-trips?limit=5000"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
  });

  const tasks = data?.data || [];
  const tripsById = new Map((tripsData?.data || []).map((t) => [t.id, t]));

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q && filterType !== "no-refuel") return tasks;
    return tasks.filter((task) => {
      if (filterType === "no-refuel" && task.task_type === "refuel") return false;
      if (q) {
        const trip = task.turo_trip_id != null ? tripsById.get(task.turo_trip_id) : undefined;
        // Mirror every column the user can see in the table so any visible
        // text is reachable from the search box. Numeric columns are cast to
        // string so partial typing ("12345", "$120") works.
        const hay = [
          // Task fields
          task.reservation_id,
          task.car_name,
          task.guest_name,
          task.assigned_to,
          task.task_type,
          task.status,
          task.notes,
          task.scheduled_location,
          task.scheduled_date,
          task.due_date,
          // Joined trip fields
          // Joined-trip reservation # is shown when task.reservation_id is null,
          // so it must be searchable too (task.reservation_id alone misses it).
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
      return true;
    });
  }, [tasks, tripsById, search, filterType]);

  useEffect(() => {
    setPage(1);
  }, [search, tripStartOn, tripEndOn, filterType, filterStatus, pageSize]);

  const pagedTasks = useMemo(
    () => filteredTasks.slice((page - 1) * pageSize, page * pageSize),
    [filteredTasks, page, pageSize],
  );

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(buildApiUrl(`/api/operations/tasks/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/tasks"] });
      toast({ title: "Success", description: "Task status updated" });
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
      const response = await fetch(buildApiUrl(`/api/operations/tasks/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/tasks"] });
      toast({ title: "Success", description: "Task deleted" });
      setDeleteModalOpen(false);
      setDeletingTask(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClearFilters = () => {
    setFilterType("no-refuel");
    setFilterStatus("all");
    setSearch("");
    setTripStartOn("");
    setTripEndOn("");
  };

  const hasActiveFilters =
    filterType !== "no-refuel" ||
    filterStatus !== "all" ||
    search !== "" ||
    tripStartOn !== "" ||
    tripEndOn !== "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Trip Tasks" variant="plain" className="mb-0" />
        <Button
          onClick={() => {
            setEditingTask(null);
            setTaskModalOpen(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/80"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Reservation, car, guest, location..."
                className="bg-card border-border text-foreground h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="no-refuel">All (excl. Refuel)</SelectItem>
                  <SelectItem value="all">All (incl. Refuel)</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="pickup">Pickup</SelectItem>
                  <SelectItem value="refuel">Refuel Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Trip Start</label>
              <Input
                type="date"
                value={tripStartOn}
                onChange={(e) => setTripStartOn(e.target.value)}
                title="Show trips starting on this day (cars going out)"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Trip Ends</label>
              <Input
                type="date"
                value={tripEndOn}
                onChange={(e) => setTripEndOn(e.target.value)}
                title="Show trips ending on this day (cars coming back)"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="text-red-700 hover:text-red-700 hover:bg-red-900/20 h-9 sm:col-span-2 lg:col-span-1 w-full lg:w-auto"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            {filteredTasks.length !== (data?.total ?? filteredTasks.length)
              ? `Showing ${filteredTasks.length} of ${data?.total ?? tasks.length}`
              : `Total: ${data?.total ?? filteredTasks.length}`}
          </div>

          <div className="overflow-auto max-h-[60vh]">
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
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Gas Level Trip Start</TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Gas Level Trip End</TableHead>
                  <TableHead className="text-foreground font-medium">Earnings</TableHead>
                  <TableHead className="text-foreground font-medium">Trip Status</TableHead>
                  <TableHead className="text-foreground font-medium">Task Type</TableHead>
                  <TableHead className="text-foreground font-medium">Assigned To</TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">Scheduled Date/Time</TableHead>
                  <TableHead className="text-foreground font-medium">Task Status</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={23}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Loading tasks...
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={23}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedTasks.map((task) => {
                    const trip =
                      task.turo_trip_id != null
                        ? tripsById.get(task.turo_trip_id)
                        : undefined;
                    const pickupLocation = trip?.pickupLocation || trip?.deliveryLocation || "--";
                    const dropOffLocation = trip?.returnLocation ?? trip?.deliveryLocation ?? trip?.pickupLocation ?? "--";
                    const daysRented = trip ? calculateDaysRented(trip.tripStart, trip.tripEnd) : null;
                    const earnings = trip
                      ? (trip.status?.toLowerCase() === "cancelled"
                          ? trip.cancelledEarnings
                          : trip.earnings)
                      : null;
                    return (
                      <TableRow
                        key={task.id}
                        className="border-border hover:bg-card/50 transition-colors"
                      >
                        <TableCell className="text-foreground font-mono text-sm">
                          {task.reservation_id || trip?.reservationId || "N/A"}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {task.car_name || "--"}
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
                          {trip?.milesIncluded || trip?.totalDistance || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
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
                                      [trip.id]: { ...prev[trip.id], start: e.target.value },
                                    }))
                                  }
                                  onBlur={() => saveRowOdometers(trip)}
                                  placeholder="--"
                                  className="h-7 w-[100px] text-sm"
                                />
                              );
                            })()
                          )}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
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
                                        [trip.id]: { ...prev[trip.id], end: e.target.value },
                                      }))
                                    }
                                    onBlur={() => saveRowOdometers(trip)}
                                    placeholder="--"
                                    className="h-7 w-[100px] text-sm"
                                  />
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
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {(() => {
                            if (!trip) return "--";
                            const startOdo = trip.tripStartOdometer;
                            const endOdo = trip.tripEndOdometer;
                            if (startOdo != null && endOdo != null && endOdo >= startOdo) {
                              return (endOdo - startOdo).toLocaleString();
                            }
                            return "--";
                          })()}
                        </TableCell>
                        <GasLevelCells
                          tripId={task.turo_trip_id}
                          start={trip?.gasLevelTripStart}
                          end={trip?.gasLevelTripEnd}
                          onSaved={() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/operations/tasks"] });
                          }}
                        />
                        <TableCell className="text-foreground text-sm">
                          {earnings != null ? formatCurrency(earnings) : "--"}
                        </TableCell>
                        <TableCell>
                          {trip ? <StatusBadge status={trip.status} /> : <span className="text-muted-foreground text-sm">--</span>}
                        </TableCell>
                        <TableCell className="text-foreground capitalize">
                          {task.task_type}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {task.assigned_to}
                        </TableCell>
                        <TableCell className="text-foreground text-sm whitespace-nowrap">
                          {formatDate(task.scheduled_date)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={task.status}
                            onValueChange={(v) =>
                              statusUpdateMutation.mutate({
                                id: task.id,
                                status: v,
                              })
                            }
                          >
                            <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                              <StatusBadge status={task.status} />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="in_progress">
                                In Progress
                              </SelectItem>
                              <SelectItem value="completed">
                                Completed
                              </SelectItem>
                              <SelectItem value="delivered">
                                Delivered
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTask(task);
                                setTaskModalOpen(true);
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
                                setHistoryTask(task);
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
                                setDeletingTask(task);
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
          totalItems={filteredTasks.length}
          itemsPerPage={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setPageSize}
          isLoading={isLoading}
        />
      </div>

      <TaskAssignmentModal
        open={taskModalOpen}
        onOpenChange={(open) => {
          setTaskModalOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
      />

      {deleteModalOpen && deletingTask && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Task</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete this {deletingTask.task_type}{" "}
                task for {deletingTask.car_name}?
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
                onClick={() => deleteMutation.mutate(deletingTask.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-500/20 text-red-700 hover:bg-red-500/30"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {historyModalOpen && historyTask && (
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
                  {formatDate(historyTask.created_at)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground">
                  {formatDate(historyTask.updated_at)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Current Status</span>
                <StatusBadge status={historyTask.status} />
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Task Type</span>
                <span className="text-foreground capitalize">
                  {historyTask.task_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="text-foreground">
                  {historyTask.assigned_to}
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
