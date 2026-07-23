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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";
import { DashboardRecordCard } from "@/components/admin/dashboard/DashboardRecordCard";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { StatusBadge } from "./StatusBadge";
import { PhotoUpload } from "./PhotoUpload";
import { ReceiptUpload } from "./ReceiptUpload";
import { REPAIR_TYPES } from "../forms/CarRepairedSubmission";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, ChevronsUpDown, Check } from "lucide-react";

interface CarRepaired {
  cr_aid: number;
  cr_submitter_name: string;
  cr_submitter_email: string;
  cr_car_id: number | null;
  cr_car_label: string;
  cr_plate: string | null;
  cr_vin: string | null;
  cr_repair_completion_date: string | null;
  cr_repair_type: string | null;
  cr_repair_notes: string | null;
  cr_photos: string[];
  cr_receipts: string[];
  cr_status: string;
  cr_source: "staff" | "manual";
  cr_date_submitted: string;
}

interface CarOption {
  id: number;
  label: string;
  plate: string | null;
  vin: string | null;
}

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

// ─── Modal (manual create / edit) ───────────────────────────────────────────
function CarRepairedModal({
  open,
  onOpenChange,
  record,
  cars,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CarRepaired | null;
  cars: CarOption[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    cr_car_id: "",
    cr_plate: "",
    cr_vin: "",
    cr_repair_completion_date: "",
    cr_repair_type: "",
    cr_repair_notes: "",
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [receipts, setReceipts] = useState<string[]>([]);
  const [carPickerOpen, setCarPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setForm({
        cr_car_id: record.cr_car_id != null ? String(record.cr_car_id) : "",
        cr_plate: record.cr_plate ?? "",
        cr_vin: record.cr_vin ?? "",
        cr_repair_completion_date: record.cr_repair_completion_date
          ? record.cr_repair_completion_date.slice(0, 10)
          : "",
        cr_repair_type: record.cr_repair_type ?? "",
        cr_repair_notes: record.cr_repair_notes ?? "",
      });
      setPhotos(record.cr_photos || []);
      setReceipts(record.cr_receipts || []);
    } else {
      setForm({
        cr_car_id: "",
        cr_plate: "",
        cr_vin: "",
        cr_repair_completion_date: "",
        cr_repair_type: "",
        cr_repair_notes: "",
      });
      setPhotos([]);
      setReceipts([]);
    }
  }, [open, record]);

  const onCarChange = (v: string) => {
    const car = cars.find((c) => String(c.id) === v);
    setForm((p) => ({
      ...p,
      cr_car_id: v,
      cr_plate: p.cr_plate || car?.plate || "",
      cr_vin: p.cr_vin || car?.vin || "",
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        cr_car_id: form.cr_car_id ? Number(form.cr_car_id) : null,
      };
      const url = record
        ? buildApiUrl(`/api/admin/car-repaired/${record.cr_aid}`)
        : buildApiUrl(`/api/admin/car-repaired`);
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/car-repaired"] });
      toast({ title: "Success", description: record ? "Car repaired log updated" : "Car repaired log created" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {record ? "Edit Car Repaired" : "Add Car Repaired"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            All fields are manual entry.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Vehicle</Label>
            <Popover open={carPickerOpen} onOpenChange={setCarPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={carPickerOpen}
                  className="w-full justify-between bg-card border-border text-foreground hover:bg-card hover:text-foreground font-normal"
                >
                  <span className="truncate">
                    {form.cr_car_id
                      ? cars.find((c) => String(c.id) === form.cr_car_id)?.label || "Select a vehicle"
                      : "Select a vehicle"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-card border-border" align="start">
                <Command className="bg-card">
                  <CommandInput
                    placeholder="Search by name, plate, or VIN…"
                    className="text-foreground placeholder:text-muted-foreground border-b border-border"
                  />
                  <CommandList className="max-h-[220px]">
                    <CommandEmpty className="text-muted-foreground py-4 text-sm text-center px-2">
                      No vehicles found.
                    </CommandEmpty>
                    <CommandGroup>
                      {cars.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.label}
                          onSelect={() => {
                            onCarChange(String(c.id));
                            setCarPickerOpen(false);
                          }}
                          className="text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-foreground cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              form.cr_car_id === String(c.id) ? "opacity-100 text-primary" : "opacity-0",
                            )}
                          />
                          {c.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label>Plate #</Label>
            <Input value={form.cr_plate} onChange={(e) => setForm((p) => ({ ...p, cr_plate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>VIN #</Label>
            <Input value={form.cr_vin} onChange={(e) => setForm((p) => ({ ...p, cr_vin: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Repair Completion Date</Label>
            <Input
              type="date"
              value={form.cr_repair_completion_date}
              onChange={(e) => setForm((p) => ({ ...p, cr_repair_completion_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Repair Type</Label>
            <Select value={form.cr_repair_type} onValueChange={(v) => setForm((p) => ({ ...p, cr_repair_type: v }))}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {REPAIR_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          <Label>Repair Notes</Label>
          <Textarea
            rows={3}
            value={form.cr_repair_notes}
            onChange={(e) => setForm((p) => ({ ...p, cr_repair_notes: e.target.value }))}
          />
        </div>

        {/* Photos / receipts — only after the record exists (upload needs an id) */}
        <div className="mt-2 space-y-1.5">
          <Label>Photos</Label>
          {record ? (
            <PhotoUpload
              photos={photos}
              onPhotosChange={async (next) => {
                setPhotos(next);
                await fetch(buildApiUrl(`/api/admin/car-repaired/${record.cr_aid}/photos`), {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ photos: next }),
                }).catch(() => {});
                queryClient.invalidateQueries({ queryKey: ["/api/admin/car-repaired"] });
              }}
              entityType="car_repaired"
              entityId={record.cr_aid}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Save the record first, then re-open to attach photos.</p>
          )}
        </div>

        <div className="mt-2 space-y-1.5">
          <Label>Receipts / Invoices</Label>
          {record ? (
            <ReceiptUpload
              receipts={receipts}
              onReceiptsChange={async (next) => {
                setReceipts(next);
                await fetch(buildApiUrl(`/api/admin/car-repaired/${record.cr_aid}/receipts`), {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ receipts: next }),
                }).catch(() => {});
                queryClient.invalidateQueries({ queryKey: ["/api/admin/car-repaired"] });
              }}
              entityId={record.cr_aid}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Save the record first, then re-open to attach receipts.</p>
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
export function CarRepairedTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterRepairType, setFilterRepairType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CarRepaired | null>(null);
  const [deleting, setDeleting] = useState<CarRepaired | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize("operations.car-repaired");

  const { data, isLoading } = useQuery<{ data: CarRepaired[] }>({
    queryKey: ["/api/admin/car-repaired", filterRepairType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterRepairType !== "all") params.append("repairType", filterRepairType);
      const res = await fetch(buildApiUrl(`/api/admin/car-repaired?${params.toString()}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch car repaired logs");
      return res.json();
    },
  });

  const { data: carsData } = useQuery<{ data: CarOption[] }>({
    queryKey: ["/api/car-repaired/cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/car-repaired/cars"), { credentials: "include" });
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
        r.cr_submitter_name,
        r.cr_submitter_email,
        r.cr_car_label,
        r.cr_plate,
        r.cr_vin,
        r.cr_repair_type,
        r.cr_repair_notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rawRows, search]);

  useEffect(() => {
    setPage(1);
  }, [filterRepairType, search, pageSize]);

  const pagedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/car-repaired/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/car-repaired"] });
      toast({ title: "Deleted" });
      setDeleting(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(buildApiUrl(`/api/admin/car-repaired/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cr_status: status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/car-repaired"] });
      toast({ title: "Success", description: "Status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return rawRows.filter((r) => {
      if (!r.cr_repair_completion_date) return false;
      const d = new Date(`${r.cr_repair_completion_date.slice(0, 10)}T00:00:00`);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [rawRows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Car Repaired" variant="plain" className="mb-0" />
        <Button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="bg-primary text-primary-foreground hover:bg-primary/80"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Car Repaired
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        <SummaryCard label="Total Logged" value={String(rawRows.length)} variant="dark" />
        <SummaryCard label="This Month" value={String(thisMonthCount)} variant="gold" />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Car, plate, VIN, repair type, submitter..."
                className="bg-card border-border text-foreground h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Repair Type</label>
              <Select value={filterRepairType} onValueChange={setFilterRepairType}>
                <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[200px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  {REPAIR_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
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
              <p className="text-center py-12 text-muted-foreground">No car repaired logs found</p>
            ) : (
              pagedRows.map((r) => {
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
                  r.cr_photos && r.cr_photos.length > 0 ? (
                    <PhotoUpload photos={r.cr_photos} onPhotosChange={() => {}} entityType="car_repaired" entityId={r.cr_aid} disabled compact />
                  ) : (
                    "--"
                  );

                const receiptEl = (
                  <ReceiptUpload receipts={r.cr_receipts} onReceiptsChange={() => {}} entityId={r.cr_aid} disabled compact />
                );

                const statusAccent =
                  r.cr_status === "completed"
                    ? { bg: "bg-green-600", border: "border-green-300" }
                    : r.cr_status === "in_progress"
                    ? { bg: "bg-yellow-500", border: "border-yellow-300" }
                    : { bg: "bg-slate-500", border: "border-slate-300" };

                // Legacy rows predate the status workflow ('logged' placeholder) — treat as "new" in the dropdown.
                const statusValue =
                  r.cr_status === "in_progress" || r.cr_status === "completed" ? r.cr_status : "new";

                const statusControl = (
                  <Select
                    value={statusValue}
                    onValueChange={(v) => statusUpdateMutation.mutate({ id: r.cr_aid, status: v })}
                  >
                    <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                      <StatusBadge status={statusValue} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                );

                return (
                  <DashboardRecordCard
                    key={r.cr_aid}
                    accentBg={statusAccent.bg}
                    accentBorder={statusAccent.border}
                    typeLabel="Repaired"
                    carName={r.cr_car_label || "--"}
                    plate={r.cr_plate}
                    guestName={null}
                    statusControl={statusControl}
                    notes={r.cr_repair_notes}
                    details={[
                      { label: "Repair Type", value: r.cr_repair_type || "--" },
                      { label: "Completion Date", value: formatDate(r.cr_repair_completion_date) },
                      { label: "VIN", value: r.cr_vin || "--" },
                      { label: "Source", value: r.cr_source === "staff" ? "Staff Form" : "Manual" },
                      { label: "Submitted By", value: r.cr_submitter_name || r.cr_submitter_email || "--" },
                      { label: "Submitted", value: formatDate(r.cr_date_submitted) },
                      { label: "Photos", value: photoEl },
                      { label: "Receipts", value: receiptEl },
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

      <CarRepairedModal
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
              <DialogTitle className="text-foreground">Delete Car Repaired</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Delete the car repaired log for {deleting.cr_car_label || "this record"}?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleting(null)} className="bg-card text-foreground border-border">
                Cancel
              </Button>
              <Button
                onClick={() => deleteMutation.mutate(deleting.cr_aid)}
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
