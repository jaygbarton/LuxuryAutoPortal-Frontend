/**
 * Employee Form: Income & Expense Receipt Submission
 * Income, Operating Expenses (Direct Delivery), COGS (Per Vehicle), Reimbursed Bills
 * COGS workflow: Select sub-category → Upload receipt → AI extracts date/cost, optionally VIN/plate
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Upload, Loader2 } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  income: "Income",
  directDelivery: "Operating Expenses (Direct Delivery)",
  cogs: "Operating Expenses (COGS - Per Vehicle)",
  reimbursedBills: "Reimbursed and Non-Reimbursed Bills",
};

type ExpenseFormSubmissionProps = {
  /** Pre-select category (e.g. from staff Forms list link). */
  initialCategory?: string;
  /** Pre-select field (e.g. from staff Forms list link). */
  initialField?: string;
};

export default function ExpenseFormSubmission({ initialCategory, initialField }: ExpenseFormSubmissionProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    submissionDate: new Date().toISOString().slice(0, 10),
    employeeId: "",
    carId: "",
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString(),
    category: initialCategory && ["income", "directDelivery", "cogs", "reimbursedBills"].includes(initialCategory) ? initialCategory : "directDelivery",
    field: initialField ?? "",
    amount: "",
    remarks: "",
  });
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [carSearch, setCarSearch] = useState("");
  const [carDropdownOpen, setCarDropdownOpen] = useState(false);
  const [isDraggingReceipts, setIsDraggingReceipts] = useState(false);
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  const [analyzedOnce, setAnalyzedOnce] = useState(false);

  const { data: optionsData, isLoading: optionsLoading } = useQuery({
    queryKey: ["/api/expense-form-submissions/options"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/expense-form-submissions/options"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch options");
      return res.json();
    },
  });

  const options = optionsData?.data || {};
  const employees = options.employees || [];
  const cars = options.cars || [];
  const currentEmployeeId = options.currentEmployeeId ?? null;
  const currentUser = options.currentUser || null;
  const isAdmin = options.isAdmin === true;
  const isEmployee = options.isEmployee === true;
  // When logged in as employee (non-admin), always show Employee Name as the logged-in user (default, required)
  const isEmployeeView = isEmployee && !isAdmin;
  const currentEmployeeName =
    isEmployeeView && currentEmployeeId
      ? (employees.find((e: { id: number }) => e.id === currentEmployeeId)?.name ?? currentUser?.displayName ?? "")
      : (isEmployeeView && currentUser?.displayName) ? currentUser.displayName : "";
  const categoryFields: Record<string, { value: string; label: string }[]> =
    options.categoryFields || {};
  const fieldOptions = categoryFields[formData.category] || [];

  useEffect(() => {
    // Don't clear field when category matches initial (e.g. staff form link with category+field)
    if (initialCategory && initialField && formData.category === initialCategory) return;
    setFormData((prev) => ({ ...prev, field: "" }));
  }, [formData.category, initialCategory, initialField]);

  // Apply initial category/field from URL or props (e.g. staff Forms list) once options are loaded
  useEffect(() => {
    if (!optionsData?.data?.categoryFields) return;
    const cat = initialCategory && ["income", "directDelivery", "cogs", "reimbursedBills"].includes(initialCategory) ? initialCategory : null;
    const fld = initialField?.trim() || null;
    if (!cat && !fld) return;
    setFormData((prev) => {
      const next = { ...prev };
      if (cat) next.category = cat;
      if (fld) next.field = fld;
      return next;
    });
  }, [optionsData?.data?.categoryFields, initialCategory, initialField]);

  // Derive Year and Month from Date of receipt (single source of truth)
  useEffect(() => {
    const d = formData.submissionDate ? new Date(formData.submissionDate) : new Date();
    if (isNaN(d.getTime())) return;
    setFormData((prev) => ({
      ...prev,
      year: d.getFullYear().toString(),
      month: (d.getMonth() + 1).toString(),
    }));
  }, [formData.submissionDate]);

  // Default Employee Name to logged-in employee (for both admin dropdown and employee view)
  useEffect(() => {
    if (!optionsData?.data) return;
    const list = optionsData.data.employees || [];
    if (currentEmployeeId) {
      const id = String(currentEmployeeId);
      const exists = list.some((e: { id: number }) => String(e.id) === id);
      if (exists) setFormData((prev) => (prev.employeeId === id ? prev : { ...prev, employeeId: id }));
      return;
    }
    // Fallback: match by display name (session "First Last" vs API "Last, First")
    const displayName = (currentUser?.displayName ?? "").trim();
    if (displayName && list.length > 0) {
      const parts = (s: string) => s.split(/\s+|,\s*/).map((p) => p.trim().toLowerCase()).filter(Boolean).sort();
      const displayParts = parts(displayName);
      const match = list.find((e: { name: string }) => {
        if (!e?.name) return false;
        const empParts = parts(e.name);
        return displayParts.length === empParts.length && displayParts.every((p, i) => p === empParts[i]);
      });
      if (match) {
        setFormData((prev) => (prev.employeeId === String(match.id) ? prev : { ...prev, employeeId: String(match.id) }));
        return;
      }
    }
    // Fallback: when only one employee in list, default to them (single-user scenario)
    if (list.length === 1) {
      const id = String(list[0].id);
      setFormData((prev) => (prev.employeeId === id ? prev : { ...prev, employeeId: id }));
    }
  }, [currentEmployeeId, currentUser?.displayName, optionsData]);

  // AI receipt extraction: analyze first image when added (COGS workflow - AI reads cost)
  const addReceiptFiles = useCallback(
    (newFiles: File[]) => {
      setReceiptFiles((prev) => {
        const combined = [...prev, ...newFiles];
        const firstImage = newFiles.find((f) => f.type.startsWith("image/"));
        if (firstImage && !analyzedOnce && combined.length >= 1) {
          setAnalyzedOnce(true);
          setIsAnalyzingReceipt(true);
          const fd = new FormData();
          fd.append("receipt", firstImage);
          fetch(buildApiUrl("/api/expense-form-submissions/receipt/analyze"), {
            method: "POST",
            credentials: "include",
            body: fd,
          })
            .then((r) => r.json())
            .then((data: { extracted?: boolean; date?: string | null; amount?: number | null; carId?: number | null }) => {
              if (data.extracted && data) {
                setFormData((f) => ({
                  ...f,
                  ...(data.date && { submissionDate: data.date }),
                  ...(typeof data.amount === "number" && data.amount >= 0 && { amount: data.amount.toFixed(2) }),
                  ...(data.carId && { carId: String(data.carId) }),
                }));
                if (data.date || data.amount || data.carId) {
                  toast({ title: "Receipt analyzed", description: "Date, amount, or car pre-filled from receipt. Please verify." });
                }
              }
            })
            .catch(() => {})
            .finally(() => setIsAnalyzingReceipt(false));
        }
        return combined;
      });
    },
    [analyzedOnce, toast]
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      const receiptUrls: string[] = [];
      let effectiveEmployeeIdForSubmit =
        formData.employeeId ||
        (currentEmployeeId != null ? String(currentEmployeeId) : "") ||
        (employees.length === 1 ? String((employees[0] as { id: number }).id) : "");
      if (!effectiveEmployeeIdForSubmit && isEmployeeView && (currentUser?.displayName ?? "").trim() && employees.length > 0) {
        const parts = (s: string) => s.split(/\s+|,\s*/).map((p) => p.trim().toLowerCase()).filter(Boolean).sort();
        const displayParts = parts((currentUser?.displayName ?? "").trim());
        const match = (employees as { id: number; name: string }[]).find((e) => {
          if (!e?.name) return false;
          const empParts = parts(e.name);
          return displayParts.length === empParts.length && displayParts.every((p, i) => p === empParts[i]);
        });
        if (match) effectiveEmployeeIdForSubmit = String(match.id);
      }
      if (receiptFiles.length > 0 && effectiveEmployeeIdForSubmit) {
        const fd = new FormData();
        receiptFiles.forEach((file) => fd.append("receipts", file));
        fd.append("employeeId", effectiveEmployeeIdForSubmit);
        const uploadRes = await fetch(buildApiUrl("/api/expense-form-submissions/receipts/upload"), {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || "Failed to upload receipt");
        }
        const uploadData = await uploadRes.json();
        if (uploadData.fileIds?.length) {
          receiptUrls.push(...uploadData.fileIds);
        }
      }
      const res = await fetch(buildApiUrl("/api/expense-form-submissions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submissionDate: formData.submissionDate,
          employeeId: parseInt(effectiveEmployeeIdForSubmit, 10),
          carId: parseInt(formData.carId),
          year: parseInt(formData.year),
          month: parseInt(formData.month),
          category: formData.category,
          field: formData.field,
          amount: parseFloat(formData.amount),
          receiptUrls: receiptUrls.length ? receiptUrls : undefined,
          remarks: formData.remarks || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit");
      }
      return res.json() as Promise<{ success: boolean; id: number; slackNotificationSent?: boolean }>;
    },
    onSuccess: (data) => {
      const slackSent = data?.slackNotificationSent === true;
      toast({
        title: "Submitted",
        description: slackSent
          ? "Expense receipt form submitted successfully. Slack notification sent. Awaiting admin approval."
          : "Expense receipt form submitted successfully. Awaiting admin approval. (Slack notification was not sent—check Admin → Settings → Slack channels.)",
      });
      setFormData({
        submissionDate: new Date().toISOString().slice(0, 10),
        employeeId:
          formData.employeeId ||
          (currentEmployeeId != null ? String(currentEmployeeId) : "") ||
          (employees.length === 1 ? String((employees[0] as { id: number }).id) : ""),
        carId: "",
        year: new Date().getFullYear().toString(),
        month: (new Date().getMonth() + 1).toString(),
        category: "directDelivery",
        field: "",
        amount: "",
        remarks: "",
      });
      setReceiptFiles([]);
      setAnalyzedOnce(false);
      queryClient.invalidateQueries({ queryKey: ["/api/expense-form-submissions"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Resolve employee: selected, API currentEmployeeId, single-employee list, or (in employee view) match by display name
    let effectiveEmployeeId =
      formData.employeeId ||
      (currentEmployeeId != null ? String(currentEmployeeId) : "") ||
      (employees.length === 1 ? String((employees[0] as { id: number }).id) : "");
    if (!effectiveEmployeeId && isEmployeeView && (currentUser?.displayName ?? "").trim() && employees.length > 0) {
      const parts = (s: string) => s.split(/\s+|,\s*/).map((p) => p.trim().toLowerCase()).filter(Boolean).sort();
      const displayParts = parts((currentUser?.displayName ?? "").trim());
      const match = (employees as { id: number; name: string }[]).find((e) => {
        if (!e?.name) return false;
        const empParts = parts(e.name);
        return displayParts.length === empParts.length && displayParts.every((p, i) => p === empParts[i]);
      });
      if (match) effectiveEmployeeId = String(match.id);
    }
    if (!effectiveEmployeeId) {
      toast({
        title: "Validation Error",
        description: isEmployeeView
          ? "Your account could not be matched to an employee record. Please contact an administrator."
          : "Please select an employee from the list.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.carId) {
      toast({
        title: "Validation Error",
        description: "Please select a car from the dropdown list (type to search, then click a result).",
        variant: "destructive",
      });
      return;
    }
    if (!formData.field) {
      toast({
        title: "Validation Error",
        description: "Please select an expense type.",
        variant: "destructive",
      });
      return;
    }
    const amountNum = parseFloat(formData.amount);
    if (!formData.amount || Number.isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount greater than 0.",
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate();
  };

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  if (optionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-border/50 pb-4">
        <CardTitle className="text-foreground flex items-center gap-2 text-xl font-semibold">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <DollarSign className="w-5 h-5" />
          </div>
          Income & Expense Receipt Submission
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Income, Operating Expenses (Direct Delivery), COGS (Per Vehicle), or Reimbursed Bills. For COGS, select the expense type then upload a receipt—AI can read the cost.
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-foreground font-medium text-sm">Date of receipt <span className="text-primary">*</span></Label>
            <Input
              type="date"
              value={formData.submissionDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, submissionDate: e.target.value }))
              }
              className="bg-background border-border/60 text-foreground h-10 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
            <p className="text-xs text-muted-foreground/80 mt-1.5">Year and Month are derived from this date.</p>
          </div>
            <div className="space-y-2">
              <Label className="text-foreground font-medium text-sm">Employee Name <span className="text-primary">*</span></Label>
              {isEmployeeView ? (
                <Input
                  readOnly
                  required
                  value={currentEmployeeName || "Loading…"}
                  className="bg-card border-border text-foreground mt-1 cursor-default"
                  title="Logged-in employee (required)"
                />
              ) : (
                <Select
                  value={formData.employeeId}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, employeeId: v }))}
                >
                  <SelectTrigger className="bg-background border-border/60 text-foreground h-10 focus:border-primary focus:ring-2 focus:ring-primary/20">
                    <SelectValue
                      placeholder={
                        currentUser?.displayName
                          ? `Select employee (defaults to ${currentUser.displayName})`
                          : "Select employee"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp: { id: number; name: string }) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="relative space-y-2">
            <Label className="text-foreground font-medium text-sm">Car <span className="text-primary">*</span></Label>
            <p className="text-xs text-muted-foreground/80">Type car name, VIN, or plate number to search.</p>
            {carSearch.trim() && !formData.carId && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Select a car from the list above to continue.</p>
            )}
            <Input
              value={
                carDropdownOpen
                  ? carSearch
                  : formData.carId
                    ? (cars as { id: number; name: string; displayName?: string }[]).find((c) => String(c.id) === formData.carId)?.displayName ??
                      (cars as { id: number; name: string }[]).find((c) => String(c.id) === formData.carId)?.name ??
                      ""
                    : carSearch
              }
              onChange={(e) => {
                setCarSearch(e.target.value);
                setCarDropdownOpen(true);
                if (!e.target.value) setFormData((prev) => ({ ...prev, carId: "" }));
              }}
              onFocus={() => setCarDropdownOpen(true)}
              onBlur={() => setTimeout(() => setCarDropdownOpen(false), 150)}
              placeholder="Type car name, VIN, or plate number..."
              className="bg-background border-border/60 text-foreground h-10 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {carDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-md border border-border/60 bg-background shadow-lg">
                {(cars as { id: number; name: string; displayName?: string; vin?: string | null; plate?: string | null }[])
                  .filter((car) => {
                    const q = carSearch.trim().toLowerCase();
                    if (!q) return true;
                    const name = ((car.displayName ?? car.name) || "").toLowerCase();
                    const vin = (car.vin ?? "").toLowerCase();
                    const plate = (car.plate ?? "").toLowerCase();
                    return name.includes(q) || vin.includes(q) || plate.includes(q);
                  })
                  .map((car) => (
                    <button
                      key={car.id}
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors first:rounded-t-lg last:rounded-b-lg"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFormData((prev) => ({ ...prev, carId: String(car.id) }));
                        setCarSearch(car.displayName ?? car.name);
                        setCarDropdownOpen(false);
                      }}
                    >
                      {car.displayName ?? car.name}
                    </button>
                  ))}
                {cars.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No cars loaded. Check connection.</div>
                ) : (cars as { id: number; name: string; displayName?: string; vin?: string | null; plate?: string | null }[]).filter((c) => {
                  const q = carSearch.trim().toLowerCase();
                  if (!q) return true;
                  const name = ((c.displayName ?? c.name) || "").toLowerCase();
                  const vin = (c.vin ?? "").toLowerCase();
                  const plate = (c.plate ?? "").toLowerCase();
                  return name.includes(q) || vin.includes(q) || plate.includes(q);
                }).length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No matching car. Try name, VIN, or plate.</div>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <Label className="text-foreground font-medium text-sm">Year</Label>
              <Input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData((prev) => ({ ...prev, year: e.target.value }))}
                className="bg-background border-border/60 text-foreground h-10 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-medium text-sm">Month</Label>
              <Select
                value={formData.month}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, month: v }))}
              >
                <SelectTrigger className="bg-background border-border/60 text-foreground h-10 focus:border-primary focus:ring-2 focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-medium text-sm">Amount ($) <span className="text-primary">*</span></Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                className="bg-background border-border/60 text-foreground h-10 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Category & Expense Type - COGS workflow: select sub-category first */}
          <div className="space-y-2">
            <Label className="text-foreground font-medium text-sm">Form Category <span className="text-primary">*</span></Label>
            <Select
              value={formData.category}
              onValueChange={(v) =>
                setFormData((prev) => ({ ...prev, category: v, field: "" }))
              }
            >
              <SelectTrigger className="bg-background border-border/60 text-foreground h-10 focus:border-primary focus:ring-2 focus:ring-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">{CATEGORY_LABELS.income}</SelectItem>
                <SelectItem value="directDelivery">
                  {CATEGORY_LABELS.directDelivery}
                </SelectItem>
                <SelectItem value="cogs">{CATEGORY_LABELS.cogs}</SelectItem>
                <SelectItem value="reimbursedBills">
                  {CATEGORY_LABELS.reimbursedBills}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground font-medium text-sm">
              {formData.category === "cogs" ? "Expense Type (e.g. Auto Body Shop / Wreck) *" : "Expense Type *"}
            </Label>
            <Select
              value={formData.field}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, field: v }))}
            >
              <SelectTrigger className="bg-background border-border/60 text-foreground h-10 focus:border-primary focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder={formData.category === "cogs" ? "Select expense type, then upload receipt" : "Select expense type"} />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map((f: { value: string; label: string }) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground font-medium text-sm">Upload Receipts</Label>
            <p className="text-xs text-muted-foreground/80">
              {formData.category === "cogs"
                ? "Drag or click to upload. AI will read date and cost from the receipt (if enabled)."
                : "Drag photos here or click to browse."}
            </p>
            <div
              className={`flex items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 transition-all cursor-pointer ${
                isDraggingReceipts
                  ? "border-primary bg-primary/5 shadow-md scale-[1.01]"
                  : "border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 hover:border-primary/60 hover:bg-primary/5 hover:shadow-sm"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingReceipts(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingReceipts(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingReceipts(false);
                const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
                const accepted = files.filter(
                  (f) => f.type.startsWith("image/") || f.name.toLowerCase().endsWith(".pdf")
                );
                if (accepted.length < files.length) {
                  toast({ title: "Some files were skipped. Only images and PDF are accepted.", variant: "default" });
                }
                addReceiptFiles(accepted);
              }}
              onClick={() => document.getElementById("expense-receipt-file-input")?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && document.getElementById("expense-receipt-file-input")?.click()}
            >
              <input
                id="expense-receipt-file-input"
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  addReceiptFiles(files);
                  e.target.value = "";
                }}
              />
              {isAnalyzingReceipt ? (
                <Loader2 className="w-6 h-6 text-primary animate-spin shrink-0" />
              ) : (
                <Upload className={`w-6 h-6 shrink-0 transition-colors ${isDraggingReceipts ? "text-primary" : "text-muted-foreground"}`} />
              )}
              <span className={`text-sm font-medium transition-colors ${isDraggingReceipts ? "text-primary" : "text-foreground"}`}>
                {isAnalyzingReceipt ? "Analyzing receipt..." : receiptFiles.length > 0 ? `${receiptFiles.length} file(s) chosen` : "Choose files"}
              </span>
            </div>
            {receiptFiles.length > 0 && (
              <p className="text-xs text-muted-foreground/80 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                {receiptFiles.length} file(s) selected
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-foreground font-medium text-sm">Remarks</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
              className="bg-background border-border/60 text-foreground min-h-[100px] focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              placeholder="Optional notes..."
            />
          </div>

          <div className="pt-2">
          <Button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all font-medium px-8 h-11"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Submit
          </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
