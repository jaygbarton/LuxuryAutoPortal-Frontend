/**
 * Staff – Time Off. Submit and track personal leave requests.
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  TreePalm,
} from "lucide-react";
import { useState } from "react";

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

interface LeaveItem {
  leave_aid?: string | number;
  leave_is_status?: number;
  leave_date?: string;
  leave_type?: string;
  leave_hour?: number;
  leave_minute?: number;
  leave_amount?: number;
  leave_remarks?: string;
}

function LeaveStatusBadge({ status }: { status?: number }) {
  const s = Number(status);
  if (s === 1)
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
        Approved
      </Badge>
    );
  if (s === 2) return <Badge variant="secondary">Cancelled</Badge>;
  if (s === 3) return <Badge variant="destructive">Declined</Badge>;
  return (
    <Badge
      variant="outline"
      className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
    >
      Pending
    </Badge>
  );
}

function formatDate(d: string | undefined, fallback = "--") {
  if (!d) return fallback;
  try {
    const x = new Date(d);
    return isNaN(x.getTime())
      ? fallback
      : x.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
  } catch {
    return fallback;
  }
}

function toTitleCase(s: string | undefined) {
  if (!s) return "--";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StaffTimeOff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [applyOpen, setApplyOpen] = useState(false);
  const [formDate, setFormDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [formType, setFormType] = useState("paid time off");
  const [formRemarks, setFormRemarks] = useState("");

  const offset = (page - 1) * pageSize;
  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  params.set("limit", String(pageSize));
  params.set("offset", String(offset));

  const { data, isLoading } = useQuery<{
    success?: boolean;
    data?: LeaveItem[];
    total?: number;
  }>({
    queryKey: ["staff-leave", statusFilter, fromDate, toDate, page, pageSize],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/staff/leave?${params}`), {
        credentials: "include",
      });
      if (res.status === 404 || res.status === 501)
        return { success: true, data: [], total: 0 };
      if (!res.ok) throw new Error("Failed to load leave");
      return res.json();
    },
    retry: false,
  });

  // Summary counts (all statuses, no pagination — separate lightweight query)
  const { data: summaryData } = useQuery<{
    success?: boolean;
    data?: LeaveItem[];
    total?: number;
  }>({
    queryKey: ["staff-leave-summary"],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/staff/leave?limit=200&offset=0`),
        { credentials: "include" }
      );
      if (res.status === 404 || res.status === 501)
        return { success: true, data: [], total: 0 };
      if (!res.ok) return { success: true, data: [], total: 0 };
      return res.json();
    },
    retry: false,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      leave_date: string;
      leave_type: string;
      leave_hour: string;
      leave_minute: string;
      leave_remarks: string;
    }) => {
      const res = await fetch(buildApiUrl("/api/staff/leave"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-leave"] });
      closeForm();
      toast({ title: "Request submitted", description: "Your leave request is pending approval." });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit",
        variant: "destructive",
      });
    },
  });

  function closeForm() {
    setApplyOpen(false);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormType("paid time off");
    setFormRemarks("");
  }

  function handleApply() {
    createMutation.mutate({
      leave_date: formDate,
      leave_type: formType,
      leave_hour: "8",
      leave_minute: "0",
      leave_remarks: formRemarks,
    });
  }

  const rows: LeaveItem[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeFrom = total === 0 ? 0 : offset + 1;
  const rangeTo = Math.min(offset + pageSize, total);

  const allRows: LeaveItem[] = summaryData?.data ?? [];
  const pendingCount = allRows.filter((r) => r.leave_is_status === 0).length;
  const approvedCount = allRows.filter((r) => r.leave_is_status === 1).length;
  const totalCount = summaryData?.total ?? allRows.length;

  const hasActiveFilters = statusFilter !== "all" || fromDate || toDate;

  function resetFilters() {
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
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
              <h1 className="text-2xl font-semibold text-foreground">
                Time Off
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Request and track your leave.
              </p>
            </div>
          </div>
          <Button onClick={() => setApplyOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Apply
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={CalendarCheck}
            label="Total requests"
            value={totalCount}
            color="bg-primary/10 text-primary"
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={pendingCount}
            color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          />
          <StatCard
            icon={TreePalm}
            label="Approved"
            value={approvedCount}
            color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          />
        </div>

        {/* Leave requests table */}
        <Card>
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">
                Leave requests
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[120px] h-8 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="0">Pending</SelectItem>
                    <SelectItem value="1">Approved</SelectItem>
                    <SelectItem value="3">Declined</SelectItem>
                    <SelectItem value="2">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-[140px] h-8 text-sm"
                />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-[140px] h-8 text-sm"
                />
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-8 text-muted-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
                <TreePalm className="w-10 h-10 opacity-25" />
                <p className="text-sm">No leave requests found.</p>
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
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((item, idx) => (
                      <TableRow key={item.leave_aid ?? idx}>
                        <TableCell className="text-muted-foreground text-sm">
                          {offset + idx + 1}.
                        </TableCell>
                        <TableCell>
                          <LeaveStatusBadge status={item.leave_is_status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(item.leave_date)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {toTitleCase(item.leave_type)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {item.leave_hour != null
                            ? `${item.leave_hour}h ${item.leave_minute ?? 0}m`
                            : "--"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {item.leave_amount != null
                            ? `$${Number(item.leave_amount).toFixed(2)}`
                            : "--"}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {item.leave_remarks ?? "--"}
                          </span>
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
                        {rangeFrom}–{rangeTo} of {total} requests
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

      {/* Apply form dialog */}
      <Dialog open={applyOpen} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TreePalm className="w-5 h-5 text-primary" />
              Apply for time off
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Day off</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid time off">Paid Time Off</SelectItem>
                  <SelectItem value="sick time off">Sick Time Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={formRemarks}
                onChange={(e) => setFormRemarks(e.target.value)}
                className="mt-1.5 min-h-[80px] resize-none"
                placeholder="Optional – reason for time off"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                )}
                Submit request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
