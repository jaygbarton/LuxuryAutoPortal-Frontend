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
} from "lucide-react";
import type { Inspection, TuroTrip } from "./types";

const formatDate = (dateStr: string | null): string => {
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
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
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

  const { data, isLoading } = useQuery<{ data: Inspection[] }>({
    queryKey: ["/api/operations/inspections", "turo_return", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ source: "turo_return" });
      if (filterStatus !== "all") params.append("status", filterStatus);
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections?${params}`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch inspections");
      return response.json();
    },
  });

  const { data: tripsData } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", { limit: 500 }],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/turo-trips?limit=500"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
  });
  const tripsById = new Map((tripsData?.data || []).map((t) => [t.id, t]));

  const inspections = data?.data || [];

  const filteredInspections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo
      ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1
      : null;
    return inspections.filter((insp) => {
      if (q) {
        const trip = insp.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
        // Mirror every visible column so the search box matches anything the
        // user can see in the table.
        const hay = [
          // Inspection fields
          insp.car_name,
          insp.reservation_id,
          insp.assigned_to,
          insp.status,
          insp.source,
          insp.notes,
          insp.inspection_date,
          insp.due_date,
          // Joined trip fields
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
        const trip = insp.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
        const d = trip?.tripStart
          ? new Date(trip.tripStart).getTime()
          : insp.inspection_date
            ? new Date(insp.inspection_date).getTime()
            : null;
        if (d == null) return false;
        if (from != null && d < from) return false;
        if (to != null && d > to) return false;
      }
      return true;
    });
  }, [inspections, tripsById, search, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo, filterStatus, pageSize]);

  const pagedInspections = useMemo(
    () => filteredInspections.slice((page - 1) * pageSize, page * pageSize),
    [filteredInspections, page, pageSize],
  );

  const hasActiveFilters =
    filterStatus !== "all" || search !== "" || dateFrom !== "" || dateTo !== "";

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
      <SectionHeader
        title="Turo Messages"
        subtitle="Completed trips auto-appear here for post-return inspection"
        variant="plain"
      />

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
                  <SelectItem value="no_issues">No Car Issues</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Trip Start From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Trip Start To</label>
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
                  setFilterStatus("all");
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
            Total: {filteredInspections.length}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-medium">Reservation #</TableHead>
                  <TableHead className="text-foreground font-medium">CAR Name</TableHead>
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
                  <TableHead className="text-foreground font-medium">Inspection Status</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={18}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Loading inspections...
                    </TableCell>
                  </TableRow>
                ) : filteredInspections.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={18}
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
                          {earnings != null ? formatCurrency(earnings) : "--"}
                        </TableCell>
                        <TableCell>
                          {trip ? <StatusBadge status={trip.status} /> : <span className="text-muted-foreground text-sm">--</span>}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {insp.assigned_to}
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
                              <SelectItem value="in_progress">
                                In Progress
                              </SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="no_issues">
                                No Car Issues
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
    </div>
  );
}
