import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { StatusBadge } from "./StatusBadge";
import { TaskAssignmentModal } from "./TaskAssignmentModal";
import { Truck, Sparkles, Package } from "lucide-react";
import type { TuroTrip, OperationTask, TaskType } from "./types";

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    );
  } catch {
    return dateStr;
  }
};

/**
 * Compute days rented as ceil(hours / 24); cancelled trips don't count.
 * Mirrors the logic on the Turo Trips page so the two screens agree.
 */
const calculateDaysRented = (
  tripStart: string | null,
  tripEnd: string | null,
  status: string | null,
): number | null => {
  if (!tripStart || !tripEnd) return null;
  if ((status || "").toLowerCase() === "cancelled") return null;
  try {
    const start = new Date(tripStart).getTime();
    const end = new Date(tripEnd).getTime();
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

export function TripsOverviewTab() {
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
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAssigned, setFilterAssigned] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data, isLoading } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", { limit: 100 }],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/turo-trips?limit=100"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch trips");
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

  const allTrips = data?.data || [];
  const allTasks = tasksData?.data || [];
  const activeTrips = allTrips.filter(
    (t) =>
      t.status?.toLowerCase() === "booked" ||
      t.status?.toLowerCase() === "active",
  );
  const completedTrips = allTrips.filter(
    (t) => t.status?.toLowerCase() === "completed",
  );
  const cancelledTrips = allTrips.filter(
    (t) => t.status?.toLowerCase() === "cancelled",
  );

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

  const trips = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    // include the full "to" day by adding 24h - 1ms
    const to = dateTo
      ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1
      : null;

    return allTrips.filter((trip) => {
      if (q) {
        const hay = [
          trip.reservationId,
          trip.carName,
          trip.guestName,
          trip.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (
        filterStatus !== "all" &&
        (trip.status || "").toLowerCase() !== filterStatus
      )
        return false;
      if (filterAssigned !== "all") {
        const tripTasks = getTasksForTrip(trip.id);
        if (filterAssigned === "__unassigned__") {
          if (tripTasks.length > 0) return false;
        } else if (!tripTasks.some((t) => t.assigned_to === filterAssigned)) {
          return false;
        }
      }
      if (from != null || to != null) {
        const start = trip.tripStart
          ? new Date(trip.tripStart).getTime()
          : null;
        if (start == null) return false;
        if (from != null && start < from) return false;
        if (to != null && start > to) return false;
      }
      return true;
    });
  }, [
    allTrips,
    allTasks,
    search,
    filterStatus,
    filterAssigned,
    dateFrom,
    dateTo,
  ]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    allTrips.forEach((t) => {
      if (t.status) set.add(t.status.toLowerCase());
    });
    return Array.from(set).sort();
  }, [allTrips]);

  const hasActiveFilters =
    search !== "" ||
    filterStatus !== "all" ||
    filterAssigned !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  const clearFilters = () => {
    setSearch("");
    setFilterStatus("all");
    setFilterAssigned("all");
    setDateFrom("");
    setDateTo("");
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

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Active Trips"
          value={String(activeTrips.length)}
          variant="gold"
        />
        <SummaryCard
          label="Completed"
          value={String(completedTrips.length)}
          variant="dark"
        />
        <SummaryCard
          label="Cancelled"
          value={String(cancelledTrips.length)}
          variant="white"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-auto">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Reservation #, car, guest..."
                className="bg-card border-border text-foreground h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-card border-border text-foreground w-[140px] h-9">
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
                <SelectTrigger className="bg-card border-border text-foreground w-[160px] h-9">
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
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-card border-border text-foreground h-9 w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">
                Trip Start To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-card border-border text-foreground h-9 w-[150px]"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-red-700 hover:text-red-700 hover:bg-red-900/20 h-9"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            Total: {trips.length}{" "}
            {trips.length === allTrips.length
              ? "trips"
              : `of ${allTrips.length} trips`}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Reservation #
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    CAR Name
                  </TableHead>
                  <TableHead className="text-foreground font-medium whitespace-nowrap">
                    Plate #
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
                ) : trips.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={17}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No trips found
                    </TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip) => {
                    const tripTasks = getTasksForTrip(trip.id);
                    const hasCleaning = hasTaskType(trip.id, "cleaning");
                    const hasDelivery = hasTaskType(trip.id, "delivery");
                    const hasPickup = hasTaskType(trip.id, "pickup");
                    const daysRented = calculateDaysRented(
                      trip.tripStart,
                      trip.tripEnd,
                      trip.status,
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
                        <TableCell className="text-foreground font-mono text-sm whitespace-nowrap">
                          {trip.reservationId || "--"}
                        </TableCell>
                        <TableCell className="text-foreground whitespace-nowrap">
                          {trip.carName || "--"}
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-sm whitespace-nowrap">
                          {trip.plateNumber || "--"}
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
                          {trip.milesIncluded || trip.totalDistance || "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {trip.tripStartOdometer != null
                            ? trip.tripStartOdometer.toLocaleString()
                            : "--"}
                        </TableCell>
                        <TableCell className="text-foreground text-sm tabular-nums whitespace-nowrap">
                          {trip.tripEndOdometer != null
                            ? trip.tripEndOdometer.toLocaleString()
                            : "--"}
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
                            <div className="flex flex-col gap-0.5 text-xs">
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
                                    title={`${t.task_type}: ${t.assigned_to}`}
                                  >
                                    <Icon
                                      className={`w-3 h-3 ${color} shrink-0`}
                                    />
                                    <span className="text-foreground truncate max-w-[120px]">
                                      {t.assigned_to || "--"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTaskModal(trip, "cleaning")}
                              className={`h-8 px-2 ${hasCleaning ? "text-yellow-500" : "text-muted-foreground hover:text-primary"}`}
                              title="Assign Cleaning"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTaskModal(trip, "delivery")}
                              className={`h-8 px-2 ${hasDelivery ? "text-blue-400" : "text-muted-foreground hover:text-primary"}`}
                              title="Assign Delivery"
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTaskModal(trip, "pickup")}
                              className={`h-8 px-2 ${hasPickup ? "text-green-500" : "text-muted-foreground hover:text-primary"}`}
                              title="Assign Pickup"
                            >
                              <Package className="w-3.5 h-3.5" />
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
      </div>

      <TaskAssignmentModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        prefill={taskPrefill}
      />
    </div>
  );
}
