/**
 * Admin HR – Time Off (Leave). List, approve / decline employee leave requests.
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TreePalm,
  X,
} from "lucide-react";
import { useState } from "react";

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

interface LeaveRow {
  leave_aid: number;
  leave_employee_id: number;
  leave_is_status: number;
  leave_date: string;
  leave_type: string;
  leave_amount: string;
  leave_hour: string | number;
  leave_minute: string | number;
  leave_remarks: string;
  fullname: string;
}

function LeaveStatusBadge({ status }: { status: number }) {
  if (status === 1)
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
        Approved
      </Badge>
    );
  if (status === 2)
    return <Badge variant="destructive">Declined</Badge>;
  return (
    <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700 dark:text-amber-400">
      Pending
    </Badge>
  );
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function toTitleCase(s: string) {
  if (!s) return "—";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminHrTimeOff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmDecline, setConfirmDecline] = useState<LeaveRow | null>(null);

  const offset = (page - 1) * pageSize;
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  if (statusFilter !== "all") params.set("status", statusFilter);
  params.set("limit", String(pageSize));
  params.set("offset", String(offset));

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: LeaveRow[];
    total: number;
  }>({
    queryKey: ["/api/admin/hr/leave", search, fromDate, toDate, statusFilter, page, pageSize],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/leave?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: number }) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/leave/${id}/status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leave_is_status: status }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/leave"] });
      setConfirmDecline(null);
      toast({
        title: status === 1 ? "Request approved" : "Request declined",
        description:
          status === 1
            ? "Work schedule updated with a Day Off entry."
            : "The leave request has been declined.",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update",
        variant: "destructive",
      });
    },
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeFrom = total === 0 ? 0 : offset + 1;
  const rangeTo = Math.min(offset + pageSize, total);
  const pendingCount = rows.filter((r) => r.leave_is_status === 0).length;
  const hasActiveFilters =
    search.trim() || fromDate || toDate || statusFilter !== "all";

  function resetFilters() {
    setSearch("");
    setFromDate("");
    setToDate("");
    setStatusFilter("all");
    setPage(1);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <TreePalm className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-primary">Time Off</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Review and manage employee leave requests.
              </p>
            </div>
          </div>
          {pendingCount > 0 && !isLoading && (
            <Badge className="bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1 text-sm dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
              {pendingCount} pending on this page
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Search employee
                </Label>
                <Input
                  placeholder="Name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  From
                </Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-40 h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  To
                </Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-40 h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Status
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="0">Pending</SelectItem>
                    <SelectItem value="1">Approved</SelectItem>
                    <SelectItem value="2">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
                <TreePalm className="w-10 h-10 opacity-25" />
                <p className="text-sm">No leave records found.</p>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="text-primary underline-offset-4 hover:underline">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.leave_aid}>
                        <TableCell className="font-medium">
                          {r.fullname ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {r.leave_date ? formatDate(r.leave_date) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {toTitleCase(r.leave_type)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {r.leave_hour || r.leave_minute
                            ? `${r.leave_hour}h ${r.leave_minute}m`
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {r.leave_remarks || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <LeaveStatusBadge status={r.leave_is_status} />
                        </TableCell>
                        <TableCell>
                          {r.leave_is_status === 0 && (
                            <div className="flex justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/40"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: r.leave_aid,
                                    status: 1,
                                  })
                                }
                                disabled={updateStatusMutation.isPending}
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setConfirmDecline(r)}
                                disabled={updateStatusMutation.isPending}
                                title="Decline"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PER_PAGE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {total > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {rangeFrom}–{rangeTo} of {total} records
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Decline confirmation dialog */}
      {confirmDecline && (
        <Dialog open onOpenChange={() => setConfirmDecline(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Decline this request?</DialogTitle>
              <DialogDescription>
                <strong>{confirmDecline.fullname}</strong>'s leave request on{" "}
                <strong>{formatDate(confirmDecline.leave_date)}</strong> will be
                marked as Declined.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDecline(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: confirmDecline.leave_aid,
                    status: 2,
                  })
                }
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                )}
                Decline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}
