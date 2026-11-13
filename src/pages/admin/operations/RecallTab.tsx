import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";
import { DashboardRecordCard } from "@/components/admin/dashboard/DashboardRecordCard";
import { CarPhotoCell } from "@/components/admin/dashboard/CarPhotoCell";
import { TablePagination } from "@/components/ui/table-pagination";
import { OperationEditHistory } from "@/components/admin/OperationEditHistory";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { useToast } from "@/hooks/use-toast";
import { formatMonthDayYearTime } from "@/lib/date-format";
import { useOperationFleetRows } from "./OperationsFleetFilter";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { RecallModal } from "./RecallModal";
import {
  daysOpen, deleteRecall, fetchRecalls, formatRecallDay, RECALL_STATUS_OPTIONS, RECALLS_PATH,
  recallStatusLabel, recallVehicleName, updateRecall, type Recall, type RecallStatus,
} from "./recalls";

export function RecallTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<"all" | RecallStatus>("new");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Recall | null>(null);
  const [deleting, setDeleting] = useState<Recall | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize("operations.recall");

  const { data: me } = useQuery<{ user?: { firstName?: string; lastName?: string; isAdmin?: boolean } }>({ queryKey: ["/api/auth/me"] });
  const isAdmin = !!me?.user?.isAdmin;
  const currentUserName = me?.user ? `${me.user.firstName || ""} ${me.user.lastName || ""}`.trim() : undefined;

  // One fetch for every status so the summary cards always count the whole list.
  const { data = [], isLoading, isError, error } = useQuery<Recall[]>({
    queryKey: [RECALLS_PATH, "all"],
    queryFn: () => fetchRecalls(),
  });
  const rows = useOperationFleetRows(data);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (!q) return true;
      return [r.carName, r.vehicleLabel, r.plate, r.vin, r.assignedTo, r.notes, r.turoVehicleId]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [rows, filterStatus, search]);

  useEffect(() => setPage(1), [filterStatus, search, pageSize]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [RECALLS_PATH] });
    queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
  };
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof updateRecall>[1] }) => updateRecall(id, body),
    onSuccess: () => { invalidate(); toast({ title: "Recall updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteRecall(id),
    onSuccess: () => { invalidate(); setDeleting(null); toast({ title: "Recall deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCount = rows.filter((r) => r.status === "new").length;
  const scheduledCount = rows.filter((r) => r.status === "new" && r.scheduledRepairDate).length;
  const completedCount = rows.filter((r) => r.status === "repair_completed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <SectionHeader title="Recall" variant="plain" className="mb-0 min-w-0" />
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="w-full bg-primary text-primary-foreground hover:bg-primary/80 sm:w-auto">
          <Plus className="w-4 h-4" /> Add Recall
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Open Recalls" value={String(openCount)} variant="gold" />
        <SummaryCard label="Repair Scheduled" value={String(scheduledCount)} variant="dark" />
        <SummaryCard label="Repair Completed" value={String(completedCount)} variant="white" />
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:flex-1 lg:min-w-[200px]">
              <label htmlFor="recall-search" className="text-muted-foreground text-xs">Search</label>
              <Input id="recall-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Car, plate, VIN, assignee, notes..." className="bg-card border-border h-9 w-full" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | RecallStatus)}>
                <SelectTrigger aria-label="Recall status filter" className="bg-card border-border w-full lg:w-[200px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  {RECALL_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-sm text-muted-foreground mb-3">Total: {filtered.length}</div>

          <div className="flex flex-col gap-3">
            {isLoading ? (
              <p className="text-center py-12 text-muted-foreground">Loading recalls...</p>
            ) : isError ? (
              <p role="alert" className="text-center py-12 text-red-600">{(error as Error)?.message || "Recalls could not be loaded."}</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No recalls found</p>
            ) : paged.map((r) => {
              const done = r.status === "repair_completed";
              const statusControl = (
                <Select value={r.status} onValueChange={(v) => patch.mutate({ id: r.id, body: { status: v as RecallStatus } })}>
                  <SelectTrigger aria-label={`Status for ${recallVehicleName(r)}`} className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${done ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}`}>
                      {recallStatusLabel(r.status)}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {RECALL_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              );
              const assignee = (
                <EmployeeSelectCombobox
                  value={r.assignedTo || ""}
                  onChange={(v) => { if (!v) patch.mutate({ id: r.id, body: { assignedTo: null, assignedToId: null } }); }}
                  onSelectEmployee={(emp) => {
                    if (!emp) return;
                    const name = [emp.employee_first_name, emp.employee_last_name].filter(Boolean).join(" ").trim() || emp.employee_email || `Employee #${emp.employee_aid}`;
                    patch.mutate({ id: r.id, body: { assignedTo: name, assignedToId: emp.employee_aid } });
                  }}
                  placeholder="Assign..."
                />
              );
              const actions = (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setModalOpen(true); }} className="text-muted-foreground hover:text-primary h-7 px-2" title="Edit">
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <OperationEditHistory entityType="recall" entityId={r.id} />
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} className="text-muted-foreground hover:text-red-700 h-7 px-2" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
              return (
                <DashboardRecordCard
                  key={r.id}
                  accentBg={done ? "bg-green-600" : "bg-red-600"}
                  accentBorder={done ? "border-green-300" : "border-red-300"}
                  typeLabel="Recall"
                  leftMedia={r.carPhoto ? <CarPhotoCell carPhoto={r.carPhoto} carName={r.carName} className="w-full max-w-[420px] h-40 sm:h-48" size={960} /> : null}
                  carName={recallVehicleName(r)}
                  plate={r.plate}
                  assignedTo={r.assignedTo}
                  statusControl={statusControl}
                  notes={r.notes}
                  details={[
                    { label: "VIN", value: r.vin || "--" },
                    { label: "Linked Car", value: r.carId ? "Yes" : <span className="text-amber-600">Not matched — edit to pick the vehicle</span> },
                    { label: "Unlisted", value: r.source === "email" ? formatMonthDayYearTime(r.emailReceivedAt) : "--" },
                    { label: "Days Open", value: done ? "--" : String(daysOpen(r)) },
                    { label: "Scheduled Date of Repair", value: formatRecallDay(r.scheduledRepairDate) },
                    { label: "Repair Completed", value: formatRecallDay(r.repairCompletedDate) },
                    { label: "Assigned To", value: assignee },
                    { label: "Source", value: r.source === "email" ? "Turo Email" : "Manual" },
                    { label: "Added to System", value: formatMonthDayYearTime(r.createdAt) },
                    { label: "Actions", value: actions },
                  ]}
                />
              );
            })}
          </div>
        </div>
        <TablePagination totalItems={filtered.length} itemsPerPage={pageSize} currentPage={page} onPageChange={setPage} onItemsPerPageChange={setPageSize} isLoading={isLoading} />
      </div>

      <RecallModal open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) setEditing(null); }} recall={editing} defaultAssignedTo={!editing ? currentUserName : undefined} />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="Delete Recall"
        description={deleting ? `Delete the recall for ${recallVehicleName(deleting)}${deleting.plate ? ` (${deleting.plate})` : ""}?` : ""}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        isPending={remove.isPending}
      />
    </div>
  );
}
