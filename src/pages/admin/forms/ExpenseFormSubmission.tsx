import { ServiceMileageReading } from '@/components/shared/ServiceMileageReading';
import type { ServiceWorkspace } from '@/lib/serviceWorkspace';
import { ServiceRecordDetailsFields, emptyServiceDetails } from './ServiceRecordDetailsFields';
import { optionKeywords } from "@/lib/select-search";
/**
 * Employee Form: Income & Expense Receipt Submission
 * Income, Operating Expenses (Direct Delivery), COGS (Per Vehicle), Reimbursed Bills,
 * Operating Expenses (Office Support — fleet-wide, no car)
 * COGS service workflow: select a form, read receipt locally, confirm values and submit for approval.
 */

import { useState, useEffect, useCallback, useRef, useMemo, useId } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { api } from "@/lib/api";
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
import { DollarSign, Upload, Loader2, X, FileText, Eye } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  income: "Income & Expenses",
  directDelivery: "Operating Expenses (Direct Delivery)",
  cogs: "Operating Expenses (COGS - Per Vehicle)",
  reimbursedBills: "Reimbursed and Non-Reimbursed Bills",
  officeSupport: "Operating Expenses (Office Support)",
};

const FORM_CATEGORIES = ["income", "directDelivery", "cogs", "reimbursedBills", "officeSupport"] as const;

type ExpenseFormSubmissionProps = {
  /** Pre-select category (e.g. from staff Forms list link). */
  initialCategory?: string;
  /** Pre-select field (e.g. from staff Forms list link). */
  initialField?: string;
  initialCarId?: number;
  initialServiceKind?: string;
  serviceOnly?: boolean;
  onSubmitted?: () => void;
};

export default function ExpenseFormSubmission({ initialCategory, initialField, initialCarId, initialServiceKind, serviceOnly = false, onSubmitted }: ExpenseFormSubmissionProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    submissionDate: new Date().toISOString().slice(0, 10),
    employeeId: "",
    carId: initialCarId ? String(initialCarId) : "",
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString(),
    category: initialCategory && (FORM_CATEGORIES as readonly string[]).includes(initialCategory) ? initialCategory : "directDelivery",
    field: initialField ?? "",
    amount: "",
    remarks: "",
  });
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  // Object URLs for previewing image receipts. Indexes align with receiptFiles;
  // non-image files get an empty string so PDF rows can still show a filename/icon.
  const [receiptPreviews, setReceiptPreviews] = useState<string[]>([]);
  const [carSearch, setCarSearch] = useState("");
  const [carDropdownOpen, setCarDropdownOpen] = useState(false);
  const [isDraggingReceipts, setIsDraggingReceipts] = useState(false);
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  const [analyzedOnce, setAnalyzedOnce] = useState(false);
  const [serviceDetails, setServiceDetails] = useState(emptyServiceDetails);
  const [valuesConfirmed, setValuesConfirmed] = useState(false);
  const [readerMessage, setReaderMessage] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const analysisSequence = useRef(0);
  const receiptInputId = useId();
  const uploadedReceipts = useRef<{ files: File[]; urls: string[] } | null>(null);

  const { data: optionsData, isLoading: optionsLoading } = useQuery({
    queryKey: ["/api/expense-form-submissions/options"],
    queryFn: async () => {
      return api.get<{ data?: Record<string, any> }>("/api/expense-form-submissions/options", {
        fallbackMessage: "Failed to fetch options",
      });
    },
  });

  const options = optionsData?.data || {};
  const employees = options.employees || [];
  const cars = options.cars || [];
  // Admin-requested standard label: "Car Name Model Year - Plate # - Vin #".
  // The submitted value is the car id (unchanged); this only affects display.
  const carLabel = (car: { name: string; displayName?: string; vin?: string | null; plate?: string | null }) =>
    (car.displayName ?? car.name)?.trim() || "";
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
  const categoryFields: Record<string, { value: string; label: string; serviceKind?: string | null }[]> =
    options.categoryFields || {};
  const fieldOptions = (categoryFields[formData.category] || []).filter(f => !serviceOnly || !!f.serviceKind);
  const serviceKind = formData.category === 'cogs' ? fieldOptions.find(f => f.value === formData.field)?.serviceKind : null;
  // Office Support is fleet-wide overhead: it files to the All Cars view, so
  // there is no car to pick (the server stores it under car_id 0).
  const isOfficeSupport = formData.category === "officeSupport";
  useEffect(() => { setValuesConfirmed(false); }, [formData, serviceDetails, receiptFiles]);
  useEffect(() => { analysisSequence.current++; setIsAnalyzingReceipt(false); }, [formData.field, formData.category]);


  const { data: serviceWorkspace } = useQuery({ queryKey: ['/api/service-workspace'], enabled: !!serviceKind && !!formData.carId, staleTime: 30_000, refetchInterval: serviceKind && formData.carId ? 60_000 : false, queryFn: () => api.get<ServiceWorkspace>('/api/service-workspace') });
  const currentMileage = serviceWorkspace?.cars.find(car => car.car_id === Number(formData.carId))?.currentMileage;

  // Tracks whether the deep-linked initial category/field has been applied yet.
  // Until it has, the "clear field on category change" effect below must NOT run,
  // otherwise it wipes the pre-selected sub-category before/while the apply
  // effect sets it — the root cause of "the link didn't change the form".
  const initialApplied = useRef(false);

  // The deep-link field value as resolved against the loaded options. A link can
  // arrive as either the form value ("db_2316") or the I&E table key
  // ("subcategory-2316"); normalize both to the dropdown's "db_<id>" value so
  // the Select actually matches an option and shows the right sub-category.
  const resolvedInitialField = useMemo(() => {
    const raw = initialField?.trim();
    if (!raw) return initialServiceKind ? categoryFields.cogs?.find(f => f.serviceKind === initialServiceKind)?.value ?? null : null;
    const m = raw.match(/(?:^db_|^subcategory-)(\d+)$/);
    return m ? `db_${m[1]}` : raw;
  }, [initialField, initialServiceKind, categoryFields.cogs]);

  const resolvedInitialCategory = useMemo(
    () =>
      initialCategory && (FORM_CATEGORIES as readonly string[]).includes(initialCategory)
        ? initialCategory
        : null,
    [initialCategory],
  );

  // Apply initial category/field from URL or props (e.g. staff Forms list) once
  // options are loaded. Runs exactly once per (category, field) so the user can
  // freely change the dropdown afterward without it snapping back.
  useEffect(() => {
    if (!optionsData?.data?.categoryFields) return;
    if (!resolvedInitialCategory && !resolvedInitialField) return;
    if (initialApplied.current) return;
    initialApplied.current = true;
    setFormData((prev) => {
      const next = { ...prev };
      if (resolvedInitialCategory) next.category = resolvedInitialCategory;
      if (resolvedInitialField) next.field = resolvedInitialField;
      return next;
    });
  }, [optionsData?.data?.categoryFields, resolvedInitialCategory, resolvedInitialField]);

  // Clear the field when the user changes category — but only AFTER the deep-link
  // has been applied (and never on the very first render that carries it), so a
  // pre-selected sub-category survives.
  const prevCategory = useRef(formData.category);
  useEffect(() => {
    if (prevCategory.current === formData.category) return;
    prevCategory.current = formData.category;
    // Guard: if this category change is the deep-link applying its category,
    // keep the field it just set.
    if (
      resolvedInitialField &&
      resolvedInitialCategory &&
      formData.category === resolvedInitialCategory &&
      formData.field === resolvedInitialField
    ) {
      return;
    }
    setFormData((prev) => ({ ...prev, field: "" }));
  }, [formData.category, formData.field, resolvedInitialCategory, resolvedInitialField]);

  // Derive Year and Month from Date of receipt (single source of truth)
  useEffect(() => {
    const parts = /^(\d{4})-(\d{2})-\d{2}$/.exec(formData.submissionDate);
    if (!parts) return;
    setFormData(prev => ({ ...prev, year: parts[1], month: String(Number(parts[2])) }));
  }, [formData.submissionDate]);

  // Warn when the derived accounting year isn't the current year — catches both a
  // bad OCR year and a manual typo before the expense is filed to the wrong year.
  const isOffCurrentYear =
    !!formData.year && Number(formData.year) !== new Date().getFullYear();

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

  // Keep preview object URLs in sync with receiptFiles and revoke old ones on cleanup
  // to avoid leaking blob URLs as the user adds/removes files.
  useEffect(() => {
    const urls = receiptFiles.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f) : ""
    );
    setReceiptPreviews(urls);
    return () => {
      urls.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [receiptFiles]);

  const removeReceiptFile = useCallback((index: number) => {
    analysisSequence.current++;
    setIsAnalyzingReceipt(false);
    setReceiptFiles((prev) => prev.filter((_, i) => i !== index));
    setAnalyzedOnce(false);
  }, []);

  const openReceiptFile = useCallback(
    (index: number) => {
      const file = receiptFiles[index];
      if (!file) return;
      const existing = receiptPreviews[index];
      const url = existing || URL.createObjectURL(file);
      window.open(url, "_blank", "noopener,noreferrer");
      // Only revoke the URL we created ad-hoc; previews are managed by the effect above.
      if (!existing) {
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    },
    [receiptFiles, receiptPreviews]
  );

  async function analyzeReceipt(file: File) {
    const sequence = ++analysisSequence.current;
    setIsAnalyzingReceipt(true); setReaderMessage('');
    if (serviceKind) {
      setFormData(prev => ({ ...prev, amount: '', submissionDate: '' }));
      setServiceDetails(emptyServiceDetails);
    }
    try {
      const fd = new FormData(); fd.append('receipt', file); fd.append('category', formData.category); fd.append('field', formData.field);
      const response = await fetch(buildApiUrl('/api/expense-form-submissions/receipt/analyze'), { method: 'POST', credentials: 'include', body: fd });
      const data = await response.json();
      if (sequence !== analysisSequence.current) return;
      if (!response.ok) throw new Error(data.error || 'Receipt could not be read.');
      setFormData(prev => ({ ...prev, ...(data.date && { submissionDate: data.date }), ...(typeof data.amount === 'number' && { amount: data.amount.toFixed(2) }), ...(!initialCarId && data.carId && { carId: String(data.carId) }) }));
      if (serviceKind === 'oil_change') setServiceDetails({ odometer: data.serviceOdometer != null ? String(data.serviceOdometer) : '', milesUntilNext: data.milesUntilNextService != null ? String(data.milesUntilNextService) : '', nextOdometer: data.nextServiceOdometer != null ? String(data.nextServiceOdometer) : '', nextDueDate: data.nextServiceDate || '' });
      setReaderMessage(data.needsManualEntry || !data.extracted ? 'Some receipt values could not be read reliably. Please fill in missing values manually.' : 'Receipt values suggested. Please double-check them against the receipt.');
    } catch (error) {
      if (sequence === analysisSequence.current) setReaderMessage(`${(error as Error).message} Please fill in the values manually.`);
    } finally { if (sequence === analysisSequence.current) setIsAnalyzingReceipt(false); }
  }
  function addReceiptFiles(files: File[]) {
    const accepted = files.filter(f => f.size <= 10 * 1024 * 1024);
    if (accepted.length !== files.length) toast({ title: 'Each receipt must be 10 MB or smaller.', variant: 'destructive' });
    const remaining = Math.max(0, 5 - receiptFiles.length);
    if (accepted.length > remaining) toast({ title: 'Upload up to five receipts per form.' });
    const added = accepted.slice(0, remaining);
    setReceiptFiles(prev => [...prev, ...added]);
    if (added.length && !analyzedOnce) { setAnalyzedOnce(true); void analyzeReceipt(added[0]); }
  }

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
      if (uploadedReceipts.current?.files === receiptFiles) receiptUrls.push(...uploadedReceipts.current.urls);
      else if (receiptFiles.length > 0 && effectiveEmployeeIdForSubmit) {
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
          uploadedReceipts.current = { files: receiptFiles, urls: [...receiptUrls] };
        }
      }
      const res = await fetch(buildApiUrl("/api/expense-form-submissions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submissionDate: formData.submissionDate,
          employeeId: parseInt(effectiveEmployeeIdForSubmit, 10),
          carId: isOfficeSupport ? 0 : parseInt(formData.carId),
          year: parseInt(formData.year),
          month: parseInt(formData.month),
          category: formData.category,
          field: formData.field,
          amount: parseFloat(formData.amount),
          receiptUrls: receiptUrls.length ? receiptUrls : undefined,
          remarks: formData.remarks || undefined,
          ...(serviceKind ? { serviceDetails: { requestId: requestId.current, valuesConfirmed, odometer: serviceDetails.odometer ? Number(serviceDetails.odometer) : null, milesUntilNext: serviceDetails.milesUntilNext ? Number(serviceDetails.milesUntilNext) : null, nextOdometer: serviceDetails.nextOdometer ? Number(serviceDetails.nextOdometer) : null, nextDueDate: serviceDetails.nextDueDate || null } } : {}),
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
        carId: initialCarId ? String(initialCarId) : "",
        year: new Date().getFullYear().toString(),
        month: (new Date().getMonth() + 1).toString(),
        category: "directDelivery",
        field: "",
        amount: "",
        remarks: "",
      });
      setReceiptFiles([]);
      setAnalyzedOnce(false); setServiceDetails(emptyServiceDetails); setValuesConfirmed(false); setReaderMessage('');
      requestId.current = crypto.randomUUID(); uploadedReceipts.current = null;
      queryClient.invalidateQueries({ queryKey: ['/api/service-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['/api/internal-calendar/events'] });
      onSubmitted?.();
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
    if (!isOfficeSupport && !formData.carId) {
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
    if (!formData.amount || !Number.isFinite(amountNum) || amountNum < 0 || (!serviceKind && amountNum === 0)) {
      toast({
        title: "Validation Error",
        description: serviceKind ? 'Enter the final service price, including $0 for free or warranty service.' : 'Please enter a valid amount greater than 0.',
        variant: "destructive",
      });
      return;
    }
    if (serviceKind && !valuesConfirmed) { toast({ title: 'Please double-check and confirm the receipt and service details.', variant: 'destructive' }); return; }
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
          Select a form and upload the receipt. Service forms use our server receipt reader to suggest the service date and final price. Review every value before submitting.
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-foreground font-medium text-sm">{serviceKind ? 'Service / receipt date' : 'Date of receipt'} <span className="text-primary">*</span></Label>
            <Input
              type="date"
              aria-label={serviceKind ? "Service / receipt date" : "Date of receipt"}
              value={formData.submissionDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, submissionDate: e.target.value }))
              }
              className="bg-background border-border/60 text-foreground h-10 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
            <p className="text-xs text-muted-foreground/80 mt-1.5">Year and Month are derived from this date.</p>
            {/* The receipt OCR has misread the year before (a Jul-2026 receipt came
                back as 2023), which silently filed the expense under the wrong
                accounting year. Surface it so it can't pass unnoticed. */}
            {isOffCurrentYear && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5 font-medium">
                ⚠ This receipt is dated {formData.year}, not {new Date().getFullYear()}. It will be
                filed under {formData.year}. Please confirm the date is correct.
              </p>
            )}
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
                      <SelectItem searchKeywords={optionKeywords(emp)} key={emp.id} value={String(emp.id)}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {isOfficeSupport ? (
          <div className="space-y-2">
            <Label className="text-foreground font-medium text-sm">Car</Label>
            <p className="text-xs text-muted-foreground/80">Office Support is a fleet-wide expense. No car is needed; approved receipts appear under Operating Expenses (Office Support) on the All Cars Income &amp; Expenses view.</p>
          </div>
          ) : (
          <div className="relative space-y-2">
            <Label className="text-foreground font-medium text-sm">Car <span className="text-primary">*</span></Label>
            <p className="text-xs text-muted-foreground/80">{initialCarId ? 'Vehicle selected from Service Due.' : 'Type car name, VIN, or plate number to search.'}</p>
            {serviceKind && formData.carId && <a href={`/admin/operations?tab=service-due&car=${formData.carId}`} className="inline-flex min-h-11 items-center text-xs underline">View this vehicle’s service history and due dates</a>}
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
              disabled={!!initialCarId}
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
                        setCarSearch(carLabel(car));
                        setCarDropdownOpen(false);
                      }}
                    >
                      {carLabel(car)}
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
          )}

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
                    <SelectItem searchKeywords={optionKeywords(m)} key={i} value={String(i + 1)}>
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
              disabled={serviceOnly}
              value={formData.category}
              onValueChange={(v) =>
                setFormData((prev) => ({ ...prev, category: v, field: "" }))
              }
            >
              <SelectTrigger className="bg-background border-border/60 text-foreground h-10 focus:border-primary focus:ring-2 focus:ring-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Only offer categories the server actually returned options
                    for. Admins get all five; employees get the restricted set
                    (income and office support omitted), so the dropdown never
                    shows a category that would have an empty Expense Type list. */}
                {FORM_CATEGORIES
                  .filter((cat) => (categoryFields[cat]?.length ?? 0) > 0)
                  .map((cat) => (
                    <SelectItem searchKeywords={optionKeywords(cat)} key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
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
                  <SelectItem searchKeywords={optionKeywords(f)} key={f.value} value={f.value}>
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
                ? "Upload a photo or PDF. The server reader suggests the service date and final price; oil forms also read next-service reminders."
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
              onClick={() => document.getElementById(receiptInputId)?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && document.getElementById(receiptInputId)?.click()}
            >
              <input
                id={receiptInputId}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.pdf"
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
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  {receiptFiles.length} file(s) selected — click a thumbnail to view, or the × to remove.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {receiptFiles.map((file, index) => {
                    const previewUrl = receiptPreviews[index];
                    const isImage = !!previewUrl;
                    return (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                        className="group relative rounded-lg border border-border/60 bg-background overflow-hidden shadow-sm hover:shadow-md hover:border-primary/60 transition-all"
                      >
                        <button
                          type="button"
                          onClick={() => openReceiptFile(index)}
                          className="block w-full text-left"
                          title={`View ${file.name}`}
                        >
                          {isImage ? (
                            <div className="relative aspect-square w-full bg-muted/30">
                              <img
                                src={previewUrl}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                                <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex aspect-square w-full items-center justify-center bg-muted/30 text-muted-foreground">
                              <FileText className="w-10 h-10" />
                            </div>
                          )}
                          <div className="px-2 py-1.5 border-t border-border/60">
                            <p className="text-xs text-foreground truncate" title={file.name}>
                              {file.name}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeReceiptFile(index);
                          }}
                          className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-background/90 text-destructive border border-border/60 shadow-sm opacity-80 hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          title="Remove file"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {(readerMessage || receiptFiles.length > 0) && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p role="status">{readerMessage || 'Please double-check all receipt values before submitting.'}</p><p className="mt-1 text-xs">The receipt reader can make mistakes. Check the date and final price, plus any mileage and next-service details. Missing values must be entered manually.</p><Button type="button" variant="outline" size="sm" className="mt-2" disabled={isAnalyzingReceipt || !receiptFiles.length} onClick={() => void analyzeReceipt(receiptFiles[0])}>Read receipt again</Button></div>}
          {serviceKind && <><ServiceMileageReading reading={currentMileage} /><p className="text-xs text-muted-foreground">Current mileage is a reference. For historical service, enter the odometer from that service receipt; it may differ from today’s reading.</p></>}
          {serviceKind && <ServiceRecordDetailsFields value={serviceDetails} onChange={setServiceDetails} oil={serviceKind === 'oil_change'} />}
          {serviceOnly && !fieldOptions.length && <p role="alert" className="text-sm text-destructive">No service forms are available for this account. Ask an administrator to review your form permissions.</p>}

          <div className="space-y-2">
            <Label className="text-foreground font-medium text-sm">Remarks</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
              className="bg-background border-border/60 text-foreground min-h-[100px] focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              placeholder="Optional notes..."
            />
          </div>

          {serviceKind && <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={valuesConfirmed} onChange={e => setValuesConfirmed(e.target.checked)} required />I checked the service date, final price and any next-service details against the receipt.</label>}
          <div className="pt-2">
          <Button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all font-medium px-8 h-11"
            disabled={submitMutation.isPending || isAnalyzingReceipt || (!!serviceKind && !valuesConfirmed)}
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
