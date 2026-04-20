import React, { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Edit, FileText, X, Calendar } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";
import { cn } from "@/lib/utils";
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

interface CarDetail {
  id: number;
  vin: string;
  makeModel: string;
  licensePlate?: string;
  year?: number;
  mileage: number;
  status: "ACTIVE" | "INACTIVE";
  clientId?: number | null;
  owner?: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone?: string | null;
  } | null;
}

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
  car_make_model: string;
  car_plate_number: string;
  car_vin_number: string;
  car_year: number;
  client_fname: string;
  client_lname: string;
  fullname: string;
}

interface PaymentStatus {
  payment_status_aid: number;
  payment_status_name: string;
  payment_status_color: string;
  payment_status_is_active: number;
}

const formatCurrency = (value: number): string => {
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value < 0) {
    return `($ ${formatted})`;
  }
  return `$ ${formatted}`;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
};

const formatYearMonth = (yearMonth: string): string => {
  try {
    const [year, month] = yearMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  } catch {
    return yearMonth;
  }
};

export default function PaymentsPage() {
  const [, params] = useRoute("/admin/cars/:id/payments");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : null;
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch user data to check role
  const { data: userData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const user = userData?.user;
  const isAdmin = user?.isAdmin === true;
  const isClient = user?.isClient === true;

  // Fetch car data
  const { data: carData, isLoading, error } = useQuery<{
    success: boolean;
    data: CarDetail;
  }>({
    queryKey: ["/api/cars", carId],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const url = buildApiUrl(`/api/cars/${carId}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch car");
      return response.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const car = carData?.data;

  // Fetch payment statuses
  const { data: statusesData } = useQuery<{
    success: boolean;
    data: PaymentStatus[];
  }>({
    queryKey: ["/api/payment-status"],
    queryFn: async () => {
      const url = buildApiUrl("/api/payment-status");
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch payment statuses");
      return response.json();
    },
  });

  const statuses = statusesData?.data || [];

  // Fetch payments for this car
  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery<{
    success: boolean;
    data: Payment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    count: number;
  }>({
    queryKey: ["/api/payments/car", carId, filterStatus, monthFilter, page, pageSize],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== "All") {
        params.append("status", filterStatus);
      }
      if (monthFilter) {
        params.append("yearMonth", monthFilter);
      }
      params.append("page", String(page));
      params.append("pageSize", String(pageSize));
      const url = `${buildApiUrl(`/api/payments/car/${carId}`)}?${params.toString()}`;
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
    enabled: !!carId,
  });

  const payments = paymentsData?.data || [];
  const totalPayments = paymentsData?.total || 0;
  const totalPages = paymentsData?.totalPages || 1;

  useEffect(() => {
    setPage(1);
  }, [filterStatus, monthFilter, pageSize, carId]);

  // Calculate totals
  const totals = payments.reduce(
    (acc, payment) => ({
      payable: acc.payable + parseFloat(payment.payments_amount.toString()),
      payout: acc.payout + parseFloat(payment.payments_amount_payout.toString()),
      balance: acc.balance + parseFloat(payment.payments_amount_balance.toString()),
    }),
    { payable: 0, payout: 0, balance: 0 }
  );

  // Delete mutation
  const deleteMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car", carId] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      toast({
        title: "Success",
        description: "Payment deleted successfully",
      });
      setIsDeleteModalOpen(false);
      setSelectedPayment(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsEditModalOpen(true);
  };

  const handleDelete = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsDeleteModalOpen(true);
  };

  const handleReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsReceiptModalOpen(true);
  };

  const handleClearFilters = () => {
    setFilterStatus("All");
    setMonthFilter("");
    setPage(1);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <CarDetailSkeleton />
      </AdminLayout>
    );
  }

  if (error || !car) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-red-700">Failed to load car details</p>
          <button
            onClick={() => setLocation("/cars")}
            className="mt-4 text-blue-700 hover:underline"
          >
            ← Back to Cars
          </button>
        </div>
      </AdminLayout>
    );
  }

  // Format vehicle information: Make Model Year - #Plate - VIN
  // Example: "Toyota Tacoma 2025 - #3AZ432 - 3TYLC5LN2ST030937"
  const formatVehicleInfo = (car: CarDetail): string => {
    if (!car) return "";
    
    const makeModel = car.makeModel || "";
    const year = car.year ? String(car.year) : "";
    const plate = car.licensePlate ? car.licensePlate.trim() : "";
    const vin = car.vin ? car.vin.trim() : "";
    
    const parts: string[] = [];
    if (makeModel && year) {
      parts.push(`${makeModel} ${year}`);
    } else if (makeModel) {
      parts.push(makeModel);
    }
    if (plate) {
      parts.push(`#${plate}`);
    }
    if (vin) {
      parts.push(vin);
    }
    return parts.length > 0 ? parts.join(" - ") : "";
  };

  const vehicleInfo = car ? formatVehicleInfo(car) : "";
  const ownerName = car?.owner
    ? `${car.owner.firstName} ${car.owner.lastName}`
    : "N/A";

  return (
    <AdminLayout>
      <div className="flex flex-col h-full overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => setLocation(`/admin/view-car/${carId}`)}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to View Car</span>
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">Payment History</h1>
              {(vehicleInfo || ownerName !== "N/A") && (
                <p className="text-sm text-muted-foreground mt-1">
                  {vehicleInfo && ownerName !== "N/A" ? (
                    <>
                      {vehicleInfo} -{" "}
                      {car?.clientId ? (
                        <button
                          onClick={() => setLocation(`/admin/clients/${car.clientId}`)}
                          className="text-primary hover:text-[#d4d570] hover:underline transition-colors cursor-pointer"
                        >
                          {ownerName}
                        </button>
                      ) : (
                        <span>{ownerName}</span>
                      )}
                    </>
                  ) : (
                    vehicleInfo || ownerName
                  )}
                </p>
              )}
            </div>
            {isAdmin && (
              <Button
                onClick={() => {
                  if (!car?.clientId) {
                    toast({
                      title: "Error",
                      description: "Cannot create payment: Car does not have an associated client. Please ensure the car is linked to a client.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setIsAddModalOpen(true);
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/80"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Payment
              </Button>
            )}
          </div>
        </div>

        {/* Payment History Section */}
        <div className="bg-card border border-border rounded-lg overflow-auto flex-1">
          <div className="p-4 sm:p-6">
            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <label className="text-muted-foreground text-sm">Status:</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="bg-card border-border text-foreground w-[140px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="All">All</SelectItem>
                    {statuses.map((status) => (
                      <SelectItem key={status.payment_status_aid} value={status.payment_status_name}>
                        {status.payment_status_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-muted-foreground text-sm">Month:</label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground pointer-events-none z-10" />
                <Input
                  type="month"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                    className="bg-card border-border text-foreground w-[180px] pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-moz-calendar-picker-indicator]:opacity-0"
                    style={{
                      colorScheme: 'dark',
                      paddingRight: '2.5rem'
                    }}
                  />
                </div>
              </div>

              {(filterStatus !== "All" || monthFilter) && (
                <Button
                  variant="ghost"
                  onClick={handleClearFilters}
                  className="text-red-700 hover:text-red-700 hover:bg-red-900/20"
                >
                  Clear Filters
                </Button>
              )}

              <div className="flex items-center gap-2 text-muted-foreground ml-auto">
                <span className="text-sm">Total: {totalPayments}</span>
              </div>
            </div>

            {/* Payment History Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-left text-foreground font-medium w-12">#</TableHead>
                    <TableHead className="text-left text-foreground font-medium">Status</TableHead>
                    <TableHead className="text-left text-foreground font-medium">Date</TableHead>
                    <TableHead className="text-left text-foreground font-medium">Payment Date</TableHead>
                    <TableHead className="text-right text-foreground font-medium">Payable</TableHead>
                    <TableHead className="text-right text-foreground font-medium">Payout</TableHead>
                    <TableHead className="text-right text-foreground font-medium">Balance</TableHead>
                    <TableHead className="text-left text-foreground font-medium">Ref #</TableHead>
                    <TableHead className="text-center text-foreground font-medium">Receipt</TableHead>
                    <TableHead className="text-left text-foreground font-medium">Remarks</TableHead>
                    {isAdmin && (
                      <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingPayments ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-12 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : payments.length > 0 ? (
                    <>
                      {payments.map((payment, index) => {
                        return (
                        <TableRow
                          key={payment.payments_aid}
                          className="border-border hover:bg-card transition-colors"
                        >
                          <TableCell className="text-left text-muted-foreground">
                            {index + 1}.
                          </TableCell>
                          <TableCell className="text-left">
                            <Badge
                              style={{
                                backgroundColor: payment.payment_status_color,
                                color: "#000",
                              }}
                              className="text-xs font-medium"
                            >
                              {payment.payment_status_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left text-foreground">
                            {formatYearMonth(payment.payments_year_month)}
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground">
                            {formatDate(payment.payments_invoice_date)}
                          </TableCell>
                          <TableCell className="text-right text-foreground">
                            {formatCurrency(payment.payments_amount)}
                          </TableCell>
                          <TableCell className="text-right text-foreground">
                            {formatCurrency(payment.payments_amount_payout)}
                          </TableCell>
                          <TableCell className="text-right text-foreground">
                            {formatCurrency(payment.payments_amount_balance)}
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground">
                            {payment.payments_reference_number || "--"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReceipt(payment)}
                              className="text-muted-foreground hover:text-primary"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground max-w-[200px] truncate" title={payment.payments_remarks || undefined}>
                            {payment.payments_remarks || "--"}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(payment)}
                                  className="text-muted-foreground hover:text-primary"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(payment)}
                                  className="text-muted-foreground hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                        );
                      })}
                      {/* Totals Row */}
                      <TableRow className="border-t-2 border-border bg-card/50">
                        <TableCell colSpan={4} className="text-right font-bold text-foreground">
                          Page Total:
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(totals.payable)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(totals.payout)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(totals.balance)}
                        </TableCell>
                        <TableCell colSpan={isAdmin ? 4 : 3}></TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                        <TableCell colSpan={isAdmin ? 11 : 10} className="text-center py-12 text-muted-foreground">
                        No payment records found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
              <div className="text-xs text-muted-foreground">
                {totalPayments > 0 ? (
                  <>
                    Showing{" "}
                    <span className="font-medium text-foreground">
                      {(page - 1) * pageSize + 1}
                    </span>
                    {"–"}
                    <span className="font-medium text-foreground">
                      {Math.min(page * pageSize, totalPayments)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-foreground">{totalPayments}</span>{" "}
                    payment{totalPayments === 1 ? "" : "s"}
                  </>
                ) : (
                  <>No payments to display</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(parseInt(v, 10))}
                >
                  <SelectTrigger className="bg-card border-border text-foreground w-[80px] h-8 text-xs">
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
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isLoadingPayments}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Page <span className="font-medium text-foreground">{page}</span> of{" "}
                  <span className="font-medium text-foreground">{totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || isLoadingPayments}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Add/Edit Payment Modal */}
        {(isAddModalOpen || isEditModalOpen) && (
          <AddEditPaymentModal
            isOpen={isAddModalOpen || isEditModalOpen}
            onClose={() => {
              setIsAddModalOpen(false);
              setIsEditModalOpen(false);
              setSelectedPayment(null);
            }}
            payment={selectedPayment}
            carId={carId || 0}
            clientId={car?.clientId || (selectedPayment ? selectedPayment.payments_client_id : 0)}
          />
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && selectedPayment && (
          <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle className="text-foreground">Delete Payment</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Are you sure you want to delete this payment record?
                  <div className="mt-4 p-4 bg-card rounded-md">
                    <p className="text-foreground">
                      <span className="text-muted-foreground">Date:</span> {formatYearMonth(selectedPayment.payments_year_month)}
                    </p>
                    <p className="text-foreground">
                      <span className="text-muted-foreground">Amount:</span> {formatCurrency(selectedPayment.payments_amount)}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="bg-card text-foreground hover:bg-muted border-border"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => deleteMutation.mutate(selectedPayment.payments_aid)}
                  disabled={deleteMutation.isPending}
                  className="bg-red-500/20 text-red-700 border-red-500/50 text-foreground hover:bg-red-500/30 text-red-700"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Receipt Modal */}
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
      </div>
    </AdminLayout>
  );
}

