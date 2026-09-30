import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import { operationLocationMatches, useOperationLocationFilter } from "./OperationLocationFilter";
import { CarPhotoCell } from "@/components/admin/dashboard/CarPhotoCell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CarBlockOff {
  id: number;
  car_id: number | null;
  /** Joined from the `car` table via car_id; null when unlinked. */
  car_photo?: string | null;
  /** Joined from the `car` table so SLC/Wilmington filters do not hide NA-location block-offs. */
  location_tag?: string | null;
  car_name: string;
  plate_number: string | null;
  owner_name: string;
  reason: "personal_use" | "maintenance" | "others";
  reason_other: string | null;
  pickup_date: string;
  block_off_end_date: string | null;
  pickup_location: string;
  pickup_submitted_at: string | null;
  dropoff_date: string | null;
  dropoff_location: string | null;
  dropoff_submitted_at: string | null;
  assigned_to: string | null;
  assigned_to_id: number | null;
  delivery_assigned_to: string | null;
  delivery_assigned_to_id: number | null;
  retrieval_assigned_to: string | null;
  retrieval_assigned_to_id: number | null;
  status: "new" | "car_not_available" | "car_blocked_off" | "update_requested";
  notes: string | null;
  created_at: string;
}

interface SubmissionsResponse {
  success: boolean;
  data: CarBlockOff[];
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "new", label: "New", className: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "car_blocked_off", label: "Car Blocked Off", className: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "car_not_available", label: "Car Not Available", className: "bg-red-100 text-red-700 border-red-200" },
  { value: "update_requested", label: "Update Requested", className: "bg-blue-100 text-blue-700 border-blue-200" },
];

const REASON_LABELS: Record<string, string> = {
  personal_use: "Personal Use",
  maintenance: "Maintenance",
  others: "Others",
};

function statusMeta(v: string) {
  return STATUS_OPTIONS.find((s) => s.value === v) ?? STATUS_OPTIONS[0];
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  try {
    // DB stores datetime-local value as-is (Mountain time) — parse without UTC conversion
    const normalized = String(v).replace(" ", "T").replace(/Z$/, "");
    const d = new Date(normalized);
    return d.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
}


const PAGE_SIZE_KEY = "operations.carBlockOff.pageSize";
const SHOW_ALL_KEY = "operations.carBlockOff.showAll";

// ── Tab component ─────────────────────────────────────────────────────────────

export function CarBlockOffTab() {
  const locationFilter = useOperationLocationFilter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pickupFrom, setPickupFrom] = useState("");
  const [pickupTo, setPickupTo] = useState("");
  const [endFrom, setEndFrom] = useState("");
  const [endTo, setEndTo] = useState("");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState<boolean>(() => {
    try { return localStorage.getItem(SHOW_ALL_KEY) === "true"; } catch { return false; }
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const limit = (() => {
    try { return Number(localStorage.getItem(PAGE_SIZE_KEY)) || 20; } catch { return 20; }
  })();

  const { data, isLoading } = useQuery<SubmissionsResponse>({
    queryKey: [
      "/api/car-block-off/submissions",
      search,
      statusFilter,
      pickupFrom,
      pickupTo,
      endFrom,
      endTo,
      page,
      limit,
      showAll,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        page: String(page),
        limit: String(limit),
        all: String(showAll),
        pickupFrom,
        pickupTo,
        endFrom,
        endTo,
      });
      return api.get(`/api/car-block-off/submissions?${params}`, {
        fallbackMessage: "Failed to fetch",
      });
    },
    staleTime: 30_000,
  });

  const records = (data?.data ?? []).filter((record) =>
    operationLocationMatches(locationFilter, [
      record.location_tag,
      record.pickup_location,
      record.dropoff_location,
      record.car_name,
      record.plate_number,
    ]),
  );
  const total = data?.total ?? 0;
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(total / limit));

  // Inline status update
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(buildApiUrl(`/api/car-block-off/submissions/${id}/status`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || `HTTP ${res.status}`);
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/car-block-off/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/car-block-off/submissions", "dashboard"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Assignment update
  const assignMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: number; fields: Record<string, any> }) => {
      const res = await fetch(buildApiUrl(`/api/car-block-off/submissions/${id}/assignment`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || `HTTP ${res.status}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/car-block-off/submissions"] }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/car-block-off/submissions/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || "Failed to delete");
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Record deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/car-block-off/submissions"] });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDeleteId(null);
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search car, owner, location..."
            className="pl-9 bg-card border-border text-foreground w-64"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="bg-card border-border text-foreground w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Date ranges are applied by the API before pagination. */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Pick Up</span>
          <Input type="date" value={pickupFrom} onChange={(e) => { setPickupFrom(e.target.value); setPage(1); }}
            className="bg-card border-border text-foreground h-9 w-[9.5rem]" aria-label="Pick Up date from" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={pickupTo} min={pickupFrom || undefined} onChange={(e) => { setPickupTo(e.target.value); setPage(1); }}
            className="bg-card border-border text-foreground h-9 w-[9.5rem]" aria-label="Pick Up date to" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Block Off End</span>
          <Input type="date" value={endFrom} onChange={(e) => { setEndFrom(e.target.value); setPage(1); }}
            className="bg-card border-border text-foreground h-9 w-[9.5rem]" aria-label="Block Off End date from" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={endTo} min={endFrom || undefined} onChange={(e) => { setEndTo(e.target.value); setPage(1); }}
            className="bg-card border-border text-foreground h-9 w-[9.5rem]" aria-label="Block Off End date to" />
        </div>
        {(pickupFrom || pickupTo || endFrom || endTo) && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground"
            onClick={() => { setPickupFrom(""); setPickupTo(""); setEndFrom(""); setEndTo(""); setPage(1); }}>
            Clear dates
          </Button>
        )}
        {total > 0 && (
          <span className="text-sm text-muted-foreground">
            {records.length === total ? `${total} record${total !== 1 ? "s" : ""}` : `${records.length} of ${total} records`}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {[
                "Photo", "Car Name", "Plate #", "Owner", "Reason",
                "Pick Up Date", "Block Off End", "Pick Up Location",
                "Drop Off Location",
                "Assigned To", "Pick Up Assigned To", "Drop Off Assigned To",
                "Status", "Actions"
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">No records found.</td></tr>
            ) : records.map((r) => {
              const sm = statusMeta(r.status);
              return (
                <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  {/* Photo */}
                  <td className="px-3 py-2">
                    <CarPhotoCell carPhoto={r.car_photo} carName={r.car_name} />
                  </td>
                  {/* Car Name */}
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-foreground">{r.car_name}</td>
                  {/* Plate */}
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground text-xs">{r.plate_number ?? "—"}</td>
                  {/* Owner */}
                  <td className="px-3 py-2 whitespace-nowrap text-foreground">{r.owner_name}</td>
                  {/* Reason */}
                  <td className="px-3 py-2 whitespace-nowrap text-foreground">
                    {REASON_LABELS[r.reason] ?? r.reason}
                    {r.reason === "others" && r.reason_other && (
                      <div className="text-xs text-muted-foreground truncate max-w-[120px]">{r.reason_other}</div>
                    )}
                  </td>
                  {/* Pick Up Date */}
                  <td className="px-3 py-2 whitespace-nowrap text-foreground text-xs">{fmtDateTime(r.pickup_date)}</td>
                  {/* Block Off End */}
                  <td className="px-3 py-2 whitespace-nowrap text-foreground text-xs">{r.block_off_end_date ? fmtDateTime(r.block_off_end_date) : "—"}</td>
                  {/* Pick Up Location */}
                  <td className="px-3 py-2 text-foreground max-w-[160px] truncate">{r.pickup_location}</td>
                  {/* Drop Off Location */}
                  <td className="px-3 py-2 text-foreground max-w-[160px] truncate">{r.dropoff_location ?? "—"}</td>

                  {/* Assigned To */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <EmployeeSelectCombobox
                      value={r.assigned_to ?? ""}
                      onChange={() => {}}
                      onSelectEmployee={(emp) => {
                        if (!emp) return;
                        const fullName = `${emp.employee_first_name ?? ""} ${emp.employee_last_name ?? ""}`.trim();
                        assignMutation.mutate({
                          id: r.id,
                          fields: { assigned_to: fullName, assigned_to_id: emp.employee_aid },
                        });
                      }}
                      placeholder="Assign..."
                    />
                  </td>

                  {/* Delivery Assigned To */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <EmployeeSelectCombobox
                      value={r.delivery_assigned_to ?? ""}
                      onChange={() => {}}
                      onSelectEmployee={(emp) => {
                        if (!emp) return;
                        const fullName = `${emp.employee_first_name ?? ""} ${emp.employee_last_name ?? ""}`.trim();
                        assignMutation.mutate({
                          id: r.id,
                          fields: { delivery_assigned_to: fullName, delivery_assigned_to_id: emp.employee_aid },
                        });
                      }}
                      placeholder="Pick up assigned..."
                    />
                  </td>

                  {/* Retrieval Assigned To */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <EmployeeSelectCombobox
                      value={r.retrieval_assigned_to ?? ""}
                      onChange={() => {}}
                      onSelectEmployee={(emp) => {
                        if (!emp) return;
                        const fullName = `${emp.employee_first_name ?? ""} ${emp.employee_last_name ?? ""}`.trim();
                        assignMutation.mutate({
                          id: r.id,
                          fields: { retrieval_assigned_to: fullName, retrieval_assigned_to_id: emp.employee_aid },
                        });
                      }}
                      placeholder="Drop off assigned..."
                    />
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Select
                      value={r.status}
                      onValueChange={(v) => statusMutation.mutate({ id: r.id, status: v })}
                    >
                      <SelectTrigger className="h-7 text-xs border-border bg-card w-44">
                        <Badge variant="outline" className={`text-xs ${sm.className}`}>{sm.label}</Badge>
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            <Badge variant="outline" className={`text-xs ${s.className}`}>{s.label}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteId(r.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination and Show All */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {showAll
                ? `Showing all ${records.length}${records.length !== total ? ` of ${total}` : ""} submissions`
                : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}
            </span>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={showAll}
                disabled={isLoading}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowAll(checked);
                  setPage(1);
                  try { localStorage.setItem(SHOW_ALL_KEY, String(checked)); } catch {}
                }}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Show all results
            </label>
          </div>
          {!showAll && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-foreground px-2">Page {page} of {totalPages}</span>
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this block-off record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
