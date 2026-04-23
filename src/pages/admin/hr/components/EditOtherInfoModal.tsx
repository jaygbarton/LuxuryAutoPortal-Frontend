import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { buildApiUrl, buildUploadApiUrl } from "@/lib/queryClient";
import { EmployeeDocumentImage } from "@/components/admin/EmployeeDocumentImage";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Archive, Image, Loader2, Upload } from "lucide-react";

const ACCEPT_DOCS = "image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf";

const HEAR_ABOUT_OPTIONS = [
  { value: "Friend/Refferal", label: "Friend/Referral" },
  { value: "KSL ad", label: "KSL ad" },
  { value: "Facebook ad", label: "Facebook ad" },
  { value: "Indeed ad", label: "Indeed ad" },
  { value: "Google ad", label: "Google ad" },
  { value: "other", label: "Other" },
];

interface FormValues {
  employee_hear_about_gla: string;
  employee_hear_about_gla_other?: string;
}

interface EditOtherInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    employee_aid: number;
    employee_hear_about_gla?: string | null;
    employee_driver_license_photo?: string | null;
    employee_car_insurance?: string | null;
  };
}

export function EditOtherInfoModal({ open, onOpenChange, employee }: EditOtherInfoModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const licenseInputRef = useRef<HTMLInputElement>(null);
  const insuranceInputRef = useRef<HTMLInputElement>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);

  const currentHearAbout = employee.employee_hear_about_gla || "";
  const isOther = !HEAR_ABOUT_OPTIONS.some((o) => o.value === currentHearAbout) && currentHearAbout;

  const form = useForm<FormValues>({
    defaultValues: {
      employee_hear_about_gla: isOther ? "other" : currentHearAbout,
      employee_hear_about_gla_other: isOther ? currentHearAbout : "",
    },
  });

  useEffect(() => {
    if (open) {
      const curr = employee.employee_hear_about_gla || "";
      const isOtherVal = !HEAR_ABOUT_OPTIONS.some((o) => o.value === curr) && curr;
      form.reset({
        employee_hear_about_gla: isOtherVal ? "other" : curr,
        employee_hear_about_gla_other: isOtherVal ? curr : "",
      });
    }
  }, [open, employee]);

  const watchHearAbout = form.watch("employee_hear_about_gla");

  const mutation = useMutation({
    mutationFn: async ({
      values,
      licenseFile: license,
      insuranceFile: insurance,
    }: {
      values: FormValues;
      licenseFile: File | null;
      insuranceFile: File | null;
    }) => {
      // 1. If documents are selected, upload them to Google Drive first
      const hasValidLicense = license && license instanceof File && license.size > 0;
      const hasValidInsurance = insurance && insurance instanceof File && insurance.size > 0;
      if (hasValidLicense || hasValidInsurance) {
        const fd = new FormData();
        if (hasValidLicense) fd.append("driver_license", license!, license!.name || "license.jpg");
        if (hasValidInsurance) fd.append("car_insurance", insurance!, insurance!.name || "insurance.jpg");
        const uploadRes = await fetch(buildUploadApiUrl(`/api/employees/${employee.employee_aid}/upload-documents`), {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error || err.message || "Failed to upload documents to Google Drive");
        }
      }
      // 2. Update other info (hear about GLA)
      const hearAbout =
        values.employee_hear_about_gla === "other"
          ? values.employee_hear_about_gla_other || ""
          : values.employee_hear_about_gla || "";
      const res = await fetch(buildApiUrl(`/api/employees/${employee.employee_aid}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employee_hear_about_gla: hearAbout }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
    },
    onSuccess: (_, { licenseFile: license, insuranceFile: insurance }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      const hadLicense = license && license instanceof File && license.size > 0;
      const hadInsurance = insurance && insurance instanceof File && insurance.size > 0;
      if (hadLicense) {
        setLicenseFile(null);
        if (licenseInputRef.current) licenseInputRef.current.value = "";
      }
      if (hadInsurance) {
        setInsuranceFile(null);
        if (insuranceInputRef.current) insuranceInputRef.current.value = "";
      }
      const hasDocs = hadLicense || hadInsurance;
      toast({
        title: "Success",
        description: hasDocs
          ? "Documents saved to Google Drive and other information updated successfully."
          : "Other information updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: FormValues) => {
    const license = licenseFile ?? licenseInputRef.current?.files?.[0] ?? null;
    const insurance = insuranceFile ?? insuranceInputRef.current?.files?.[0] ?? null;
    mutation.mutate({ values, licenseFile: license ?? null, insuranceFile: insurance ?? null });
  };

  const archiveLicenseMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("driver_license", file, file.name || "license.jpg");
      const res = await fetch(buildUploadApiUrl(`/api/employees/${employee.employee_aid}/upload-documents`), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to archive driver's license");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setLicenseFile(null);
      if (licenseInputRef.current) licenseInputRef.current.value = "";
      toast({ title: "Archived", description: "Driver's license archived to Google Drive." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const archiveInsuranceMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("car_insurance", file, file.name || "insurance.jpg");
      const res = await fetch(buildUploadApiUrl(`/api/employees/${employee.employee_aid}/upload-documents`), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to archive car insurance");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setInsuranceFile(null);
      if (insuranceInputRef.current) insuranceInputRef.current.value = "";
      toast({ title: "Archived", description: "Car insurance archived to Google Drive." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleArchiveLicense = () => {
    const file = licenseInputRef.current?.files?.[0] ?? licenseFile;
    if (file) archiveLicenseMutation.mutate(file);
    else toast({ title: "No file selected", description: "Please select a driver's license first.", variant: "destructive" });
  };

  const handleArchiveInsurance = () => {
    const file = insuranceInputRef.current?.files?.[0] ?? insuranceFile;
    if (file) archiveInsuranceMutation.mutate(file);
    else toast({ title: "No file selected", description: "Please select a car insurance document first.", variant: "destructive" });
  };

  const isAnyUploading = archiveLicenseMutation.isPending || archiveInsuranceMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border text-muted-foreground">
        <DialogHeader>
          <DialogTitle className="text-primary">Update Other Information</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employee_hear_about_gla"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">
                    How did you hear about Golden Luxury Auto?
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="bg-card border-border">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {HEAR_ABOUT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            {watchHearAbout === "other" && (
              <FormField
                control={form.control}
                name="employee_hear_about_gla_other"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Other (please specify)</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <div className="space-y-4">
              <div>
                <FormLabel className="text-muted-foreground">Driver's License <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                <div className="flex items-center gap-4 mt-2">
                  <div className="w-32 h-24 border border-border rounded-md overflow-hidden bg-background shrink-0">
                    {licenseFile ? (
                      <img
                        src={URL.createObjectURL(licenseFile)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : employee.employee_driver_license_photo ? (
                      <EmployeeDocumentImage
                        value={employee.employee_driver_license_photo}
                        alt="Driver's license"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={licenseInputRef}
                      type="file"
                      accept={ACCEPT_DOCS}
                      className="hidden"
                      onChange={(e) => setLicenseFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-border"
                        onClick={() => licenseInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {licenseFile ? "Change" : "Upload"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/80"
                        onClick={handleArchiveLicense}
                        disabled={!licenseFile || archiveLicenseMutation.isPending}
                      >
                        {archiveLicenseMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Archive className="h-4 w-4 mr-2" />
                        )}
                        Archive
                      </Button>
                    </div>
                    {licenseFile && (
                      <span className="text-xs text-muted-foreground truncate max-w-[12rem]">{licenseFile.name}</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <FormLabel className="text-muted-foreground">Car Insurance <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                <div className="flex items-center gap-4 mt-2">
                  <div className="w-32 h-24 border border-border rounded-md overflow-hidden bg-background shrink-0">
                    {insuranceFile ? (
                      <img
                        src={URL.createObjectURL(insuranceFile)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : employee.employee_car_insurance ? (
                      <EmployeeDocumentImage
                        value={employee.employee_car_insurance}
                        alt="Car insurance"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={insuranceInputRef}
                      type="file"
                      accept={ACCEPT_DOCS}
                      className="hidden"
                      onChange={(e) => setInsuranceFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-border"
                        onClick={() => insuranceInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {insuranceFile ? "Change" : "Upload"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/80"
                        onClick={handleArchiveInsurance}
                        disabled={!insuranceFile || archiveInsuranceMutation.isPending}
                      >
                        {archiveInsuranceMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Archive className="h-4 w-4 mr-2" />
                        )}
                        Archive
                      </Button>
                    </div>
                    {insuranceFile && (
                      <span className="text-xs text-muted-foreground truncate max-w-[12rem]">{insuranceFile.name}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending || isAnyUploading}
                className="border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || isAnyUploading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
