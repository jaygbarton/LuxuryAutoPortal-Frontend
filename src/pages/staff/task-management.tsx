import { optionKeywords } from "@/lib/select-search";
import { AdminLayout } from "@/components/admin/admin-layout";
import { EmployeePageLinks } from "@/components/staff/EmployeePageLinks";
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
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, ChevronDown, MessageCircle, Info, Loader2, Search } from "lucide-react";
import { useCallback, useId, useState } from "react";
import TaskCommentsDialog from "@/components/tasks/TaskCommentsDialog";

interface TaskItem {
  task_timer_aid?: number | string;
  task_timer_date_start?: string;
  task_timer_date_end?: string;
  /** Optional due time, "HH:mm" wall-clock (no timezone conversion needed). */
  task_timer_start_time?: string;
  task_timer_emp_list?: string;
  task_timer_emp_id?: string;
  task_timer_name?: string;
  task_timer_car_name?: string;
  task_timer_status?: number;
  task_timer_description?: string;
  task_timer_photos?: string;
  task_timer_other_not_related_car?: string;
  /** Free-text "assigned by" / creator name. Reused from the admin form. */
  task_timer_goal?: string;
  /** DATETIME when the row was first inserted; used for the "Task Created" column. */
  task_timer_created?: string;
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

// task_timer_start_time is a plain "HH:mm" wall-clock string, not a stored
// UTC value — no timezone conversion needed, unlike formatDate above.
function formatDueTime12h(s: string | undefined): string | null {
  if (!s) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = match[2];
  if (Number.isNaN(hour24) || hour24 < 0 || hour24 > 23) return null;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

function formatDueDateTime(dateStr: string | undefined, timeStr: string | undefined, fallback = "--") {
  const datePart = formatDate(dateStr, "");
  if (!datePart) return fallback;
  const timePart = formatDueTime12h(timeStr);
  return timePart ? `${datePart} ${timePart}` : datePart;
}

/**
 * The admin form stores assignees as JSON objects like {id, name}. The previous
 * parseEmpList only pulled `fullname`, which is why this dashboard showed "—"
 * for everything created through the admin Edit Task modal. Pick whichever
 * shape is present so both legacy and current rows render correctly.
 */
function getAssignedToDisplay(json: string | undefined): string {
  if (!json) return "—";
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return json.trim() || "—";
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return "—";
  const names = (parsed as unknown[])
    .map((x) => {
      if (x == null) return "";
      if (typeof x === "string" || typeof x === "number") return String(x);
      if (typeof x === "object") {
        const o = x as Record<string, unknown>;
        return String(
          o.name ?? o.fullname ?? o.label ?? o.email ?? o.id ?? "",
        );
      }
      return "";
    })
    .map((s) => s.trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "—";
}

function parseTaskPhotos(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

const STATUS_OPTIONS: { value: string; label: string; className: string }[] = [
  { value: "0", label: "New", className: "bg-gray-100 text-gray-700" },
  { value: "1", label: "In Progress", className: "bg-blue-100 text-blue-800" },
  { value: "2", label: "On Hold", className: "bg-yellow-100 text-yellow-800" },
  { value: "3", label: "Completed", className: "bg-green-100 text-green-800" },
];

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [viewItem, setViewItem] = useState<TaskItem | null>(null);
  const [commentItem, setCommentItem] = useState<TaskItem | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const taskActionsId = useId();

  const updateStatus = useMutation({
    mutationFn: async (vars: { id: number; status: number }) => {
      const r = await fetch(
        buildApiUrl(`/api/staff/task-management/${vars.id}/status`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_timer_status: vars.status }),
        },
      );
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-task-management"] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => {
      toast({
        title: "Could not update status",
        description: e?.message ?? "",
        variant: "destructive",
      });
    },
  });

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
  const hasFilters = !!statusFilter || !!fromDate || !!toDate || !!searchValue;

  const clearFilters = useCallback(() => {
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setSearchValue("");
  }, []);

  return (
    <AdminLayout>
      <div className="staff-page min-w-0 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Task Management
          </h1>
          <p className="text-muted-foreground">
            View and manage your assigned tasks.
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <Briefcase className="w-5 h-5" />
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:flex lg:flex-wrap lg:items-center">
              <div className="col-span-2 flex flex-col gap-1 sm:col-span-1 sm:flex-row sm:items-center sm:gap-2">
                <label className="text-sm text-muted-foreground">Status</label>
                <Select
                  value={statusFilter || "all"}
                  onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-full sm:w-[120px]">
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
              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Due From</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full sm:w-[140px]"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Due To</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full sm:w-[140px]"
                />
              </div>
              <div className="relative col-span-full sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[180px] lg:max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="pl-8 w-full"
                />
              </div>
              <div className="col-span-full flex items-center justify-between gap-2 lg:col-span-1 lg:w-auto">
                {hasFilters ? (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <span />
                )}
                <span className="text-sm text-muted-foreground">
                  {isLoading ? "..." : total} task{total !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {!isLoading && !isError && tasks.length > 0 && (
              <div className="divide-y divide-border rounded-xl border border-border sm:hidden" data-staff-task-list>
                {tasks.map((item, idx) => {
                  const photos = parseTaskPhotos(item.task_timer_photos);
                  const taskKey = String(item.task_timer_aid ?? `row-${idx}`);
                  const expanded = expandedTaskIds.has(taskKey);
                  const actionsId = `${taskActionsId}-${taskKey}`;
                  return (
                    <article key={taskKey} className="min-w-0">
                      <button
                        type="button"
                        aria-label={`Task: ${item.task_timer_name || "Untitled task"}`}
                        aria-expanded={expanded}
                        aria-controls={actionsId}
                        className="flex min-h-11 w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                        onClick={() => setExpandedTaskIds(current => {
                          const next = new Set(current);
                          if (next.has(taskKey)) next.delete(taskKey); else next.add(taskKey);
                          return next;
                        })}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-semibold">{item.task_timer_name || "Untitled task"}</span>
                          {item.task_timer_car_name && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{item.task_timer_car_name}</span>}
                          <span className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">Due {formatDueDateTime(item.task_timer_date_end, item.task_timer_start_time)}</span>
                            <TaskStatusBadge status={item.task_timer_status} />
                          </span>
                        </span>
                        <ChevronDown aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                      <div id={actionsId} hidden={!expanded} className="border-t border-border px-3 pb-3 pt-2">
                      <p className="break-words text-xs text-muted-foreground">Assigned to {getAssignedToDisplay(item.task_timer_emp_list)}</p>
                      <div className="mt-3 flex items-center gap-2">
                        {item.task_timer_aid != null ? (
                          <Select value={String(Number(item.task_timer_status ?? 0))} onValueChange={(v) => updateStatus.mutate({ id: Number(item.task_timer_aid), status: Number(v) })} disabled={updateStatus.isPending}>
                            <SelectTrigger aria-label={`Status for ${item.task_timer_name || "task"}`} className="h-11 min-w-0 flex-1 text-base"><SelectValue /></SelectTrigger>
                            <SelectContent>{STATUS_OPTIONS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : <TaskStatusBadge status={item.task_timer_status} />}
                        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label={`Comments for ${item.task_timer_name || "task"}`} onClick={() => setCommentItem(item)}><MessageCircle className="h-4 w-4" /></Button>
                        <Button variant="outline" className="h-11 shrink-0 px-3" onClick={() => setViewItem(item)}>Details</Button>
                      </div>
                      {photos.length > 0 && <Button variant="ghost" className="mt-1 min-h-11 px-0 text-sm" onClick={() => { setLightboxPhotos(photos); setLightboxIndex(0); }}>View {photos.length} photo{photos.length !== 1 ? "s" : ""}</Button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <div className={`rounded-md border border-border overflow-auto max-h-[60vh] ${!isLoading && !isError && tasks.length > 0 ? "hidden sm:block" : ""}`}>
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
                      <TableHead className="whitespace-nowrap">Task Created</TableHead>
                      <TableHead>Task Name</TableHead>
                      <TableHead>Assigned By</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead className="whitespace-nowrap">Due Date</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Photos</TableHead>
                      <TableHead className="w-20 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((item, idx) => {
                      const photoPaths = parseTaskPhotos(item.task_timer_photos);
                      return (
                        <TableRow key={item.task_timer_aid ?? idx}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {item.task_timer_created
                              ? new Date(item.task_timer_created).toLocaleDateString(
                                  "en-US",
                                  { year: "numeric", month: "2-digit", day: "2-digit" },
                                )
                              : "--"}
                          </TableCell>
                          <TableCell>{item.task_timer_name ?? "--"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.task_timer_goal?.trim() || "--"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {getAssignedToDisplay(item.task_timer_emp_list)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDueDateTime(item.task_timer_date_end, item.task_timer_start_time)}
                          </TableCell>
                          <TableCell className="text-center">
                            {/* Employees can change the status of tasks they
                                own — the backend authorizes that the caller is
                                actually on the task's emp_list before writing. */}
                            {item.task_timer_aid != null ? (
                              <Select
                                value={String(Number(item.task_timer_status ?? 0))}
                                onValueChange={(v) =>
                                  updateStatus.mutate({
                                    id: Number(item.task_timer_aid),
                                    status: Number(v),
                                  })
                                }
                                disabled={updateStatus.isPending}
                              >
                                <SelectTrigger
                                  className={`mx-auto h-8 w-[140px] text-xs ${
                                    STATUS_OPTIONS.find(
                                      (s) =>
                                        s.value ===
                                        String(Number(item.task_timer_status ?? 0)),
                                    )?.className ?? ""
                                  }`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((s) => (
                                    <SelectItem searchKeywords={optionKeywords(s)} key={s.value} value={s.value}>
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <TaskStatusBadge status={item.task_timer_status} />
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {item.task_timer_description ?? "--"}
                          </TableCell>
                          <TableCell>
                            {photoPaths.length === 0 ? (
                              <span className="text-muted-foreground text-xs">--</span>
                            ) : (
                              <div className="flex items-center gap-1 flex-wrap">
                                {photoPaths.slice(0, 3).map((src, i) => (
                                  <button
                                    key={src}
                                    type="button"
                                    onClick={() => {
                                      setLightboxPhotos(photoPaths);
                                      setLightboxIndex(i);
                                    }}
                                    className="focus:outline-none"
                                    title="View photo"
                                  >
                                    <img
                                      src={getProxiedImageUrl(src)}
                                      alt={`Photo ${i + 1}`}
                                      className="w-10 h-10 object-cover rounded border border-border hover:opacity-80 transition-opacity"
                                    />
                                  </button>
                                ))}
                                {photoPaths.length > 3 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLightboxPhotos(photoPaths);
                                      setLightboxIndex(3);
                                    }}
                                    className="w-10 h-10 rounded border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground hover:bg-muted/80 transition-colors"
                                  >
                                    +{photoPaths.length - 3}
                                  </button>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Comments"
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
                      );
                    })}
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
                {formatDueDateTime(viewItem.task_timer_date_end, viewItem.task_timer_start_time)}
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
              <p><span className="font-medium">Assigned by:</span> {viewItem.task_timer_goal?.trim() || "--"}</p>
              <p><span className="font-medium">Created:</span> {formatDate(viewItem.task_timer_created)}</p>
              <p>
                <span className="font-medium">Assign to:</span>{" "}
                {getAssignedToDisplay(viewItem.task_timer_emp_list)}
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
          <Button variant="outline" className="min-h-11 w-full" onClick={() => setViewItem(null)}>Close</Button>
        </DialogContent>
      </Dialog>

      {/* Comments thread */}
      <TaskCommentsDialog
        taskId={
          commentItem?.task_timer_aid != null
            ? Number(commentItem.task_timer_aid)
            : null
        }
        taskName={commentItem?.task_timer_name}
        onClose={() => setCommentItem(null)}
      />
      {/* Photo lightbox */}
      {lightboxPhotos.length > 0 && (
        <Dialog open onOpenChange={() => setLightboxPhotos([])}>
          <DialogContent className="max-w-3xl p-2 bg-black/95 border-none">
            <DialogHeader className="sr-only">
              <DialogTitle>Photo viewer</DialogTitle>
            </DialogHeader>
            <div className="relative flex min-h-[240px] items-center justify-center sm:min-h-[400px]">
              <img
                src={getProxiedImageUrl(lightboxPhotos[lightboxIndex])}
                alt={`Photo ${lightboxIndex + 1} of ${lightboxPhotos.length}`}
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
              {lightboxPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex(
                        (i) =>
                          (i - 1 + lightboxPhotos.length) % lightboxPhotos.length,
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full w-11 h-11 flex items-center justify-center text-lg transition-colors"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((i) => (i + 1) % lightboxPhotos.length)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full w-11 h-11 flex items-center justify-center text-lg transition-colors"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            <div className="text-center text-xs text-white/60 pb-1">
              {lightboxIndex + 1} / {lightboxPhotos.length}
            </div>
          </DialogContent>
        </Dialog>
      )}
      <EmployeePageLinks />
    </AdminLayout>
  );
}
