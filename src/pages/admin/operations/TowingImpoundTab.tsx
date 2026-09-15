import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { api } from "@/lib/api";
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
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { DashboardRecordCard } from "@/components/admin/dashboard/DashboardRecordCard";
import { IncidentStatusSummaryCards } from "./IncidentStatusSummaryCards";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { StatusBadge } from "./StatusBadge";
import { PhotoUpload } from "./PhotoUpload";
import { CarComboboxField } from "./CarComboboxField";
import { INCIDENT_TYPES } from "../forms/TowingImpoundSubmission";
import { useToast } from "@/hooks/use-toast";
import { toMtLocalInput, mtLocalInputToUtcDbString } from "@/lib/mt-datetime";
import { getActiveTimezone } from "@/hooks/use-timezone";
import { Plus, Edit, Trash2 } from "lucide-react";
import { OperationEditHistory } from "@/components/admin/OperationEditHistory";
import { CarPhotoCell } from "@/components/admin/dashboard/CarPhotoCell";

interface TowingImpound {
  ti_aid: number;
  ti_client_name: string;
  ti_client_email: string;
  ti_car_id: number | null;
  ti_car_label: string;
  /** Joined from the `car` table via ti_car_id; null when unlinked. */
  car_photo?: string | null;
  ti_reservation_id: string | null;
  ti_plate: string | null;
  ti_vin: string | null;
  ti_incident_type: string | null;
  ti_incident_date: string | null;
  ti_due_date: string | null;
  ti_amount_due: number | string | null;
  ti_total_payment: number | string | null;
  ti_location: string | null;
  ti_datetime: string | null;
  ti_description: string | null;
  ti_photos: string[];
  ti_status: string;
  ti_source: "client" | "manual";
  ti_date_submitted: string;
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
    return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const tz = getActiveTimezone();
    return (
      d.toLocaleDateString("en-US", { timeZone: tz, month: "2-digit", day: "2-digit", year: "numeric" }) +
      ", " +
      d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })
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
function TowingImpoundModal({
  open,
  onOpenChange,
  record,
  cars,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: TowingImpound | null;
  cars: CarOption[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    ti_car_id: "",
    ti_reservation_id: "",
    ti_plate: "",
    ti_vin: "",
    ti_incident_type: "",
    ti_incident_date: "",
    ti_due_date: "",
    ti_amount_due: "",
    ti_total_payment: "",
    ti_location: "",
    ti_datetime: "",
    ti_description: "",
    ti_status: "new",
  });
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setForm({
        ti_car_id: record.ti_car_id != null ? String(record.ti_car_id) : "",
        ti_reservation_id: record.ti_reservation_id ?? "",
        ti_plate: record.ti_plate ?? "",
        ti_vin: record.ti_vin ?? "",
        ti_incident_type: record.ti_incident_type ?? "",
        ti_incident_date: record.ti_incident_date ? record.ti_incident_date.slice(0, 10) : "",
        ti_due_date: record.ti_due_date ? record.ti_due_date.slice(0, 10) : "",
        ti_amount_due: record.ti_amount_due != null ? String(record.ti_amount_due) : "",
        ti_total_payment: record.ti_total_payment != null ? String(record.ti_total_payment) : "",
        ti_location: record.ti_location ?? "",
        ti_datetime: toMtLocalInput(record.ti_datetime),
        ti_description: record.ti_description ?? "",
        ti_status: record.ti_status || "new",
      });
      setPhotos(record.ti_photos || []);
    } else {
      setForm({
        ti_car_id: "",
        ti_reservation_id: "",
        ti_plate: "",
        ti_vin: "",
        ti_incident_type: "",
        ti_incident_date: "",
        ti_due_date: "",
        ti_amount_due: "",
        ti_total_payment: "",
        ti_location: "",
        ti_datetime: "",
        ti_description: "",
        ti_status: "new",
      });
      setPhotos([]);
    }
  }, [open, record]);

  // When a car is chosen on a NEW record, prefill plate/vin from the fleet.
  const onCarChange = (v: string) => {
    const car = cars.find((c) => String(c.id) === v);
    setForm((p) => ({
      ...p,
      ti_car_id: v,
      ti_plate: p.ti_plate || car?.plate || "",
      ti_vin: p.ti_vin || car?.vin || "",
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        ti_car_id: form.ti_car_id ? Number(form.ti_car_id) : null,
        ti_datetime: mtLocalInputToUtcDbString(form.ti_datetime),
      };
      const url = record
        ? buildApiUrl(`/api/admin/towing-impound/${record.ti_aid}`)
        : buildApiUrl(`/api/admin/towing-impound`);
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/towing-impound"] });
      toast({ title: "Success", description: record ? "Towing & impound updated" : "Towing & impound created" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {record ? "Edit Towing & Impound" : "Add Towing & Impound"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            All fields are manual entry. Status defaults to New.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div className="space-y-1.5">
            <Label>Reservation ID</Label>
            <Input value={form.ti_reservation_id} onChange={(e) => setForm((p) => ({ ...p, ti_reservation_id: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Car (Name Model Year)</Label>
            <CarComboboxField cars={cars} value={form.ti_car_id} onChange={onCarChange} />
          </div>
          <div className="space-y-1.5">
            <Label>Plate #</Label>
            <Input value={form.ti_plate} onChange={(e) => setForm((p) => ({ ...p, ti_plate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>VIN #</Label>
            <Input value={form.ti_vin} onChange={(e) => setForm((p) => ({ ...p, ti_vin: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Incident Type</Label>
            <Select value={form.ti_incident_type} onValueChange={(v) => setForm((p) => ({ ...p, ti_incident_type: v }))}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Incident Date</Label>
            <Input type="date" value={form.ti_incident_date} onChange={(e) => setForm((p) => ({ ...p, ti_incident_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <Input type="date" value={form.ti_due_date} onChange={(e) => setForm((p) => ({ ...p, ti_due_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Amount Due</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.ti_amount_due} onChange={(e) => setForm((p) => ({ ...p, ti_amount_due: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Total Payment</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.ti_total_payment} onChange={(e) => setForm((p) => ({ ...p, ti_total_payment: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.ti_status} onValueChange={(v) => setForm((p) => ({ ...p, ti_status: v }))}>
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
          <p className="text-sm font-semibold text-foreground">Incident Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.ti_location} onChange={(e) => setForm((p) => ({ ...p, ti_location: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date and Time</Label>
              <Input type="datetime-local" value={form.ti_datetime} onChange={(e) => setForm((p) => ({ ...p, ti_datetime: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.ti_description} onChange={(e) => setForm((p) => ({ ...p, ti_description: e.target.value }))} />
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
                await fetch(buildApiUrl(`/api/admin/towing-impound/${record.ti_aid}/photos`), {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ photos: next }),
                }).catch(() => {});
                queryClient.invalidateQueries({ queryKey: ["/api/admin/towing-impound"] });
              }}
              entityType="towing_impound"
              entityId={record.ti_aid}
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
export function TowingImpoundTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TowingImpound | null>(null);
  const [deleting, setDeleting] = useState<TowingImpound | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize("operations.towing-impound");

  const { data, isLoading } = useQuery<{ data: TowingImpound[] }>({
    queryKey: ["/api/admin/towing-impound", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      return api.get(`/api/admin/towing-impound?${params.toString()}`, {
        fallbackMessage: "Failed to fetch towing & impound incidents",
      });
    },
  });

  const { data: carsData } = useQuery<{ data: CarOption[] }>({
    queryKey: ["/api/towing-impound/cars"],
    queryFn: async () => {
      return api.get("/api/towing-impound/cars", {
        fallbackMessage: "Failed to fetch cars",
      });
    },
  });
  const cars = carsData?.data || [];

  const rawRows = data?.data || [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rawRows;
    return rawRows.filter((r) =>
      [
        r.ti_client_name,
        r.ti_client_email,
        r.ti_car_label,
        r.ti_reservation_id,
        r.ti_plate,
        r.ti_vin,
        r.ti_incident_type,
        r.ti_description,
        r.ti_location,
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
      return api.patch(`/api/admin/towing-impound/${id}/status`, { status }, {
        fallbackMessage: "Failed to update status",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/towing-impound"] });
      toast({ title: "Status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/api/admin/towing-impound/${id}`, {
        fallbackMessage: "Failed to delete",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/towing-impound"] });
      toast({ title: "Deleted" });
      setDeleting(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Towing & Impound" variant="plain" className="mb-0" />
        <Button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="bg-primary text-primary-foreground hover:bg-primary/80"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Towing & Impound
        </Button>
      </div>

      <IncidentStatusSummaryCards statuses={rawRows.map((r) => r.ti_status)} />

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
              <p className="text-center py-12 text-muted-foreground">No towing & impound incidents found</p>
            ) : (
              pagedRows.map((r) => {
                const accent = statusAccentFor(r.ti_status);
                const statusControl = (
                  <Select value={r.ti_status} onValueChange={(v) => statusMutation.mutate({ id: r.ti_aid, status: v })}>
                    <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                      <StatusBadge status={r.ti_status} />
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
                    <OperationEditHistory entityType="towing_impound" entityId={r.ti_aid} />
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} className="text-muted-foreground hover:text-red-700 h-7 px-2" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );

                const photoEl =
                  r.ti_photos && r.ti_photos.length > 0 ? (
                    <PhotoUpload photos={r.ti_photos} onPhotosChange={() => {}} entityType="towing_impound" entityId={r.ti_aid} disabled compact />
                  ) : (
                    "--"
                  );

                return (
                  <DashboardRecordCard
                    key={r.ti_aid}
                    accentBg={accent.bg}
                    accentBorder={accent.border}
                    typeLabel="Incident"
                    reservationId={r.ti_reservation_id}
                    leftMedia={r.car_photo ? (
                      <CarPhotoCell
                        carPhoto={r.car_photo}
                        carName={r.ti_car_label}
                        className="w-full max-w-[420px] h-40 sm:h-48"
                        size={960}
                      />
                    ) : null}
                    carName={r.ti_car_label || "--"}
                    plate={r.ti_plate}
                    guestName={r.ti_client_name || r.ti_client_email || null}
                    statusControl={statusControl}
                    notes={r.ti_description}
                    details={[
                      { label: "Incident Type", value: r.ti_incident_type || "--" },
                      { label: "VIN", value: r.ti_vin || "--" },
                      { label: "Incident Date", value: formatDate(r.ti_incident_date) },
                      { label: "Due Date", value: formatDate(r.ti_due_date) },
                      { label: "Amount Due", value: money(r.ti_amount_due) },
                      { label: "Total Payment", value: money(r.ti_total_payment) },
                      { label: "Location", value: r.ti_location || "--" },
                      { label: "Date & Time", value: formatDateTime(r.ti_datetime) },
                      { label: "Source", value: r.ti_source === "client" ? "Client Form" : "Manual" },
                      { label: "Submitted", value: formatDate(r.ti_date_submitted) },
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

      <TowingImpoundModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        record={editing}
        cars={cars}
      />

      {deleting && (
        <ConfirmDeleteDialog
          open={!!deleting}
          onOpenChange={(o) => { if (!o) setDeleting(null); }}
          title="Delete Towing & Impound"
          description={`Delete the towing & impound incident for ${deleting.ti_car_label || "this record"}?`}
          onConfirm={() => deleteMutation.mutate(deleting.ti_aid)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
