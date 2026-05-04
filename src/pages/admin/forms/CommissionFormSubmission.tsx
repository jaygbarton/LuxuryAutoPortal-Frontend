/**
 * Commission Form Submission
 * Employee submits a commission claim with receipt upload.
 * Car name uses the same searchable dropdown as the Income & Expense form.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, X, FileText, DollarSign, CheckCircle } from "lucide-react";

interface Car {
  id: number;
  name: string;
  vin: string | null;
  plate: string | null;
}

interface OptionsData {
  employees: { id: number; name: string }[];
  cars: Car[];
  currentEmployeeId: number | null;
  isAdmin: boolean;
  isEmployee: boolean;
  currentUser: { displayName: string };
}

export default function CommissionFormSubmission() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    cf_commission_date: new Date().toISOString().slice(0, 10),
    cf_commission_type: "",
    cf_total_receipt_cost: "",
    cf_remarks: "",
  });

  // Car search state (same pattern as ExpenseFormSubmission)
  const [carSearch, setCarSearch] = useState("");
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [selectedCarName, setSelectedCarName] = useState("");
  const [carDropdownOpen, setCarDropdownOpen] = useState(false);

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: optionsData, isLoading: optionsLoading } = useQuery({
    queryKey: ["/api/commission-forms/options"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/commission-forms/options"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch options");
      return res.json();
    },
  });

  const options: OptionsData = optionsData?.data ?? {
    employees: [],
    cars: [],
    currentEmployeeId: null,
    isAdmin: false,
    isEmployee: false,
    currentUser: { displayName: "" },
  };

  const cars: Car[] = options.cars ?? [];

  const filteredCars = cars.filter((car) => {
    const q = carSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      car.name.toLowerCase().includes(q) ||
      (car.vin ?? "").toLowerCase().includes(q) ||
      (car.plate ?? "").toLowerCase().includes(q)
    );
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const carNameToSubmit = selectedCarName || carSearch.trim();

      const fd = new FormData();
      fd.append("cf_commission_date", form.cf_commission_date);
      fd.append("cf_commission_type", form.cf_commission_type.trim());
      fd.append("cf_car_name", carNameToSubmit);
      fd.append("cf_total_receipt_cost", form.cf_total_receipt_cost);
      fd.append("cf_remarks", form.cf_remarks.trim());
      if (receiptFile) fd.append("receipt", receiptFile);

      const res = await fetch(buildApiUrl("/api/commission-forms"), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-forms/my"] });
      setSubmitted(true);
      toast({ title: "Commission form submitted!", description: "Your form has been submitted for review." });
    },
    onError: (err: Error) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileChange = (file: File | null) => {
    if (!file) { setReceiptFile(null); setReceiptPreview(null); return; }
    setReceiptFile(file);
    setReceiptPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cf_commission_date) return toast({ title: "Commission date required", variant: "destructive" });
    if (!form.cf_commission_type.trim()) return toast({ title: "Commission type required", variant: "destructive" });
    const carNameToSubmit = selectedCarName || carSearch.trim();
    if (!carNameToSubmit) return toast({ title: "Car name required", variant: "destructive" });
    if (!form.cf_total_receipt_cost || parseFloat(form.cf_total_receipt_cost) <= 0) {
      return toast({ title: "Total receipt cost required", variant: "destructive" });
    }
    submitMutation.mutate();
  };

  const handleReset = () => {
    setForm({ cf_commission_date: new Date().toISOString().slice(0, 10), cf_commission_type: "", cf_total_receipt_cost: "", cf_remarks: "" });
    setCarSearch("");
    setSelectedCarId(null);
    setSelectedCarName("");
    setReceiptFile(null);
    setReceiptPreview(null);
    setSubmitted(false);
  };

  if (optionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h3 className="text-lg font-semibold text-primary">Form Submitted Successfully</h3>
          <p className="text-sm text-muted-foreground text-center">
            Your commission form has been submitted and is pending review by an admin.
          </p>
          <Button variant="outline" onClick={handleReset}>Submit Another</Button>
        </CardContent>
      </Card>
    );
  }

  const employeeName = options.currentEmployeeId
    ? options.employees.find((e) => e.id === options.currentEmployeeId)?.name ?? options.currentUser.displayName
    : options.currentUser.displayName;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Commission Form
        </CardTitle>
        {employeeName && (
          <p className="text-sm text-muted-foreground">
            Submitting as: <span className="font-medium text-foreground">{employeeName}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Row 1: Commission Date + Commission Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cf_commission_date">
                Commission Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cf_commission_date"
                type="date"
                value={form.cf_commission_date}
                onChange={(e) => setForm((p) => ({ ...p, cf_commission_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf_commission_type">
                Commission Type <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cf_commission_type"
                placeholder="e.g. Car Sale, Referral, Lease..."
                value={form.cf_commission_type}
                onChange={(e) => setForm((p) => ({ ...p, cf_commission_type: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Car Name — searchable dropdown */}
          <div className="relative space-y-1.5">
            <Label>
              Car Name <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">Type car name, VIN, or plate number to search.</p>
            {carSearch.trim() && !selectedCarId && (
              <p className="text-xs text-amber-600">Select a car from the list to continue.</p>
            )}
            <Input
              value={carDropdownOpen ? carSearch : selectedCarId ? selectedCarName : carSearch}
              onChange={(e) => {
                setCarSearch(e.target.value);
                setCarDropdownOpen(true);
                if (!e.target.value) { setSelectedCarId(null); setSelectedCarName(""); }
              }}
              onFocus={() => setCarDropdownOpen(true)}
              onBlur={() => setTimeout(() => setCarDropdownOpen(false), 150)}
              placeholder="Type car name, VIN, or plate number..."
            />
            {carDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-md border border-border bg-background shadow-lg">
                {filteredCars.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {cars.length === 0 ? "No cars loaded. Check connection." : "No matching car. Try name, VIN, or plate."}
                  </div>
                ) : (
                  filteredCars.map((car) => (
                    <button
                      key={car.id}
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedCarId(car.id);
                        setSelectedCarName(car.name);
                        setCarSearch(car.name);
                        setCarDropdownOpen(false);
                      }}
                    >
                      {car.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Total Receipt Cost */}
          <div className="space-y-1.5">
            <Label htmlFor="cf_total_receipt_cost">
              Total Receipt Cost <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                id="cf_total_receipt_cost"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className="pl-7"
                value={form.cf_total_receipt_cost}
                onChange={(e) => setForm((p) => ({ ...p, cf_total_receipt_cost: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <Label htmlFor="cf_remarks">Remarks</Label>
            <Textarea
              id="cf_remarks"
              placeholder="Additional notes or comments..."
              rows={3}
              value={form.cf_remarks}
              onChange={(e) => setForm((p) => ({ ...p, cf_remarks: e.target.value }))}
            />
          </div>

          {/* Receipt Upload */}
          <div className="space-y-1.5">
            <Label>Upload Receipt</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("receipt-upload-cf")?.click()}
            >
              {receiptFile ? (
                <div className="flex flex-col items-center gap-2">
                  {receiptPreview ? (
                    <img src={receiptPreview} alt="Receipt preview" className="max-h-32 rounded object-contain" />
                  ) : (
                    <FileText className="h-10 w-10 text-primary" />
                  )}
                  <p className="text-sm font-medium text-foreground">{receiptFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(receiptFile.size / 1024).toFixed(1)} KB</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive gap-1"
                    onClick={(e) => { e.stopPropagation(); handleFileChange(null); }}
                  >
                    <X className="h-3 w-3" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <p className="text-sm font-medium">Drop file here or click to upload</p>
                  <p className="text-xs">JPEG, PNG, PDF up to 10MB</p>
                </div>
              )}
            </div>
            <input
              id="receipt-upload-cf"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={submitMutation.isPending} className="min-w-[140px]">
              {submitMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
              ) : "Submit Form"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
