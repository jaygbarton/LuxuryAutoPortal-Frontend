import React, { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, FileText, Loader2, Upload, Download, Wand2, CalendarX, Filter, FileSpreadsheet, CheckCircle2, X, AlertTriangle, Search, ChevronDown, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddEditPaymentModal } from "@/components/modals/AddEditPaymentModal";
import { PaymentReceiptModal } from "@/components/modals/PaymentReceiptModal";

interface Payment {
  payments_aid: number;
  payments_client_id: number;
  payments_status_id: number;
  payments_car_id: number;
  payments_year_month: string;
  payments_amount: number;
  payments_amount_payout: number;
  payments_amount_balance: number;
  payments_reference_number: string;
  payments_invoice_id: string;
  payments_invoice_date: string | null;
  payments_attachment: string | null;
  payments_remarks: string | null;
  payment_status_name: string;
  payment_status_color: string;
  car_make_name: string;
  car_specs?: string;
  car_plate_number: string;
  car_vin_number: string;
  car_year: number;
  client_fname: string;
  client_lname: string;
  fullname: string;
  /** Server flag: true when the row has matching Income & Expense data for its month. */
  payments_has_income_expense?: boolean;
  /** Server flag: true when payments_amount/balance were live-computed from I&E (not raw DB). */
  payments_amount_is_live?: boolean;
}

interface PaymentStatus {
  payment_status_aid: number;
  payment_status_name: string;
  payment_status_color: string;
}

const formatCurrency = (value: number): string => {
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value < 0) return `($ ${formatted})`;
  return `$ ${formatted}`;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const formatYearMonth = (yearMonth: string): string => {
  try {
    const [year, month] = yearMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  } catch {
    return yearMonth;
  }
};

export default function PaymentsMainPage() {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [startMonth, setStartMonth] = useState<string>("");
  const [endMonth, setEndMonth] = useState<string>("");
  const [carFilter, setCarFilter] = useState<string>("");
  const [carActivityFilter, setCarActivityFilter] = useState<"all" | "active" | "inactive">("active");
  const [carSearch, setCarSearch] = useState<string>("");
  const [carDropdownOpen, setCarDropdownOpen] = useState(false);
  const carDropdownRef = useRef<HTMLDivElement>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Developer-only mode: show destructive tools only when ?dev=1 is in the URL
  const devMode = new URLSearchParams(window.location.search).get("dev") === "1";
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);

  const [isFilter, setIsFilter] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteByMonthModalOpen, setIsDeleteByMonthModalOpen] = useState(false);
  const [isDeleteSingleModalOpen, setIsDeleteSingleModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [deleteYearMonth, setDeleteYearMonth] = useState("");
  const [addYearMonth, setAddYearMonth] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportDragOver, setIsImportDragOver] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported?: number;
    skipped?: number;
    errors?: string[];
  } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const hasFilters =
    !!filterStatus ||
    !!startMonth ||
    !!endMonth ||
    !!carFilter ||
    carActivityFilter !== "active";

  const { data: statusesData } = useQuery<{
    success: boolean;
    data: PaymentStatus[];
  }>({
    queryKey: ["/api/payment-status"],
    queryFn: async () => {
      const url = buildApiUrl("/api/payment-status");
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch payment statuses");
      return response.json();
    },
  });

  const statuses = statusesData?.data || [];
  const toPayStatus = statuses.filter((s) =>
    s.payment_status_name.toLowerCase().includes("to pay")
  );

  const { data: carsData } = useQuery<{
    success: boolean;
    data: {
      id: number;
      makeModel: string;
      licensePlate?: string;
      vin?: string;
      year?: number;
      isActive?: number | boolean;
      status?: string;
    }[];
  }>({
    queryKey: ["/api/cars", "payments-filter"],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "1000", status: "all" });
      const url = buildApiUrl(`/api/cars?${params}`);
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch cars");
      return response.json();
    },
  });

  const allCars = carsData?.data || [];

  const isCarActive = (c: { isActive?: number | boolean; status?: string }): boolean => {
    if (c.isActive !== undefined) {
      return c.isActive === 1 || c.isActive === true;
    }
    return (c.status || "").toUpperCase() === "ACTIVE";
  };

  const carsList = allCars.filter((c) => {
    if (carActivityFilter === "all") return true;
    if (carActivityFilter === "active") return isCarActive(c);
    return !isCarActive(c);
  });

  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery<{
    success: boolean;
    data: Payment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    count: number;
  }>({
    queryKey: [
      "/api/payments/search",
      filterStatus,
      startMonth,
      endMonth,
      carFilter,
      carActivityFilter,
      page,
      pageSize,
      sortOrder,
    ],
    queryFn: async () => {
      const url = buildApiUrl("/api/payments/search");
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: filterStatus || undefined,
          startDate: startMonth || undefined,
          endDate: endMonth || undefined,
          carId: carFilter || undefined,
          carActiveStatus: carActivityFilter,
          page,
          limit: pageSize,
          sortOrder,
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
  });

  const payments = paymentsData?.data || [];
  const totalPayments = paymentsData?.total || 0;
  const totalPages = paymentsData?.totalPages || 1;

  const totals = payments.reduce(
    (acc, p) => ({
      payable: acc.payable + Number(p.payments_amount || 0),
      payout: acc.payout + Number(p.payments_amount_payout || 0),
      balance:
        acc.balance +
        (Number(p.payments_amount_payout || 0) - Number(p.payments_amount || 0)),
    }),
    { payable: 0, payout: 0, balance: 0 }
  );

  const createByMonthMutation = useMutation({
    mutationFn: async (yearMonth: string) => {
      const url = buildApiUrl("/api/payments/create-by-month");
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payments_year_month: yearMonth }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || err.error || "Failed to create payments");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      toast({
        title: "Success",
        description: data.message || "Payments created successfully",
      });
      setIsAddModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteByMonthMutation = useMutation({
    mutationFn: async (yearMonth: string) => {
      const url = buildApiUrl("/api/payments/delete-by-year-month");
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payments_year_month: yearMonth }),
      });
      if (!response.ok) throw new Error("Failed to delete payments");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      toast({
        title: "Success",
        description: "Payments deleted successfully",
      });
      setIsDeleteByMonthModalOpen(false);
      setDeleteYearMonth("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSingleMutation = useMutation({
    mutationFn: async (id: number) => {
      const url = buildApiUrl(`/api/payments/${id}`);
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete payment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      toast({
        title: "Success",
        description: "Payment deleted successfully",
      });
      setIsDeleteSingleModalOpen(false);
      setSelectedPayment(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const url = buildApiUrl("/api/payments/import");
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to import payments");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      const imported = data.imported ?? data.data?.imported ?? data.count ?? 0;
      const skipped = data.skipped ?? data.data?.skipped ?? 0;
      const errs = data.errors ?? data.data?.errors ?? [];
      setImportResult({ imported, skipped, errors: errs });
      toast({
        title: "Import Complete",
        description: `${imported} payment(s) imported, ${skipped} skipped`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: async (includeInactive: boolean) => {
      const url = buildApiUrl("/api/payments/auto-generate-all");
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeInactive }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to auto-generate payments");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      toast({
        title: "Success",
        description: data.message || "Payments auto-generated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cleanupOrphansMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const url = buildApiUrl("/api/payments/cleanup-orphans");
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to clean up orphan payments");
      }
      return response.json() as Promise<{
        success: boolean;
        dryRun: boolean;
        deleted: number;
        preserved: number;
        totalOrphans: number;
      }>;
    },
    onSuccess: (data) => {
      if (!data.dryRun) {
        queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Cleanup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<{
    deleted: number;
    preserved: number;
    totalOrphans: number;
  } | null>(null);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetIncludeInactive, setResetIncludeInactive] = useState(false);

  const resetAllMutation = useMutation({
    mutationFn: async (opts: { includeInactive: boolean }) => {
      const url = buildApiUrl("/api/payments/reset-all");
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE ALL", includeInactive: opts.includeInactive }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to reset payments");
      }
      return response.json() as Promise<{
        success: boolean;
        message: string;
        deleted: number;
        created: number;
        updated: number;
        monthsProcessed: number;
        errors: string[];
      }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      toast({
        title: "Payments reset",
        description: data.message,
      });
      setIsResetModalOpen(false);
      setResetConfirmText("");
    },
    onError: (error: Error) => {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openCleanupDialog = async () => {
    setCleanupPreview(null);
    setIsCleanupModalOpen(true);
    try {
      const data = await cleanupOrphansMutation.mutateAsync(true);
      setCleanupPreview({
        deleted: data.totalOrphans - data.preserved,
        preserved: data.preserved,
        totalOrphans: data.totalOrphans,
      });
    } catch {
      setIsCleanupModalOpen(false);
    }
  };

  const confirmCleanupOrphans = async () => {
    try {
      const data = await cleanupOrphansMutation.mutateAsync(false);
      toast({
        title: "Cleanup complete",
        description: `Removed ${data.deleted} orphan payment${data.deleted === 1 ? "" : "s"} (kept ${data.preserved} with a Paid Amount).`,
      });
    } finally {
      setIsCleanupModalOpen(false);
      setCleanupPreview(null);
    }
  };

  const handleClearFilters = () => {
    setFilterStatus("");
    setStartMonth("");
    setEndMonth("");
    setCarFilter("");
    setCarActivityFilter("active");
    setIsFilter(false);
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [filterStatus, startMonth, endMonth, carFilter, carActivityFilter, pageSize]);

  // Close the car dropdown when the user clicks outside it
  useEffect(() => {
    if (!carDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (carDropdownRef.current && !carDropdownRef.current.contains(e.target as Node)) {
        setCarDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [carDropdownOpen]);

  const formatVehicleInfo = (p: Payment) => {
    const name = `${p.car_make_name || ""} ${p.car_year || ""}`.trim();
    const plate = p.car_plate_number ? `#${p.car_plate_number.trim()}` : "";
    const vin = p.car_vin_number ? p.car_vin_number.trim() : "";
    return [name, plate, vin].filter(Boolean).join(" – ");
  };

  return (
    <AdminLayout>
      <div className="flex flex-col h-full overflow-x-hidden">
        {/* Page header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-primary">Payments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage client payments across all cars
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => autoGenerateMutation.mutate(false)}
              disabled={autoGenerateMutation.isPending}
              variant="outline"
              className="bg-card border-border text-foreground hover:bg-muted hover:text-foreground h-9 font-medium"
              title="Auto-generate payments for every month using income/expense data"
            >
              {autoGenerateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2 text-primary" />
                  Auto-Generate
                </>
              )}
            </Button>
            <Button
              onClick={() => setIsImportModalOpen(true)}
              variant="outline"
              className="bg-card border-border text-foreground hover:bg-muted hover:text-foreground h-9 font-medium"
              title="Import payments from .xlsx"
            >
              <Upload className="w-4 h-4 mr-2 text-primary" />
              Import
            </Button>
            {devMode && (
              <Button
                onClick={openCleanupDialog}
                disabled={cleanupOrphansMutation.isPending}
                variant="outline"
                className="bg-card border-border text-foreground hover:bg-muted hover:text-foreground h-9 font-medium"
                title="[DEV] Delete rows where the car has no Income & Expense for that month and nothing was paid"
              >
                {cleanupOrphansMutation.isPending && !isCleanupModalOpen ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 mr-2 text-yellow-600" />
                    Clean Orphans
                  </>
                )}
              </Button>
            )}
            {devMode && (
              <Button
                onClick={() => {
                  setResetConfirmText("");
                  setResetIncludeInactive(false);
                  setIsResetModalOpen(true);
                }}
                disabled={resetAllMutation.isPending}
                variant="outline"
                className="bg-card border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-700 hover:border-red-500/50 h-9 font-medium"
                title="[DEV] Delete every payment record and regenerate from Income & Expense"
              >
                {resetAllMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Reset All
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => setIsDeleteByMonthModalOpen(true)}
              variant="outline"
              className="bg-card border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-700 hover:border-red-500/50 h-9 font-medium"
              title="Delete all payments for a month"
            >
              <CalendarX className="w-4 h-4 mr-2" />
              Delete by Month
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 font-semibold shadow-sm"
              title="Create payments for all active cars for the selected month"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Payments
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider mr-1 pb-2 self-end">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </div>
            <div className="flex flex-col">
              <label className="text-muted-foreground text-xs font-medium mb-1.5">Status</label>
              <Select
                value={filterStatus || "__all__"}
                onValueChange={(v) => {
                  setFilterStatus(v === "__all__" ? "" : v);
                  setIsFilter(true);
                }}
              >
                <SelectTrigger className="bg-background border-border text-foreground w-[140px] h-9 focus:ring-1 focus:ring-primary">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="__all__">All</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s.payment_status_aid} value={s.payment_status_name}>
                      {s.payment_status_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col">
              <label className="text-muted-foreground text-xs font-medium mb-1.5">From</label>
              <Input
                type="month"
                value={startMonth}
                onChange={(e) => {
                  setStartMonth(e.target.value);
                  setIsFilter(true);
                }}
                className="bg-background border-border text-foreground w-[160px] h-9 focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-muted-foreground text-xs font-medium mb-1.5">To</label>
              <Input
                type="month"
                value={endMonth}
                onChange={(e) => {
                  setEndMonth(e.target.value);
                  setIsFilter(true);
                }}
                className="bg-background border-border text-foreground w-[160px] h-9 focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-muted-foreground text-xs font-medium mb-1.5">Cars</label>
              <Select
                value={carActivityFilter}
                onValueChange={(v) => {
                  setCarActivityFilter(v as "all" | "active" | "inactive");
                  setIsFilter(true);
                }}
              >
                <SelectTrigger className="bg-background border-border text-foreground w-[104px] h-9 focus:ring-1 focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground min-w-[104px]">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col flex-1 min-w-[260px]" ref={carDropdownRef}>
              <label className="text-muted-foreground text-xs font-medium mb-1.5">Car</label>
              {/* Custom searchable car combobox */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setCarDropdownOpen((prev) => !prev);
                    setCarSearch("");
                  }}
                  className="flex items-center justify-between w-full h-9 px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                >
                  <span className="truncate">
                    {carFilter
                      ? (() => {
                          const c = carsList.find((c) => String(c.id) === carFilter);
                          if (!c) return "All Cars";
                          const nameYear = [c.makeModel, c.year ? String(c.year) : ""].filter(Boolean).join(" ");
                          const parts: string[] = [];
                          if (nameYear) parts.push(nameYear);
                          if (c.licensePlate) parts.push(`#${c.licensePlate}`);
                          if (c.vin) parts.push(c.vin);
                          return parts.join(" - ");
                        })()
                      : "All Cars"}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 ml-2 transition-transform duration-150 ${carDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {carDropdownOpen && (
                  <div
                    className="absolute z-50 top-full mt-1 w-full min-w-[320px] bg-card border border-border rounded-md shadow-lg overflow-hidden"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {/* Search input */}
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          autoFocus
                          type="text"
                          value={carSearch}
                          onChange={(e) => setCarSearch(e.target.value)}
                          placeholder="Search make, plate, VIN…"
                          className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-56 overflow-y-auto">
                      {/* All Cars option */}
                      {!carSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setCarFilter("");
                            setIsFilter(true);
                            setCarDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors ${!carFilter ? "text-primary font-medium" : "text-foreground"}`}
                        >
                          <span>All Cars</span>
                          {!carFilter && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                        </button>
                      )}

                      {(() => {
                        const lower = carSearch.toLowerCase();
                        const filtered = carsList.filter((c) => {
                          if (!lower) return true;
                          const nameYear = [c.makeModel, c.year ? String(c.year) : ""].filter(Boolean).join(" ").toLowerCase();
                          return (
                            nameYear.includes(lower) ||
                            (c.licensePlate || "").toLowerCase().includes(lower) ||
                            (c.vin || "").toLowerCase().includes(lower)
                          );
                        });

                        if (filtered.length === 0) {
                          return (
                            <p className="px-3 py-4 text-xs text-center text-muted-foreground">
                              No cars match "{carSearch}"
                            </p>
                          );
                        }

                        return filtered.map((c) => {
                          const nameYear = [c.makeModel, c.year ? String(c.year) : ""].filter(Boolean).join(" ");
                          const parts: string[] = [];
                          if (nameYear) parts.push(nameYear);
                          if (c.licensePlate) parts.push(`#${c.licensePlate}`);
                          if (c.vin) parts.push(c.vin);
                          const label = parts.join(" - ");
                          const isSelected = carFilter === String(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setCarFilter(String(c.id));
                                setIsFilter(true);
                                setCarDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors ${isSelected ? "text-primary font-medium" : "text-foreground"}`}
                            >
                              <span className="truncate pr-2">{label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="text-red-600 hover:text-red-700 hover:bg-red-500/10 h-9 font-medium"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Table card */}
        <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable table region */}
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="table-fixed w-full caption-bottom text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr>
                  <th className="h-11 px-3 text-left font-semibold text-foreground w-12 text-[11px] uppercase tracking-wider">#</th>
                  <th className="h-11 px-3 text-left font-semibold text-foreground w-24 text-[11px] uppercase tracking-wider">Status</th>
                  <th className="h-11 px-3 text-left font-semibold text-foreground w-36 text-[11px] uppercase tracking-wider">Client</th>
                  <th className="h-11 px-3 text-left font-semibold text-foreground w-28 whitespace-nowrap text-[11px] uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => setSortOrder((s) => s === "desc" ? "asc" : "desc")}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors group"
                      title={sortOrder === "desc" ? "Sorted: newest first — click to reverse" : "Sorted: oldest first — click to reverse"}
                    >
                      Date
                      <span className="flex flex-col -space-y-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <svg className={`w-2 h-2 ${sortOrder === "asc" ? "text-primary opacity-100" : ""}`} viewBox="0 0 8 4" fill="currentColor"><path d="M4 0L8 4H0z"/></svg>
                        <svg className={`w-2 h-2 ${sortOrder === "desc" ? "text-primary opacity-100" : ""}`} viewBox="0 0 8 4" fill="currentColor"><path d="M4 4L0 0h8z"/></svg>
                      </span>
                    </button>
                  </th>
                  <th className="h-11 px-3 text-left font-semibold text-foreground min-w-[180px] text-[11px] uppercase tracking-wider">Car</th>
                  <th className="h-11 px-3 text-right font-semibold text-foreground w-36 tabular-nums text-[11px] whitespace-nowrap uppercase tracking-wider">Car Owner Split</th>
                  <th className="h-11 px-3 text-right font-semibold text-foreground w-32 tabular-nums text-[11px] whitespace-nowrap uppercase tracking-wider">Paid Amount</th>
                  <th className="h-11 px-3 text-right font-semibold text-foreground w-32 tabular-nums text-[11px] whitespace-nowrap uppercase tracking-wider">Balance</th>
                  <th className="h-11 px-3 text-left font-semibold text-foreground w-24 text-[11px] uppercase tracking-wider">Ref #</th>
                  <th className="h-11 px-3 text-left font-semibold text-foreground w-28 whitespace-nowrap text-[11px] uppercase tracking-wider">Pmt Date</th>
                  <th className="h-11 px-3 text-center font-semibold text-foreground w-16 text-[11px] uppercase tracking-wider">Receipt</th>
                  <th className="h-11 px-3 text-left font-semibold text-foreground min-w-[120px] text-[11px] uppercase tracking-wider">Remarks</th>
                  <th className="h-11 px-3 text-center font-semibold text-foreground w-24 text-[11px] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingPayments ? (
                  <tr>
                    <td colSpan={13} className="text-center py-16 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : payments.length > 0 ? (
                  <>
                    {payments.map((payment, index) => {
                      const balance =
                        Number(payment.payments_amount_payout || 0) -
                        Number(payment.payments_amount || 0);
                      const balanceClass =
                        balance < 0
                          ? "text-red-600"
                          : balance > 0
                          ? "text-emerald-600"
                          : "text-muted-foreground";
                      return (
                        <tr
                          key={payment.payments_aid}
                          className="border-b border-border/60 hover:bg-muted/40 transition-colors"
                        >
                          <td className="px-3 py-3 text-muted-foreground text-xs align-middle">{(page - 1) * pageSize + index + 1}.</td>
                          <td className="px-3 py-3 align-middle">
                            <Badge
                              style={{
                                backgroundColor: payment.payment_status_color,
                                color: "#000",
                              }}
                              className="text-[10px] font-medium px-2 py-0.5 rounded"
                            >
                              {payment.payment_status_name}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-foreground text-xs align-middle">{payment.fullname}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground text-xs align-middle">{formatYearMonth(payment.payments_year_month)}</td>
                          <td className="px-3 py-3 text-muted-foreground text-xs align-middle leading-snug">
                            {formatVehicleInfo(payment)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              {payment.payments_has_income_expense === false && (
                                <span
                                  title="No Income & Expense data exists for this car/month, so the Car Owner Split is $0."
                                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                </span>
                              )}
                              <span className="text-primary font-semibold">
                                {formatCurrency(Number(payment.payments_amount || 0))}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-foreground text-xs whitespace-nowrap align-middle">
                            {formatCurrency(Number(payment.payments_amount_payout || 0))}
                          </td>
                          <td className={`px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap font-medium align-middle ${balanceClass}`}>
                            {formatCurrency(balance)}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground text-xs align-middle">{payment.payments_reference_number || "--"}</td>
                          <td className="px-3 py-3 text-muted-foreground whitespace-nowrap text-xs align-middle">{formatDate(payment.payments_invoice_date)}</td>
                          <td className="px-3 py-3 text-center align-middle">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setIsReceiptModalOpen(true);
                              }}
                              className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-7 w-7"
                              title="View receipt"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          </td>
                          <td className="px-3 py-3 max-w-[160px] truncate text-muted-foreground text-xs align-middle">
                            {payment.payments_remarks || "--"}
                          </td>
                          <td className="px-3 py-3 text-center align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setIsEditModalOpen(true);
                                }}
                                className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-7 w-7"
                                title="Edit payment"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setIsDeleteSingleModalOpen(true);
                                }}
                                className="text-muted-foreground hover:text-red-600 hover:bg-red-500/10 h-7 w-7"
                                title="Delete payment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-border bg-muted/50">
                      <td colSpan={5} className="px-3 py-3 text-right font-bold text-foreground text-xs uppercase tracking-wider">
                        Page Total
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-primary tabular-nums whitespace-nowrap text-xs">
                        {formatCurrency(totals.payable)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-primary tabular-nums whitespace-nowrap text-xs">
                        {formatCurrency(totals.payout)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-primary tabular-nums whitespace-nowrap text-xs">
                        {formatCurrency(totals.balance)}
                      </td>
                      <td colSpan={5}></td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={13} className="text-center py-16 text-muted-foreground">
                      No payment records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer pinned inside the card */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-border bg-card">
            <div className="text-xs text-muted-foreground">
              {totalPayments > 0 ? (
                <>
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {(page - 1) * pageSize + 1}
                  </span>
                  {"–"}
                  <span className="font-semibold text-foreground">
                    {Math.min(page * pageSize, totalPayments)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-foreground">{totalPayments}</span>{" "}
                  payment{totalPayments === 1 ? "" : "s"}
                </>
              ) : (
                <>No payments to display</>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Rows</Label>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(parseInt(v, 10))}
                >
                  <SelectTrigger className="bg-background border-border text-foreground w-[72px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {[10, 30, 50, 100, 200].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoadingPayments}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-3 bg-background border-border text-foreground hover:bg-muted disabled:opacity-40"
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground whitespace-nowrap px-2">
                  Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isLoadingPayments}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-3 bg-background border-border text-foreground hover:bg-muted disabled:opacity-40"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>

        {isAddModalOpen && (
          <Dialog open={true} onOpenChange={() => setIsAddModalOpen(false)}>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>Add Payments</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Select a month to create payments for all active client-car pairs. This
                  pulls car owner split from income/expense data.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Month</label>
                  <Input
                    type="month"
                    value={addYearMonth}
                    onChange={(e) => setAddYearMonth(e.target.value)}
                    className="bg-background border-border text-foreground focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>
                {toPayStatus.length === 0 && (
                  <p className="text-red-700 text-sm">
                    Warning: Payment status &quot;To Pay&quot; is required. Please configure
                    it in Payment Status settings.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-card border-border text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (addYearMonth) {
                      createByMonthMutation.mutate(addYearMonth);
                      setAddYearMonth("");
                    } else {
                      toast({ title: "Error", description: "Please select a month", variant: "destructive" });
                    }
                  }}
                  disabled={createByMonthMutation.isPending || toPayStatus.length === 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/80"
                >
                  {createByMonthMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Create"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {isEditModalOpen && selectedPayment && (
          <AddEditPaymentModal
            isOpen={true}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedPayment(null);
            }}
            payment={selectedPayment}
            carId={selectedPayment.payments_car_id}
            clientId={selectedPayment.payments_client_id}
          />
        )}

        {isCleanupModalOpen && (
          <Dialog open={isCleanupModalOpen} onOpenChange={setIsCleanupModalOpen}>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  Clean Orphan Payments
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Remove payment rows whose car has no Income &amp; Expense data
                  for that month. Rows with a non-zero Paid Amount are kept as
                  paid history.
                </DialogDescription>
              </DialogHeader>

              {cleanupOrphansMutation.isPending && !cleanupPreview ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning for orphan rows…
                </div>
              ) : cleanupPreview ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-3 divide-x divide-border">
                    <div className="px-4 py-3 text-center">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total orphans</div>
                      <div className="text-xl font-semibold text-foreground tabular-nums mt-1">
                        {cleanupPreview.totalOrphans}
                      </div>
                    </div>
                    <div className="px-4 py-3 text-center bg-red-500/5">
                      <div className="text-[11px] uppercase tracking-wider text-red-700">Will delete</div>
                      <div className="text-xl font-semibold text-red-700 tabular-nums mt-1">
                        {cleanupPreview.deleted}
                      </div>
                    </div>
                    <div className="px-4 py-3 text-center bg-emerald-500/5">
                      <div className="text-[11px] uppercase tracking-wider text-emerald-700">Will keep (paid)</div>
                      <div className="text-xl font-semibold text-emerald-700 tabular-nums mt-1">
                        {cleanupPreview.preserved}
                      </div>
                    </div>
                  </div>
                  {cleanupPreview.totalOrphans === 0 && (
                    <div className="px-4 py-3 text-center text-xs text-muted-foreground bg-muted/30 border-t border-border">
                      Nothing to clean — every payment has matching Income &amp; Expense data.
                    </div>
                  )}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCleanupModalOpen(false);
                    setCleanupPreview(null);
                  }}
                  className="bg-card border-border text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmCleanupOrphans}
                  disabled={
                    cleanupOrphansMutation.isPending ||
                    !cleanupPreview ||
                    cleanupPreview.deleted === 0
                  }
                  className="bg-red-500/20 text-red-700 border border-red-500/50 hover:bg-red-500/30"
                >
                  {cleanupOrphansMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Delete {cleanupPreview?.deleted ?? 0} row{cleanupPreview?.deleted === 1 ? "" : "s"}</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {isResetModalOpen && (
          <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  Reset All Payments
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  This will <span className="font-semibold text-red-600">delete every payment row</span>{" "}
                  (including Paid Amounts, references, receipts, and remarks) and
                  regenerate fresh rows from Income &amp; Expense. One payment is
                  created per (car, month) that has Income &amp; Expense data. Car
                  Owner Split is computed from I&amp;E &times; owner&nbsp;% at display
                  time. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-primary"
                    checked={resetIncludeInactive}
                    onChange={(e) => setResetIncludeInactive(e.target.checked)}
                  />
                  <span>
                    Include <span className="font-medium">inactive cars</span>{" "}
                    <span className="text-muted-foreground">
                      (useful for migrating legacy records from old software).
                    </span>
                  </span>
                </label>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Type <span className="font-mono text-red-600">DELETE ALL</span> to confirm
                  </label>
                  <Input
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="DELETE ALL"
                    className="bg-background border-border text-foreground focus-visible:ring-1 focus-visible:ring-red-500"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={resetAllMutation.isPending}
                  className="bg-card border-border text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    resetAllMutation.mutate({ includeInactive: resetIncludeInactive })
                  }
                  disabled={
                    resetConfirmText.trim() !== "DELETE ALL" ||
                    resetAllMutation.isPending
                  }
                  className="bg-red-500/20 text-red-700 border border-red-500/50 hover:bg-red-500/30"
                >
                  {resetAllMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Reset & Regenerate"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {isDeleteByMonthModalOpen && (
          <Dialog
            open={isDeleteByMonthModalOpen}
            onOpenChange={setIsDeleteByMonthModalOpen}
          >
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>Delete Payments by Month</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  This will delete all payments for the selected month. This action
                  cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Month</label>
                  <Input
                    type="month"
                    value={deleteYearMonth}
                    onChange={(e) => setDeleteYearMonth(e.target.value)}
                    className="bg-background border-border text-foreground focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteByMonthModalOpen(false)}
                  className="bg-card border-border text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    deleteYearMonth && deleteByMonthMutation.mutate(deleteYearMonth)
                  }
                  disabled={!deleteYearMonth || deleteByMonthMutation.isPending}
                  className="bg-red-500/20 text-red-700 border-red-500/50 hover:bg-red-500/30"
                >
                  {deleteByMonthMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {isDeleteSingleModalOpen && selectedPayment && (
          <Dialog
            open={isDeleteSingleModalOpen}
            onOpenChange={setIsDeleteSingleModalOpen}
          >
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>Delete Payment</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Are you sure you want to delete this payment?
                  <div className="mt-4 p-4 bg-card rounded-md">
                    <p>
                      <span className="text-muted-foreground">Date:</span>{" "}
                      {formatYearMonth(selectedPayment.payments_year_month)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Amount:</span>{" "}
                      {formatCurrency(selectedPayment.payments_amount)}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteSingleModalOpen(false)}
                  className="bg-card border-border text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => deleteSingleMutation.mutate(selectedPayment.payments_aid)}
                  disabled={deleteSingleMutation.isPending}
                  className="bg-red-500/20 text-red-700 border-red-500/50 hover:bg-red-500/30"
                >
                  {deleteSingleMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {isReceiptModalOpen && selectedPayment && (
          <PaymentReceiptModal
            isOpen={isReceiptModalOpen}
            onClose={() => {
              setIsReceiptModalOpen(false);
              setSelectedPayment(null);
            }}
            payment={selectedPayment}
          />
        )}

        {isImportModalOpen && (
          <Dialog
            open={true}
            onOpenChange={() => {
              setIsImportModalOpen(false);
              setImportFile(null);
              setImportResult(null);
              setIsImportDragOver(false);
            }}
          >
            <DialogContent className="bg-card border-border text-foreground max-w-lg p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-semibold">Import Payments</DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                      Bulk-import payment records from a spreadsheet.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-5 space-y-5">
                {/* Template download */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="w-9 h-9 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Import Template</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Use the provided columns so rows match correctly.
                    </p>
                  </div>
                  <a
                    href={buildApiUrl("/api/payments/import-template")}
                    download
                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors flex-shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                </div>

                {/* Dropzone / file picker */}
                {!importFile ? (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsImportDragOver(true);
                    }}
                    onDragLeave={() => setIsImportDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsImportDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        setImportFile(file);
                        setImportResult(null);
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                      isImportDragOver
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-muted/30 hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        setImportFile(e.target.files?.[0] || null);
                        setImportResult(null);
                      }}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        Click to browse or drag & drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Supports .xlsx, .xls, .csv · max 10 MB
                      </p>
                    </div>
                  </label>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-primary/40">
                    <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {importFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(importFile.size / 1024).toFixed(1)} KB · Ready to import
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setImportFile(null);
                        setImportResult(null);
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors flex-shrink-0"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Hint: how matching works */}
                <div className="text-[11px] text-muted-foreground leading-relaxed bg-muted/30 border border-border/60 rounded-md px-3 py-2">
                  <span className="font-medium text-foreground">How it works:</span>{" "}
                  The VIN embedded in the Car column is used to match each row to an
                  existing car. The Car Owner Split is auto-calculated from Income &amp;
                  Expense data (it does not need to be in the file).
                </div>

                {/* Results */}
                {importResult && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-2 divide-x divide-border">
                      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                            Imported
                          </p>
                          <p className="text-lg font-bold text-emerald-600 leading-tight">
                            {importResult.imported ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30">
                        <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                            Skipped
                          </p>
                          <p className="text-lg font-bold text-foreground leading-tight">
                            {importResult.skipped ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="border-t border-border bg-red-500/5 px-4 py-3">
                        <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {importResult.errors.length} error
                          {importResult.errors.length === 1 ? "" : "s"}
                        </p>
                        <ul className="text-xs text-red-600/90 space-y-1 max-h-32 overflow-y-auto pr-1">
                          {importResult.errors.map((err, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-red-600/50">·</span>
                              <span className="flex-1">{err}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setImportResult(null);
                  }}
                  className="bg-background border-border text-foreground hover:bg-muted"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    if (importFile) {
                      importMutation.mutate(importFile);
                    } else {
                      toast({
                        title: "No file selected",
                        description: "Please choose a .xlsx, .xls, or .csv file first.",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={!importFile || importMutation.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold min-w-[120px]"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AdminLayout>
  );
}
