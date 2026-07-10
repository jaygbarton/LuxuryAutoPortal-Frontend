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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";
import { DashboardRecordCard } from "@/components/admin/dashboard/DashboardRecordCard";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { StatusBadge } from "./StatusBadge";
import { PhotoUpload } from "./PhotoUpload";
import { VIOLATION_TYPES } from "../forms/TicketViolationSubmission";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";

interface TicketViolation {
  tv_aid: number;
  tv_client_name: string;
  tv_client_email: string;
  tv_car_id: number | null;
  tv_car_label: string;
  tv_reservation_id: string | null;
  tv_plate: string | null;
  tv_vin: string | null;
  tv_violation_type: string | null;
  tv_violation_date: string | null;
  tv_due_date: string | null;
  tv_amount_due: number | string | null;
  tv_total_payment: number | string | null;
  tv_location: string | null;
  tv_datetime: string | null;
  tv_description: string | null;
  tv_photos: string[];
  tv_status: string;
  tv_source: "client" | "manual";
  tv_date_submitted: string;
}

interface CarOption {
  id: number;
  label: string;
  plate: string | null;
  vin: string | null;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "new", label: "New" },
  { value: "charged_guest", label: "Charged the Guest" },
  { value: "paid", label: "Paid" },
  { value: "disputed", label: "Disputed" },
];

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleDateString("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", year: "numeric" }) +
      ", " +
      d.toLocaleTimeString("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" })
    );
  } catch {
    return dateStr;
  }
};

const money = (v: number | string | null): string => {
  if (v == null || v === "") return "--";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n)
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "--";
};

const statusAccentFor = (status: string) =>
  status === "paid"
    ? { bg: "bg-green-600", border: "border-green-300" }
    : status === "disputed"
    ? { bg: "bg-red-600", border: "border-red-300" }
    : status === "charged_guest"
    ? { bg: "bg-amber-500", border: "border-amber-300" }
    : { bg: "bg-slate-500", border: "border-slate-300" };

// ─── Modal (manual create / edit) ───────────────────────────────────────────
function TicketViolationModal({
  open,
  onOpenChange,
  record,
  cars,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: TicketViolation | null;
  cars: CarOption[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    tv_car_id: "",
    tv_reservation_id: "",
    tv_plate: "",
    tv_vin: "",
    tv_violation_type: "",
    tv_violation_date: "",
    tv_due_date: "",
    tv_amount_due: "",
    tv_total_payment: "",
    tv_location: "",
    tv_datetime: "",
    tv_description: "",
    tv_status: "new",
  });
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setForm({
        tv_car_id: record.tv_car_id != null ? String(record.tv_car_id) : "",
        tv_reservation_id: record.tv_reservation_id ?? "",
        tv_plate: record.tv_plate ?? "",
        tv_vin: record.tv_vin ?? "",
        tv_violation_type: record.tv_violation_type ?? "",
        tv_violation_date: record.tv_violation_date ? record.tv_violation_date.slice(0, 10) : "",
        tv_due_date: record.tv_due_date ? record.tv_due_date.slice(0, 10) : "",
        tv_amount_due: record.tv_amount_due != null ? String(record.tv_amount_due) : "",
        tv_total_payment: record.tv_total_payment != null ? String(record.tv_total_payment) : "",
        tv_location: record.tv_location ?? "",
        tv_datetime: record.tv_datetime ? record.tv_datetime.slice(0, 16).replace(" ", "T") : "",
        tv_description: record.tv_description ?? "",
        tv_status: record.tv_status || "new",
      });
      setPhotos(record.tv_photos || []);
    } else {
      setForm({
        tv_car_id: "",
        tv_reservation_id: "",
        tv_plate: "",
        tv_vin: "",
        tv_violation_type: "",
        tv_violation_date: "",
        tv_due_date: "",
        tv_amount_due: "",
        tv_total_payment: "",
        tv_location: "",
        tv_datetime: "",
        tv_description: "",
        tv_status: "new",
      });
      setPhotos([]);
    }
  }, [open, record]);

  // When a car is chosen on a NEW record, prefill plate/vin from the fleet.
  const onCarChange = (v: string) => {
    const car = cars.find((c) => String(c.id) === v);
    setForm((p) => ({
      ...p,
      tv_car_id: v,
      tv_plate: p.tv_plate || car?.plate || "",
      tv_vin: p.tv_vin || car?.vin || "",
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        tv_car_id: form.tv_car_id ? Number(form.tv_car_id) : null,
      };
      const url = record
        ? buildApiUrl(`/api/admin/ticket-violations/${record.tv_aid}`)
        : buildApiUrl(`/api/admin/ticket-violations`);
      const res = await fetch(url, {
        method: record ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ticket-violations"] });
      toast({ title: "Success", description: record ? "Ticket violation updated" : "Ticket violation created" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {record ? "Edit Ticket Violation" : "Add Ticket Violation"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            All fields are manual entry. Status defaults to New.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div className="space-y-1.5">
            <Label>Reservation ID</Label>
            <Input value={form.tv_reservation_id} onChange={(e) => setForm((p) => ({ ...p, tv_reservation_id: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Car (Name Model Year)</Label>
            <Select value={form.tv_car_id} onValueChange={onCarChange}>
              <SelectTrigger><SelectValue placeholder="Select a car" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {cars.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Plate #</Label>
            <Input value={form.tv_plate} onChange={(e) => setForm((p) => ({ ...p, tv_plate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>VIN #</Label>
            <Input value={form.tv_vin} onChange={(e) => setForm((p) => ({ ...p, tv_vin: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Violation Type</Label>
            <Select value={form.tv_violation_type} onValueChange={(v) => setForm((p) => ({ ...p, tv_violation_type: v }))}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {VIOLATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Violation Date</Label>
            <Input type="date" value={form.tv_violation_date} onChange={(e) => setForm((p) => ({ ...p, tv_violation_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <Input type="date" value={form.tv_due_date} onChange={(e) => setForm((p) => ({ ...p, tv_due_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Amount Due</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.tv_amount_due} onChange={(e) => setForm((p) => ({ ...p, tv_amount_due: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Total Payment</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.tv_total_payment} onChange={(e) => setForm((p) => ({ ...p, tv_total_payment: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.tv_status} onValueChange={(v) => setForm((p) => ({ ...p, tv_status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-2 space-y-4">
          <p className="text-sm font-semibold text-foreground">Violation Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.tv_location} onChange={(e) => setForm((p) => ({ ...p, tv_location: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date and Time</Label>
              <Input type="datetime-local" value={form.tv_datetime} onChange={(e) => setForm((p) => ({ ...p, tv_datetime: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.tv_description} onChange={(e) => setForm((p) => ({ ...p, tv_description: e.target.value }))} />
          </div>
        </div>

        {/* Photos — only after the record exists (upload needs an id) */}
        <div className="mt-2 space-y-1.5">
          <Label>Photos</Label>
          {record ? (
            <PhotoUpload
              photos={photos}
              onPhotosChange={async (next) => {
                setPhotos(next);
                // Persist removals immediately (adds are persisted by the upload endpoint).
                await fetch(buildApiUrl(`/api/admin/ticket-violations/${record.tv_aid}/photos`), {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ photos: next }),
                }).catch(() => {});
                queryClient.invalidateQueries({ queryKey: ["/api/admin/ticket-violations"] });
              }}
              entityType="ticket_violation"
              entityId={record.tv_aid}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Save the record first, then re-open to attach photos.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-card text-foreground border-border">
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/80"
          >
            {saveMutation.isPending ? "Saving..." : record ? "Save Changes" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────
export function TicketViolationTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TicketViolation | null>(null);
  const [deleting, setDeleting] = useState<TicketViolation | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize("operations.ticket-violation");

  const { data, isLoading } = useQuery<{ data: TicketViolation[] }>({
    queryKey: ["/api/admin/ticket-violations", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      const res = await fetch(buildApiUrl(`/api/admin/ticket-violations?${params.toString()}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch ticket violations");
      return res.json();
    },
  });

  const { data: carsData } = useQuery<{ data: CarOption[] }>({
    queryKey: ["/api/ticket-violations/cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/ticket-violations/cars"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
  });
  const cars = carsData?.data || [];

  const rawRows = data?.data || [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rawRows;
    return rawRows.filter((r) =>
      [
        r.tv_client_name,
        r.tv_client_email,
        r.tv_car_label,
        r.tv_reservation_id,
        r.tv_plate,
        r.tv_vin,
        r.tv_violation_type,
        r.tv_description,
        r.tv_location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rawRows, search]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, search, pageSize]);

  const pagedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(buildApiUrl(`/api/admin/ticket-violations/${id}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ticket-violations"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/ticket-violations/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ticket-violations"] });
      toast({ title: "Deleted" });
      setDeleting(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const newCount = rawRows.filter((r) => r.tv_status === "new").length;
  const chargedCount = rawRows.filter((r) => r.tv_status === "charged_guest").length;
  const paidCount = rawRows.filter((r) => r.tv_status === "paid").length;
  const disputedCount = rawRows.filter((r) => r.tv_status === "disputed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Ticket Violation" variant="plain" className="mb-0" />
        <Button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="bg-primary text-primary-foreground hover:bg-primary/80"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Ticket Violation
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="New" value={String(newCount)} variant="dark" />
        <SummaryCard label="Charged the Guest" value={String(chargedCount)} variant="gold" />
        <SummaryCard label="Paid" value={String(paidCount)} variant="white" />
        <SummaryCard label="Disputed" value={String(disputedCount)} variant="white" />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Reservation #, car, plate, VIN, type, submitter..."
                className="bg-card border-border text-foreground h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[200px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-sm text-muted-foreground mb-3">Total: {rows.length}</div>

          <div className="flex flex-col gap-3">
            {isLoading ? (
              <p className="text-center py-12 text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No ticket violations found</p>
            ) : (
              pagedRows.map((r) => {
                const accent = statusAccentFor(r.tv_status);
                const statusControl = (
                  <Select value={r.tv_status} onValueChange={(v) => statusMutation.mutate({ id: r.tv_aid, status: v })}>
                    <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                      <StatusBadge status={r.tv_status} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );

                const actionsEl = (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setModalOpen(true); }} className="text-muted-foreground hover:text-primary h-7 px-2" title="Edit">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} className="text-muted-foreground hover:text-red-700 h-7 px-2" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );

                const photoEl =
                  r.tv_photos && r.tv_photos.length > 0 ? (
                    <PhotoUpload photos={r.tv_photos} onPhotosChange={() => {}} entityType="ticket_violation" entityId={r.tv_aid} disabled compact />
                  ) : (
                    "--"
                  );

                return (
                  <DashboardRecordCard
                    key={r.tv_aid}
                    accentBg={accent.bg}
                    accentBorder={accent.border}
                    typeLabel="Violation"
                    reservationId={r.tv_reservation_id}
                    carName={r.tv_car_label || "--"}
                    plate={r.tv_plate}
                    guestName={r.tv_client_name || r.tv_client_email || null}
                    statusControl={statusControl}
                    notes={r.tv_description}
                    details={[
                      { label: "Violation Type", value: r.tv_violation_type || "--" },
                      { label: "VIN", value: r.tv_vin || "--" },
                      { label: "Violation Date", value: formatDate(r.tv_violation_date) },
                      { label: "Due Date", value: formatDate(r.tv_due_date) },
                      { label: "Amount Due", value: money(r.tv_amount_due) },
                      { label: "Total Payment", value: money(r.tv_total_payment) },
                      { label: "Location", value: r.tv_location || "--" },
                      { label: "Date & Time", value: formatDateTime(r.tv_datetime) },
                      { label: "Source", value: r.tv_source === "client" ? "Client Form" : "Manual" },
                      { label: "Submitted", value: formatDate(r.tv_date_submitted) },
                      { label: "Photos", value: photoEl },
                      { label: "Actions", value: actionsEl },
                    ]}
                  />
                );
              })
            )}
          </div>
        </div>
        <TablePagination
          totalItems={rows.length}
          itemsPerPage={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setPageSize}
          isLoading={isLoading}
        />
      </div>

      <TicketViolationModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        record={editing}
        cars={cars}
      />

      {deleting && (
        <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">Delete Ticket Violation</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Delete the ticket violation for {deleting.tv_car_label || "this record"}?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleting(null)} className="bg-card text-foreground border-border">
                Cancel
              </Button>
              <Button
                onClick={() => deleteMutation.mutate(deleting.tv_aid)}
                disabled={deleteMutation.isPending}
                className="bg-red-500/20 text-red-700 hover:bg-red-500/30"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
