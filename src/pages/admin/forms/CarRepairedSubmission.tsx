/**
 * Car Repaired Submission ("Car Repaired Form")
 * Staff log a completed vehicle repair: pick the car, repair completion
 * date, repair type, optional notes, photos of the repaired vehicle, and
 * repair receipts/invoices. Submissions land in Operations → Car Repaired.
 */

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle,
  Wrench,
  UploadCloud,
  X,
  FileText,
  Image as ImageIcon,
  ChevronsUpDown,
  Check,
} from "lucide-react";

interface CarOption {
  id: number;
  label: string;
  plate: string | null;
  vin: string | null;
}

export const REPAIR_TYPES = [
  "Body / Collision",
  "Mechanical",
  "Electrical",
  "Tires / Wheels",
  "Glass / Windshield",
  "Interior",
  "Detailing",
  "Other",
];

const ACCEPT_PHOTO = ".jpg,.jpeg,.png,.webp,.heic,.heif,.gif,image/*";
const ACCEPT_RECEIPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.pdf,image/*,application/pdf";

function acceptOk(file: File, kind: "photo" | "receipt"): boolean {
  const re = kind === "photo" ? /\.(jpe?g|png|webp|heic|heif|gif)$/i : /\.(jpe?g|png|webp|heic|heif|gif|pdf)$/i;
  return re.test(file.name);
}

export default function CarRepairedSubmission() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    cr_car_id: "",
    cr_repair_completion_date: "",
    cr_repair_type: "",
    cr_repair_type_other: "",
    cr_repair_notes: "",
  });
  const [carPickerOpen, setCarPickerOpen] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [photoDragActive, setPhotoDragActive] = useState(false);
  const [receiptDragActive, setReceiptDragActive] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);

  const addFiles = (
    incoming: FileList | File[] | undefined | null,
    kind: "photo" | "receipt",
    setFiles: React.Dispatch<React.SetStateAction<File[]>>
  ) => {
    if (!incoming) return;
    const accepted: File[] = [];
    for (const file of Array.from(incoming)) {
      if (!acceptOk(file, kind)) {
        toast({ title: `Only image${kind === "receipt" ? " or PDF" : ""} files are allowed`, variant: "destructive" });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large (max 10MB)", variant: "destructive" });
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
  };

  const { data: currentUserData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
  });

  const { data: carsData, isLoading: isLoadingCars } = useQuery({
    queryKey: ["/api/car-repaired/cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/car-repaired/cars"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
  });

  const cars: CarOption[] = carsData?.data ?? [];
  const selectedCar = cars.find((c) => String(c.id) === form.cr_car_id);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("cr_car_id", String(Number(form.cr_car_id)));
      fd.append("cr_repair_completion_date", form.cr_repair_completion_date);
      fd.append(
        "cr_repair_type",
        form.cr_repair_type === "Other" ? form.cr_repair_type_other.trim() : form.cr_repair_type
      );
      if (form.cr_repair_notes) fd.append("cr_repair_notes", form.cr_repair_notes);
      photoFiles.forEach((f) => fd.append("photos", f));
      receiptFiles.forEach((f) => fd.append("receipts", f));

      const res = await fetch(buildApiUrl("/api/car-repaired"), {
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
      queryClient.invalidateQueries({ queryKey: ["/api/car-repaired/my"] });
      setSubmitted(true);
      toast({
        title: "Car repaired logged!",
        description: "Your submission has been recorded in Operations.",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cr_car_id) return toast({ title: "Please select a car", variant: "destructive" });
    if (!form.cr_repair_completion_date)
      return toast({ title: "Please enter the repair completion date", variant: "destructive" });
    if (!form.cr_repair_type) return toast({ title: "Please select a repair type", variant: "destructive" });
    if (form.cr_repair_type === "Other" && !form.cr_repair_type_other.trim())
      return toast({ title: "Please describe the repair type", variant: "destructive" });
    submitMutation.mutate();
  };

  const handleReset = () => {
    setForm({
      cr_car_id: "",
      cr_repair_completion_date: "",
      cr_repair_type: "",
      cr_repair_type_other: "",
      cr_repair_notes: "",
    });
    setPhotoFiles([]);
    setReceiptFiles([]);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (receiptInputRef.current) receiptInputRef.current.value = "";
    setSubmitted(false);
  };

  const submitterName =
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
          <h3 className="text-lg font-semibold text-primary">Car Repaired Submitted Successfully</h3>
          <p className="text-sm text-muted-foreground text-center">
            The repair has been logged and now appears in Operations → Car Repaired.
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
          <Wrench className="h-5 w-5" />
          Car Repaired Form
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Log a completed repair so the vehicle can be tracked and prepped for relisting.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Submitter — current user, read-only */}
          <div className="space-y-1.5">
            <Label>Submitted By</Label>
            <Input
              value={submitterName}
              readOnly
              className="opacity-80 bg-muted cursor-default"
              placeholder="Your name"
            />
          </div>

          {/* Car selector */}
          <div className="space-y-1.5">
            <Label htmlFor="cr_car_id">
              Vehicle <span className="text-destructive">*</span>
            </Label>
            {isLoadingCars ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading vehicles…
              </div>
            ) : cars.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vehicles found.</p>
            ) : (
              <Popover open={carPickerOpen} onOpenChange={setCarPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="cr_car_id"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={carPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{selectedCar ? selectedCar.label : "Select a vehicle"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name, plate, or VIN…" />
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
                              setForm((p) => ({ ...p, cr_car_id: String(c.id) }));
                              setCarPickerOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                form.cr_car_id === String(c.id) ? "opacity-100 text-primary" : "opacity-0"
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
            )}
          </div>

          {/* Repair completion date */}
          <div className="space-y-1.5">
            <Label htmlFor="cr_repair_completion_date">
              Repair Completion Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cr_repair_completion_date"
              type="date"
              value={form.cr_repair_completion_date}
              onChange={(e) => setForm((p) => ({ ...p, cr_repair_completion_date: e.target.value }))}
              required
            />
          </div>

          {/* Repair type */}
          <div className="space-y-1.5">
            <Label htmlFor="cr_repair_type">
              Repair Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.cr_repair_type}
              onValueChange={(v) => setForm((p) => ({ ...p, cr_repair_type: v }))}
            >
              <SelectTrigger id="cr_repair_type">
                <SelectValue placeholder="Select a repair type" />
              </SelectTrigger>
              <SelectContent>
                {REPAIR_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.cr_repair_type === "Other" && (
              <Input
                className="mt-2"
                placeholder="Describe the repair type"
                value={form.cr_repair_type_other}
                onChange={(e) => setForm((p) => ({ ...p, cr_repair_type_other: e.target.value }))}
              />
            )}
          </div>

          {/* Repair notes */}
          <div className="space-y-1.5">
            <Label htmlFor="cr_repair_notes">Repair Notes</Label>
            <Textarea
              id="cr_repair_notes"
              rows={3}
              placeholder="Optional notes about the repair"
              value={form.cr_repair_notes}
              onChange={(e) => setForm((p) => ({ ...p, cr_repair_notes: e.target.value }))}
            />
          </div>

          {/* Photos of the repaired vehicle */}
          <FileDropZone
            label="Photos of the Repaired Vehicle"
            hint="Image files (max 10MB each)"
            accept={ACCEPT_PHOTO}
            files={photoFiles}
            setFiles={setPhotoFiles}
            dragActive={photoDragActive}
            setDragActive={setPhotoDragActive}
            inputRef={photoInputRef}
            onFilesSelected={(fl) => addFiles(fl, "photo", setPhotoFiles)}
            icon={<ImageIcon className="h-7 w-7 text-muted-foreground" />}
          />

          {/* Repair receipts / invoices */}
          <FileDropZone
            label="Repair Receipts / Invoices"
            hint="Image or PDF (max 10MB each)"
            accept={ACCEPT_RECEIPT}
            files={receiptFiles}
            setFiles={setReceiptFiles}
            dragActive={receiptDragActive}
            setDragActive={setReceiptDragActive}
            inputRef={receiptInputRef}
            onFilesSelected={(fl) => addFiles(fl, "receipt", setReceiptFiles)}
            icon={<FileText className="h-7 w-7 text-muted-foreground" />}
          />

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
                "Submit Car Repaired"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FileDropZone({
  label,
  hint,
  accept,
  files,
  setFiles,
  dragActive,
  setDragActive,
  inputRef,
  onFilesSelected,
  icon,
}: {
  label: string;
  hint: string;
  accept: string;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  dragActive: boolean;
  setDragActive: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onFilesSelected: (files: FileList | File[]) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {files.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-md border border-primary/30 bg-muted/40 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          onFilesSelected(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
        }`}
      >
        <UploadCloud className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm font-medium">Upload / Drag files here</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onFilesSelected(e.target.files ?? []);
          e.target.value = "";
        }}
      />
    </div>
  );
}
