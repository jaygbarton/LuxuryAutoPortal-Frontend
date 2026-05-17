import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { useCarNameWithYear } from "@/hooks/use-car-name-with-year";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { StatusBadge } from "./StatusBadge";
import { PhotoUpload } from "./PhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw } from "lucide-react";
import type { Inspection, TuroTrip } from "./types";

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
};

export function NoCarIssuesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(
    "operations.noCarIssues",
  );
  const carNameWithYear = useCarNameWithYear();
  const [search, setSearch] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data, isLoading } = useQuery<{ data: Inspection[] }>({
    queryKey: ["/api/operations/inspections", "no_issues"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections?status=no_issues`), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch inspections");
      return response.json();
    },
  });

  // Trips lookup for plate # alongside car name.
  const { data: tripsData } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", { limit: 500 }],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/turo-trips?limit=500"), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch trips");
      return response.json();
    },
  });
  const tripsById = new Map((tripsData?.data || []).map((t) => [t.id, t]));

  const rawInspections = data?.data || [];

  const inspections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo
      ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1
      : null;
    return rawInspections.filter((insp) => {
      if (q) {
        const hay = [insp.car_name, insp.reservation_id, insp.assigned_to, insp.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterSource !== "all" && insp.source !== filterSource) return false;
      if (from != null || to != null) {
        const d = insp.inspection_date ? new Date(insp.inspection_date).getTime() : null;
        if (d == null) return false;
        if (from != null && d < from) return false;
        if (to != null && d > to) return false;
      }
      return true;
    });
  }, [rawInspections, search, filterSource, dateFrom, dateTo]);

  const hasActiveFilters =
    search !== "" || filterSource !== "all" || dateFrom !== "" || dateTo !== "";

  useEffect(() => {
    setPage(1);
  }, [search, filterSource, dateFrom, dateTo, pageSize]);

  const pagedInspections = useMemo(
    () => inspections.slice((page - 1) * pageSize, page * pageSize),
    [inspections, page, pageSize],
  );

  const reopenMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "in_progress" }),
      });
      if (!response.ok) throw new Error("Failed to reopen inspection");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      toast({ title: "Success", description: "Inspection reopened" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="No Car Issues" subtitle="Inspections that were resolved without requiring maintenance." variant="plain" />

      <div className="bg-card border border-border rounded-lg overflow-auto">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Car, reservation, assignee..."
                className="bg-card border-border text-foreground h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Source</label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="bg-card border-border text-foreground w-[150px] h-9">
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
              <label className="text-muted-foreground text-xs">
                Inspection From
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
                Inspection To
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
                onClick={() => {
                  setSearch("");
                  setFilterSource("all");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-red-700 hover:text-red-700 hover:bg-red-900/20 h-9"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            Total: {inspections.length}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-medium">Car</TableHead>
                  <TableHead className="text-foreground font-medium">Plate #</TableHead>
                  <TableHead className="text-foreground font-medium">Reservation #</TableHead>
                  <TableHead className="text-foreground font-medium">Source</TableHead>
                  <TableHead className="text-foreground font-medium">Assigned To</TableHead>
                  <TableHead className="text-foreground font-medium">Status</TableHead>
                  <TableHead className="text-foreground font-medium">Inspection Date</TableHead>
                  <TableHead className="text-foreground font-medium">Notes</TableHead>
                  <TableHead className="text-foreground font-medium">Photos</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : inspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No resolved inspections yet</TableCell>
                  </TableRow>
                ) : (
                  pagedInspections.map((insp) => {
                    const trip = insp.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;
                    return (
                    <TableRow key={insp.id} className="border-border hover:bg-card/50 transition-colors">
                      <TableCell className="text-foreground">{carNameWithYear(insp.car_name, trip?.plateNumber)}</TableCell>
                      <TableCell className="text-foreground font-mono text-sm">{trip?.plateNumber || "--"}</TableCell>
                      <TableCell className="text-foreground font-mono text-sm">{insp.reservation_id || "--"}</TableCell>
                      <TableCell className="text-muted-foreground capitalize text-sm">{insp.source?.replace(/_/g, " ") || "--"}</TableCell>
                      <TableCell className="text-foreground">{insp.assigned_to}</TableCell>
                      <TableCell><StatusBadge status={insp.status} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(insp.inspection_date)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate" title={insp.notes || undefined}>{insp.notes || "--"}</TableCell>
                      <TableCell>
                        {insp.photos && insp.photos.length > 0 ? (
                          <PhotoUpload photos={insp.photos} onPhotosChange={() => {}} entityType="inspection" entityId={insp.id} disabled />
                        ) : (
                          <span className="text-muted-foreground text-sm">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => reopenMutation.mutate(insp.id)}
                            className="text-muted-foreground hover:text-yellow-500 h-8 px-2"
                            title="Reopen inspection"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
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
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
