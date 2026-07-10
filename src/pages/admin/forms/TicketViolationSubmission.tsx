/**
 * Ticket Violation Submission ("Ticket Violation Form")
 * Clients submit a violation ticket against one of their own cars. They pick the
 * car (only their own cars appear), the violation type, amount, and due date, and
 * optionally upload a copy of the ticket. Submissions land in Operations →
 * Ticket Violation with default status "New".
 */

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, FileWarning, UploadCloud, X, FileText } from "lucide-react";

interface CarOption {
  id: number;
  label: string;
}

export const VIOLATION_TYPES = [
  "Parking",
  "Speeding",
  "Red Light",
  "Toll",
  "Registration",
  "Other",
];

export default function TicketViolationSubmission() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    tv_car_id: "",
    tv_violation_type: "",
    tv_amount_due: "",
    tv_due_date: "",
  });
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);

  const acceptFile = (file: File | undefined | null) => {
    if (!file) return;
    const okType = /\.(jpe?g|png|webp|heic|heif|gif|pdf)$/i.test(file.name);
    if (!okType) {
      toast({ title: "Only image or PDF files are allowed", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large (max 10MB)", variant: "destructive" });
      return;
    }
    setTicketFile(file);
  };

  const { data: currentUserData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
  });

  const { data: carsData, isLoading: isLoadingCars } = useQuery({
    queryKey: ["/api/ticket-violations/cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/ticket-violations/cars"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
  });

  const cars: CarOption[] = carsData?.data ?? [];

  const submitMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("tv_car_id", String(Number(form.tv_car_id)));
      fd.append("tv_violation_type", form.tv_violation_type);
      fd.append("tv_amount_due", form.tv_amount_due);
      if (form.tv_due_date) fd.append("tv_due_date", form.tv_due_date);
      if (ticketFile) fd.append("ticket", ticketFile);
      const res = await fetch(buildApiUrl("/api/ticket-violations"), {
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
      queryClient.invalidateQueries({ queryKey: ["/api/ticket-violations/my"] });
      setSubmitted(true);
      toast({
        title: "Ticket violation submitted!",
        description: "Your submission has been sent for review.",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tv_car_id) return toast({ title: "Please select a car", variant: "destructive" });
    if (!form.tv_violation_type)
      return toast({ title: "Please select a violation type", variant: "destructive" });
    const amt = parseFloat(form.tv_amount_due);
    if (!form.tv_amount_due || Number.isNaN(amt) || amt < 0)
      return toast({ title: "Enter a valid amount", variant: "destructive" });
    submitMutation.mutate();
  };

  const handleReset = () => {
    setForm({
      tv_car_id: cars.length === 1 ? String(cars[0].id) : "",
      tv_violation_type: "",
      tv_amount_due: "",
      tv_due_date: "",
    });
    setTicketFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSubmitted(false);
  };

  const ownerName =
    [currentUserData?.user?.firstName, currentUserData?.user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    currentUserData?.user?.email ||
    "";

  if (submitted) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h3 className="text-lg font-semibold text-primary">
            Ticket Violation Submitted Successfully
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Your ticket violation has been submitted. You can track its status
            below.
          </p>
          <Button variant="outline" onClick={handleReset}>
            Submit Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
          <FileWarning className="h-5 w-5" />
          Ticket Violation Form
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Submit a ticket violation for one of your cars. An admin will review it
          and you can track the status below.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Submitter — current user, read-only */}
          <div className="space-y-1.5">
            <Label>Submitted By</Label>
            <Input
              value={ownerName}
              readOnly
              className="opacity-80 bg-muted cursor-default"
              placeholder="Your name"
            />
          </div>

          {/* Car selector — only the owner's own cars */}
          <div className="space-y-1.5">
            <Label htmlFor="tv_car_id">
              Car <span className="text-destructive">*</span>
            </Label>
            {isLoadingCars ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your cars…
              </div>
            ) : cars.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cars found on your account.
              </p>
            ) : (
              <Select
                value={form.tv_car_id}
                onValueChange={(v) => setForm((p) => ({ ...p, tv_car_id: v }))}
              >
                <SelectTrigger id="tv_car_id">
                  <SelectValue placeholder="Select a car" />
                </SelectTrigger>
                <SelectContent>
                  {cars.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Violation Type */}
          <div className="space-y-1.5">
            <Label htmlFor="tv_violation_type">
              Violation Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.tv_violation_type}
              onValueChange={(v) => setForm((p) => ({ ...p, tv_violation_type: v }))}
            >
              <SelectTrigger id="tv_violation_type">
                <SelectValue placeholder="Select a violation type" />
              </SelectTrigger>
              <SelectContent>
                {VIOLATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="tv_amount_due">
              Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                id="tv_amount_due"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="pl-7"
                value={form.tv_amount_due}
                onChange={(e) => setForm((p) => ({ ...p, tv_amount_due: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label htmlFor="tv_due_date">Due Date</Label>
            <Input
              id="tv_due_date"
              type="date"
              value={form.tv_due_date}
              onChange={(e) => setForm((p) => ({ ...p, tv_due_date: e.target.value }))}
            />
          </div>

          {/* Ticket copy upload / drag */}
          <div className="space-y-1.5">
            <Label>Copy of the Ticket</Label>
            {ticketFile ? (
              <div className="flex items-center justify-between rounded-md border border-primary/30 bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate">{ticketFile.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({(ticketFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    setTicketFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  acceptFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-primary/50"
                }`}
              >
                <UploadCloud className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-medium">Upload / Drag the ticket copy</p>
                <p className="text-xs text-muted-foreground">Image or PDF (max 10MB)</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.pdf,image/*,application/pdf"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              Clear
            </Button>
            <Button
              type="submit"
              disabled={submitMutation.isPending || cars.length === 0}
              className="min-w-[140px]"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting…
                </>
              ) : (
                "Submit Ticket Violation"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
