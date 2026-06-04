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
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
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
  car_name: string;
  plate_number: string | null;
  owner_name: string;
  reason: "personal_use" | "maintenance" | "others";
  reason_other: string | null;
  pickup_date: string;
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
  status: "new" | "car_not_available" | "block_off_started" | "blocked_off_ended";
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
  { value: "car_not_available", label: "Car Not Available", className: "bg-red-100 text-red-700 border-red-200" },
  { value: "block_off_started", label: "Block Off Started", className: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "blocked_off_ended", label: "Blocked Off Ended", className: "bg-green-100 text-green-700 border-green-200" },
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
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
}

const PAGE_SIZE_KEY = "operations.carBlockOff.pageSize";

// ── Tab component ─────────────────────────────────────────────────────────────

export function CarBlockOffTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const limit = (() => {
    try { return Number(localStorage.getItem(PAGE_SIZE_KEY)) || 20; } catch { return 20; }
  })();

  const { data, isLoading } = useQuery<SubmissionsResponse>({
    queryKey: ["/api/car-block-off/submissions", search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(buildApiUrl(`/api/car-block-off/submissions?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 30_000,
  });

  const records = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

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
        {total > 0 && (
          <span className="text-sm text-muted-foreground">{total} record{total !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {[
                "Car Name", "Plate #", "Owner", "Reason",
                "Pick Up Date", "Pick Up Location",
                "Drop Off Date", "Drop Off Location",
                "Assigned To", "Pick Up Assigned To", "Drop Off Assigned To",
                "Status", "Actions"
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">No records found.</td></tr>
            ) : records.map((r) => {
              const sm = statusMeta(r.status);
              return (
                <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
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
                  {/* Pick Up Location */}
                  <td className="px-3 py-2 text-foreground max-w-[160px] truncate">{r.pickup_location}</td>
                  {/* Drop Off Date */}
                  <td className="px-3 py-2 whitespace-nowrap text-foreground text-xs">{fmtDateTime(r.dropoff_date)}</td>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-foreground px-2">Page {page} of {totalPages}</span>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
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
