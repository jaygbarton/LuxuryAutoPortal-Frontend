import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { buildApiUrl } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, MessageCircle, Info, Loader2, Search } from "lucide-react";
import { useCallback, useState } from "react";

interface TaskItem {
  task_timer_aid?: string;
  task_timer_date_start?: string;
  task_timer_date_end?: string;
  task_timer_emp_list?: string;
  task_timer_name?: string;
  task_timer_car_name?: string;
  task_timer_status?: number;
  task_timer_description?: string;
  task_timer_photos?: string;
  task_timer_other_not_related_car?: string;
}

function formatDate(dateStr: string | undefined, fallback = "--") {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
  } catch {
    return fallback;
  }
}

function parseEmpList(json: string | undefined): { fullname: string }[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function TaskStatusBadge({ status }: { status?: number }) {
  const s = Number(status);
  if (s === 3)
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Completed
      </span>
    );
  if (s === 2)
    return (
      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
        On Hold
      </span>
    );
  if (s === 1)
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
        In Progress
      </span>
    );
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      New
    </span>
  );
}

export default function StaffTaskManagement() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [viewItem, setViewItem] = useState<TaskItem | null>(null);
  const [commentItem, setCommentItem] = useState<TaskItem | null>(null);

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set("status", statusFilter);
  if (fromDate) queryParams.set("fromDate", fromDate);
  if (toDate) queryParams.set("toDate", toDate);
  if (searchValue) queryParams.set("search", searchValue);
  const queryString = queryParams.toString();
  const listUrl = `/api/staff/task-management?${queryString}`;

  const { data, isLoading, isError, refetch } = useQuery<{
    success?: boolean;
    data?: TaskItem[];
    total?: number;
  }>({
    queryKey: ["staff-task-management", listUrl],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(listUrl), { credentials: "include" });
      if (res.status === 404 || res.status === 501)
        return { success: true, data: [], total: 0 };
      if (!res.ok) throw new Error("Failed to load tasks");
      return res.json();
    },
    retry: false,
  });

  const tasks: TaskItem[] = data?.data ?? [];
  const total = data?.total ?? tasks.length;
  const hasFilters = !!statusFilter || !!fromDate || !!toDate;

  const clearFilters = useCallback(() => {
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setSearchValue("");
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">
            Task Management
          </h1>
          <p className="text-muted-foreground">
            View and manage your assigned tasks.
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Briefcase className="w-5 h-5" />
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Status</label>
                <Select
                  value={statusFilter || "all"}
                  onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="0">New</SelectItem>
                    <SelectItem value="1">In Progress</SelectItem>
                    <SelectItem value="2">On Hold</SelectItem>
                    <SelectItem value="3">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="pl-8"
                />
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                {isLoading ? "..." : total} task{total !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="rounded-md border border-border overflow-auto max-h-[60vh]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : isError ? (
                <div className="py-12 text-center text-muted-foreground">
                  Unable to load tasks. Please try again later.
                </div>
              ) : tasks.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No tasks found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Task Name</TableHead>
                      <TableHead>Car</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((item, idx) => (
                      <TableRow key={item.task_timer_aid ?? idx}>
                        <TableCell>{idx + 1}.</TableCell>
                        <TableCell>
                          {formatDate(item.task_timer_date_start)} to{" "}
                          {formatDate(item.task_timer_date_end)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {parseEmpList(item.task_timer_emp_list)
                            .map((e) => e.fullname)
                            .join(", ") || "--"}
                        </TableCell>
                        <TableCell>{item.task_timer_name ?? "--"}</TableCell>
                        <TableCell>
                          {item.task_timer_car_name ?? "--"}
                        </TableCell>
                        <TableCell className="text-center">
                          <TaskStatusBadge status={item.task_timer_status} />
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {item.task_timer_description ?? "--"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Comment"
                              onClick={() => setCommentItem(item)}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="View details"
                              onClick={() => setViewItem(item)}
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View details modal */}
      <Dialog
        open={!!viewItem}
        onOpenChange={(open) => !open && setViewItem(null)}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Task details</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Date range:</span>{" "}
                {formatDate(viewItem.task_timer_date_start)} to{" "}
                {formatDate(viewItem.task_timer_date_end)}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                <TaskStatusBadge status={viewItem.task_timer_status} />
              </p>
              <p>
                <span className="font-medium">Car:</span>{" "}
                {viewItem.task_timer_car_name ?? "--"}
              </p>
              <p>
                <span className="font-medium">Task name:</span>{" "}
                {viewItem.task_timer_name ?? "--"}
              </p>
              <p>
                <span className="font-medium">Assign to:</span>{" "}
                {parseEmpList(viewItem.task_timer_emp_list)
                  .map((e) => e.fullname)
                  .join(", ") || "--"}
              </p>
              <p>
                <span className="font-medium">Description:</span>{" "}
                {viewItem.task_timer_description ?? "--"}
              </p>
              {viewItem.task_timer_other_not_related_car && (
                <p>
                  <span className="font-medium">Other:</span>{" "}
                  {viewItem.task_timer_other_not_related_car}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Comment modal */}
      <Dialog
        open={!!commentItem}
        onOpenChange={(open) => !open && setCommentItem(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          {commentItem && (
            <p className="text-sm text-muted-foreground">
              Task: {commentItem.task_timer_name ?? "--"}. Comment feature can
              be wired to the backend when available.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
