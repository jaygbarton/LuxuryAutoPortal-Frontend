import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Archive, Image, Loader2, Upload } from "lucide-react";

const schema = z.object({
  employee_first_name: z.string().min(1, "Required"),
  employee_last_name: z.string().min(1, "Required"),
  employee_middle_name: z.string().optional().default(""),
  employee_birthday: z.string().optional().default(""),
  employee_marital_status: z.string().optional().default(""),
  employee_ssn_ein: z.string().optional().default(""),
  employee_street: z.string().optional().default(""),
  employee_city: z.string().optional().default(""),
  employee_state: z.string().optional().default(""),
  employee_country: z.string().optional().default(""),
  employee_zip_code: z.string().optional().default(""),
  employee_mobile_number: z.string().optional().default(""),
  employee_telephone: z.string().optional().default(""),
  employee_email: z.string().email("Invalid email").optional().or(z.literal("")),
  employee_shirt_size: z.string().optional().default(""),
});

type FormValues = z.infer<typeof schema>;

interface Employee {
  employee_aid: number;
  employee_first_name: string;
  employee_last_name: string;
  employee_middle_name?: string;
  employee_birthday?: string;
  employee_marital_status?: string;
  employee_ssn_ein?: string;
  employee_street?: string;
  employee_city?: string;
  employee_state?: string;
  employee_country?: string;
  employee_zip_code?: string;
  employee_mobile_number?: string;
  employee_telephone?: string;
  employee_email?: string;
  employee_shirt_size?: string;
  employee_photo?: string | null;
}

interface EditBasicInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}

const MARITAL_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "annulled", label: "Annulled" },
  { value: "legally separated", label: "Legally Separated" },
  { value: "widowed", label: "Widowed" },
];

const SHIRT_OPTIONS = ["Small", "Medium", "Large", "XLarge", "XXLarge"];

const ACCEPT_IMAGE = "image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf";

export function EditBasicInfoModal({ open, onOpenChange, employee }: EditBasicInfoModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employee_first_name: employee.employee_first_name || "",
      employee_last_name: employee.employee_last_name || "",
      employee_middle_name: employee.employee_middle_name || "",
      employee_birthday: employee.employee_birthday || "",
      employee_marital_status: employee.employee_marital_status || "",
      employee_ssn_ein: employee.employee_ssn_ein || "",
      employee_street: employee.employee_street || "",
      employee_city: employee.employee_city || "",
      employee_state: employee.employee_state || "",
      employee_country: employee.employee_country || "",
      employee_zip_code: employee.employee_zip_code || "",
      employee_mobile_number: employee.employee_mobile_number || "",
      employee_telephone: employee.employee_telephone || "",
      employee_email: employee.employee_email || "",
      employee_shirt_size: employee.employee_shirt_size || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        employee_first_name: employee.employee_first_name || "",
        employee_last_name: employee.employee_last_name || "",
        employee_middle_name: employee.employee_middle_name || "",
        employee_birthday: employee.employee_birthday || "",
        employee_marital_status: employee.employee_marital_status || "",
        employee_ssn_ein: employee.employee_ssn_ein || "",
        employee_street: employee.employee_street || "",
        employee_city: employee.employee_city || "",
        employee_state: employee.employee_state || "",
        employee_country: employee.employee_country || "",
        employee_zip_code: employee.employee_zip_code || "",
        employee_mobile_number: employee.employee_mobile_number || "",
        employee_telephone: employee.employee_telephone || "",
        employee_email: employee.employee_email || "",
        employee_shirt_size: employee.employee_shirt_size || "",
      });
    }
  }, [open, employee]);

  const mutation = useMutation({
    mutationFn: async ({ values, photoFile: file }: { values: FormValues; photoFile: File | null }) => {
      // 1. If a photo is selected, upload it to Google Drive first
      if (file && file instanceof File && file.size > 0) {
        const fd = new FormData();
        fd.append("employee_photo", file, file.name || "photo.jpg");
        const uploadRes = await fetch(buildUploadApiUrl(`/api/employees/${employee.employee_aid}/upload-documents`), {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error || err.message || "Failed to upload photo to Google Drive");
        }
      }
      // 2. Update basic info
      const res = await fetch(buildApiUrl(`/api/employees/${employee.employee_aid}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
    },
    onSuccess: (_, { photoFile: file }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      if (file) {
        setPhotoFile(null);
        if (photoInputRef.current) photoInputRef.current.value = "";
      }
      toast({
        title: "Success",
        description: file
          ? "Basic information and profile photo saved to Google Drive successfully."
          : "Basic information updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: FormValues) => {
    const file = photoFile ?? photoInputRef.current?.files?.[0] ?? null;
    mutation.mutate({ values, photoFile: file ?? null });
  };

  const archiveMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("employee_photo", file, file.name || "photo.jpg");
      const res = await fetch(buildUploadApiUrl(`/api/employees/${employee.employee_aid}/upload-documents`), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to archive photo");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      toast({
        title: "Archived",
        description: "Profile picture archived to Google Drive and displayed in the employee registry.",
      });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleArchive = () => {
    const file = photoInputRef.current?.files?.[0] ?? photoFile;
    if (file) archiveMutation.mutate(file);
    else toast({ title: "No photo selected", description: "Please select a profile picture first.", variant: "destructive" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border text-muted-foreground">
        <DialogHeader>
          <DialogTitle className="text-primary">Update Basic Information</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employee_first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">First Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_middle_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Middle Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_last_name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-muted-foreground">Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_birthday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Birth Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_marital_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Marital Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="bg-card border-border">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MARITAL_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_ssn_ein"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-muted-foreground">Social Security Number or EIN</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_street"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-muted-foreground">Street</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">City</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">State</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_zip_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Zip Code</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Country</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_mobile_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Mobile Number</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Telephone Number</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_email"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-muted-foreground">Personal Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} className="bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employee_shirt_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Shirt Size</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="bg-card border-border">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SHIRT_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="col-span-2 space-y-2">
                <FormLabel className="text-muted-foreground">Profile Photo <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-full border-2 border-border flex items-center justify-center overflow-hidden bg-background shrink-0">
                    {photoFile ? (
                      <img
                        src={URL.createObjectURL(photoFile)}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : employee.employee_photo ? (
                      <EmployeeDocumentImage
                        value={employee.employee_photo}
                        alt="Profile"
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <Image className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept={ACCEPT_IMAGE}
                      className="hidden"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-border"
                        onClick={() => photoInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {photoFile ? "Change Photo" : "Upload Photo"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/80"
                        onClick={handleArchive}
                        disabled={!photoFile || archiveMutation.isPending}
                      >
                        {archiveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Archive className="h-4 w-4 mr-2" />
                        )}
                        Archive
                      </Button>
                    </div>
                    {photoFile && (
                      <span className="text-xs text-muted-foreground">{photoFile.name}</span>
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
                disabled={mutation.isPending || archiveMutation.isPending}
                className="border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || archiveMutation.isPending}
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
