import React, { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileText, Image as ImageIcon, ExternalLink } from "lucide-react";

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
}

interface PaymentStatus {
  payment_status_aid: number;
  payment_status_name: string;
  payment_status_color: string;
  payment_status_is_active: number;
}

interface AddEditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  carId: number;
  clientId: number;
}

export function AddEditPaymentModal({
  isOpen,
  onClose,
  payment,
  carId,
  clientId,
}: AddEditPaymentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = payment !== null;

  // Parse existing receipt file IDs from payments_attachment JSON
  const existingReceiptIds: string[] = useMemo(() => {
    if (!payment?.payments_attachment) return [];
    try {
      const parsed = JSON.parse(payment.payments_attachment);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }, [payment?.payments_attachment]);

  // Form state
  const [yearMonth, setYearMonth] = useState("");
  const [statusId, setStatusId] = useState("");
  const [payable, setPayable] = useState("");
  const [payout, setPayout] = useState("");
  const [balance, setBalance] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Extract year and month from yearMonth
  const [year, month] = yearMonth ? yearMonth.split("-").map(Number) : [null, null];

  // Fetch income/expense data to calculate car owner split
  const { data: incomeExpenseData, isLoading: isLoadingIncomeExpense } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/income-expense", carId, year],
    queryFn: async () => {
      if (!year || !carId) throw new Error("Year or Car ID not set");
      const url = buildApiUrl(`/api/income-expense/${carId}/${year}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        // If income/expense not found, return empty data
        return { success: false, data: null };
      }
      return response.json();
    },
    enabled: !!yearMonth && !!carId && !!year,
  });

  const incomeExpenseDataValue = incomeExpenseData?.data;

  // Car Owner Split is computed server-side (computeCarMonthSplits, the sole
  // remaining implementation of the formula) and returned per month on the
  // I&E row as `computedCarOwnerSplit` — read it directly rather than
  // recomputing it here. `undefined` (field absent — the backend's own
  // try/catch around this computation failed) is distinguished from a
  // genuine `0`, so a computation error doesn't silently render as $0.00.
  const getComputedOwnerSplit = (monthNum: number): number | undefined => {
    const monthRow = incomeExpenseDataValue?.incomeExpenses?.find(
      (m: any) => m && m.month === monthNum
    );
    const value = monthRow?.computedCarOwnerSplit;
    return typeof value === "number" ? value : undefined;
  };

  // Initialize form with payment data (for edit mode)
  useEffect(() => {
    if (payment) {
      setYearMonth(payment.payments_year_month);
      setStatusId(payment.payments_status_id.toString());
      setPayable(payment.payments_amount.toString());
      setPayout(payment.payments_amount_payout.toString());
      setBalance(payment.payments_amount_balance.toString());
      setReferenceNumber(payment.payments_reference_number || "");
      
      // Format payment date for input field (YYYY-MM-DD)
      if (payment.payments_invoice_date) {
        const date = new Date(payment.payments_invoice_date);
        const formattedDate = date.toISOString().split('T')[0];
        setPaymentDate(formattedDate);
      } else {
        setPaymentDate("");
      }
      
      setRemarks(payment.payments_remarks || "");
      setReceiptFiles([]);
    } else {
      // Reset form for new payment
      const today = new Date();
      const defaultYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      setYearMonth(defaultYearMonth);
      setStatusId("");
      setPayable("0");
      setPayout("0");
      setBalance("0");
      setReferenceNumber("");
      setPaymentDate("");
      setRemarks("");
      setReceiptFiles([]);
    }
  }, [payment, isOpen]);

  // Auto-calculate balance when payout or payable changes
  useEffect(() => {
    const payoutNum = parseFloat(payout) || 0;
    const payableNum = parseFloat(payable) || 0;
    const balanceNum = payoutNum - payableNum;
    setBalance(balanceNum.toFixed(2));
  }, [payout, payable]);

  // Auto-fill Car Owner Split from I&E only when adding a new payment.
  // In edit mode the stored value is authoritative — do not overwrite it.
  useEffect(() => {
    if (isEdit) return;
    if (year && month && incomeExpenseData?.success && incomeExpenseData?.data) {
      const ownerSplit = getComputedOwnerSplit(month);
      // undefined (computation failed server-side) is left unset rather than
      // silently written as "0.00" — see #payable's error message in the JSX.
      if (ownerSplit !== undefined) {
        setPayable(ownerSplit.toFixed(2));
      }
    } else if (year && month && incomeExpenseData && !incomeExpenseData.success) {
      setPayable("0.00");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, incomeExpenseData?.success, incomeExpenseData?.data, year, month]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setReceiptFiles((prev) => [...prev, ...newFiles]);
    }
    // Reset input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove file from list
  const handleRemoveFile = (index: number) => {
    setReceiptFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = buildApiUrl("/api/payments");
      
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("paymentsClientId", data.paymentsClientId.toString());
      formData.append("paymentsStatusId", data.paymentsStatusId.toString());
      formData.append("paymentsCarId", data.paymentsCarId.toString());
      formData.append("paymentsYearMonth", data.paymentsYearMonth);
      formData.append("paymentsAmount", data.paymentsAmount.toString());
      formData.append("paymentsAmountPayout", data.paymentsAmountPayout.toString());
      formData.append("paymentsReferenceNumber", data.paymentsReferenceNumber || "");
      formData.append("paymentsInvoiceId", "");
      formData.append("paymentsInvoiceDate", data.paymentsInvoiceDate || "");
      formData.append("paymentsRemarks", data.paymentsRemarks || "");
      
      // Append receipt files
      if (data.receiptFiles && data.receiptFiles.length > 0) {
        data.receiptFiles.forEach((file: File) => {
          formData.append("receiptFiles", file);
        });
      }
      
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Failed to create payment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car", carId] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      toast({
        title: "Success",
        description: "Payment created successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payment",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!payment) throw new Error("No payment to update");
      const url = buildApiUrl(`/api/payments/${payment.payments_aid}`);
      
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("paymentsClientId", data.paymentsClientId.toString());
      formData.append("paymentsStatusId", data.paymentsStatusId.toString());
      formData.append("paymentsCarId", data.paymentsCarId.toString());
      formData.append("paymentsYearMonth", data.paymentsYearMonth);
      formData.append("paymentsAmount", data.paymentsAmount.toString());
      formData.append("paymentsAmountPayout", data.paymentsAmountPayout.toString());
      formData.append("paymentsReferenceNumber", data.paymentsReferenceNumber || "");
      formData.append("paymentsInvoiceId", "");
      formData.append("paymentsInvoiceDate", data.paymentsInvoiceDate || "");
      formData.append("paymentsRemarks", data.paymentsRemarks || "");
      
      // Append receipt files
      if (data.receiptFiles && data.receiptFiles.length > 0) {
        data.receiptFiles.forEach((file: File) => {
          formData.append("receiptFiles", file);
        });
      }
      
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Failed to update payment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car", carId] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/car"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/search"] });
      toast({
        title: "Success",
        description: "Payment updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!yearMonth) {
      toast({
        title: "Validation Error",
        description: "Please select a year/month",
        variant: "destructive",
      });
      return;
    }

    if (!statusId) {
      toast({
        title: "Validation Error",
        description: "Please select a payment status",
        variant: "destructive",
      });
      return;
    }

    if (!clientId || clientId === 0) {
      toast({
        title: "Validation Error",
        description: "Client ID is missing. Please ensure the car has an associated client.",
        variant: "destructive",
      });
      return;
    }

    if (!carId || carId === 0) {
      toast({
        title: "Validation Error",
        description: "Car ID is missing.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      paymentsClientId: clientId,
      paymentsStatusId: parseInt(statusId),
      paymentsCarId: carId,
      paymentsYearMonth: yearMonth,
      paymentsAmount: parseFloat(payable) || 0,
      paymentsAmountPayout: parseFloat(payout) || 0,
      paymentsReferenceNumber: referenceNumber || "",
      paymentsInvoiceId: "",
      paymentsInvoiceDate: paymentDate || null,
      paymentsRemarks: remarks || "",
      receiptFiles: receiptFiles,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const balanceNum = parseFloat(balance) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="bg-card border-border text-foreground max-w-3xl max-h-[92vh] overflow-y-auto p-0"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("[data-radix-select-content]")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-foreground text-xl font-semibold">
            {isEdit ? "Edit Payment" : "Add Payment"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? "Update the payment record. Car Owner Split is recalculated from Income & Expense."
              : "Create a new payment. Car Owner Split will auto-fill from Income & Expense for the chosen month."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {/* Section: Period & Status */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Period & Status
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="yearMonth" className="text-muted-foreground text-xs">
                  Year / Month <span className="text-red-700">*</span>
                </Label>
                <Input
                  id="yearMonth"
                  type="month"
                  value={yearMonth}
                  onChange={(e) => setYearMonth(e.target.value)}
                  disabled={isPending || isEdit}
                  className="bg-muted border-border text-foreground mt-1 h-10"
                  required
                />
              </div>
              <div>
                <Label htmlFor="status" className="text-muted-foreground text-xs">
                  Payment Status <span className="text-red-700">*</span>
                </Label>
                <Select value={statusId} onValueChange={setStatusId} disabled={isPending} modal={false}>
                  <SelectTrigger className="bg-card border-border text-foreground mt-1 h-10">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground z-[4100]">
                    {statuses.map((status) => (
                      <SelectItem
                        key={status.payment_status_aid}
                        value={status.payment_status_aid.toString()}
                      >
                        {status.payment_status_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Section: Amounts */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Amounts
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="payable" className="text-muted-foreground text-xs">
                  Car Owner Split
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="payable"
                    type="text"
                    value={payable}
                    readOnly
                    disabled={isPending || isLoadingIncomeExpense}
                    className="bg-background border-border text-foreground pl-7 h-10 cursor-not-allowed"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Owner split for this month (auto)
                </p>
              </div>

              <div>
                <Label htmlFor="payout" className="text-muted-foreground text-xs">
                  Paid Amount <span className="text-red-700">*</span>
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="payout"
                    type="number"
                    step="0.01"
                    value={payout}
                    onChange={(e) => setPayout(e.target.value)}
                    disabled={isPending}
                    className="bg-muted border-border text-foreground pl-7 h-10"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Amount paid to the car owner
                </p>
              </div>

              <div>
                <Label htmlFor="balance" className="text-muted-foreground text-xs">
                  Balance
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="balance"
                    type="text"
                    value={balance}
                    disabled
                    className={`bg-background border-border pl-7 h-10 font-semibold ${
                      balanceNum < 0
                        ? "text-red-500"
                        : balanceNum > 0
                        ? "text-emerald-500"
                        : "text-foreground"
                    }`}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Paid Amount − Car Owner Split
                </p>
              </div>
            </div>
            {isLoadingIncomeExpense && (
              <p className="text-xs text-muted-foreground">
                Loading Car Owner Split from Income & Expense…
              </p>
            )}
            {!isLoadingIncomeExpense && year && month && (!incomeExpenseData || !incomeExpenseData.success) && (
              <p className="text-xs text-yellow-700">
                Income & Expense not found for {year}-{String(month).padStart(2, "0")}. Car Owner Split set to $0.00.
              </p>
            )}
            {!isLoadingIncomeExpense && !isEdit && year && month && incomeExpenseData?.success &&
              getComputedOwnerSplit(month) === undefined && (
                <p className="text-xs text-red-700">
                  Car Owner Split could not be computed for {year}-{String(month).padStart(2, "0")}. Please enter it manually or try again.
                </p>
              )}
          </section>

          {/* Section: Reference */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reference
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="referenceNumber" className="text-muted-foreground text-xs">
                  Reference Number
                </Label>
                <Input
                  id="referenceNumber"
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  disabled={isPending}
                  className="bg-muted border-border text-foreground mt-1 h-10"
                  placeholder="e.g. Zelle #12345"
                />
              </div>
              <div>
                <Label htmlFor="paymentDate" className="text-muted-foreground text-xs">
                  Payment Date
                </Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  disabled={isPending}
                  className="bg-muted border-border text-foreground mt-1 h-10"
                />
              </div>
            </div>
          </section>

          {/* Section: Receipt */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Receipt
            </h4>

            {/* Existing receipts (edit mode) */}
            {existingReceiptIds.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Saved ({existingReceiptIds.length} file{existingReceiptIds.length !== 1 ? "s" : ""})
                </p>
                {existingReceiptIds.map((id, index) => {
                  const isLocal = id.startsWith("/uploads/") || id.startsWith("http");
                  const url = isLocal
                    ? (id.startsWith("http") ? id : buildApiUrl(id))
                    : buildApiUrl(`/api/payments/receipt/file-content?fileId=${encodeURIComponent(id)}`);
                  const isPdf = id.toLowerCase().endsWith(".pdf");
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-background border border-border rounded-md px-3 py-2"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isPdf ? (
                          <FileText className="w-4 h-4 text-[#D3BC8D] flex-shrink-0" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-[#D3BC8D] flex-shrink-0" />
                        )}
                        <span className="text-sm text-foreground truncate">
                          Receipt {index + 1}
                        </span>
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 ml-2 h-7 w-7 p-0 inline-flex items-center justify-center"
                        title="View file"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileChange}
              disabled={isPending}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
              className="w-full bg-muted border-dashed border-border text-foreground hover:bg-muted h-12"
            >
              <Upload className="w-4 h-4 mr-2" />
              {existingReceiptIds.length > 0
                ? receiptFiles.length > 0 ? "Add More Files" : "Add / Replace Receipt"
                : receiptFiles.length > 0 ? "Add More Files" : "Upload Receipt (PDF / image)"}
            </Button>

            {receiptFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {receiptFiles.length} file(s) selected
                </p>
                {receiptFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-background border border-border rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="w-4 h-4 text-[#D3BC8D] flex-shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#D3BC8D] flex-shrink-0" />
                      )}
                      <span className="text-sm text-foreground truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                      disabled={isPending}
                      className="text-red-700 hover:text-red-700 hover:bg-red-400/10 ml-2 h-7 w-7 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section: Remarks */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Remarks
            </h4>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isPending}
              className="bg-muted border-border text-foreground"
              placeholder="Add any notes about this payment…"
              rows={3}
            />
          </section>

          {/* Sticky footer actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border -mx-6 px-6 sticky bottom-0 bg-card">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="bg-muted text-foreground hover:bg-muted border-border"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/80 min-w-[140px]"
            >
              {isPending ? "Saving…" : isEdit ? "Update Payment" : "Create Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

