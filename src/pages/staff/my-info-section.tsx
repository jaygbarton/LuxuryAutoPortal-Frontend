import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildApiUrl, buildUploadApiUrl } from "@/lib/queryClient";
import { EmployeeDocumentImage } from "@/components/admin/EmployeeDocumentImage";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Image, List, Loader2, RefreshCw, Upload } from "lucide-react";

type ProfileSection =
  | "personal-information"
  | "job-and-pay"
  | "rate-history"
  | "payslip";

const PROFILE_SECTIONS: { id: ProfileSection; label: string }[] = [
  { id: "personal-information", label: "Personal Information" },
  { id: "job-and-pay", label: "Job and Pay" },
  { id: "rate-history", label: "Rate History" },
  { id: "payslip", label: "Payslip" },
];

interface Employee {
  employee_aid: number;
  employee_number: string;
  employee_first_name: string;
  employee_last_name: string;
  employee_middle_name: string;
  employee_email: string;
  employee_birthday: string;
  employee_marital_status: string;
  employee_street: string;
  employee_city: string;
  employee_state: string;
  employee_country: string;
  employee_zip_code: string;
  employee_mobile_number: string;
  employee_telephone: string;
  employee_mother_name: string;
  employee_father_name: string;
  employee_home_contact: string;
  employee_home_address: string;
  employee_emergency_contact_person: string;
  employee_emergency_relationship: string;
  employee_emergency_address: string;
  employee_emergency_number: string;
  employee_ssn_ein: string;
  employee_shirt_size: string;
  employee_photo?: string | null;
  employee_driver_license_photo?: string | null;
  employee_car_insurance?: string | null;
  employee_hear_about_gla?: string | null;
  employee_job_pay_work_email?: string | null;
  employee_job_pay_department_name?: string | null;
  employee_job_pay_job_title_name?: string | null;
  employee_job_pay_hired?: string | null;
  employee_job_pay_regular_on?: string | null;
  employee_job_pay_separated?: string | null;
  employee_job_pay_comment?: string | null;
  employee_job_pay_eligible?: number | null;
  employee_job_pay_salary_rate?: string | null;
  employee_job_pay_bank_acc?: string | null;
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function unspecified(val: string | null | undefined): string {
  return (val ?? "").trim() || "Unspecified";
}

function formatCurrency(val: string | number | null | undefined): string {
  const n = parseFloat(String(val ?? 0));
  return isNaN(n) ? "$0.00" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function StaffMyInfoSection() {
  const [, params] = useRoute("/staff/my-info/:section");
  const [, setLocation] = useLocation();
  const section = (params?.section as ProfileSection) || "personal-information";
  const isValidSection = PROFILE_SECTIONS.some((s) => s.id === section);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("employee_photo", file, file.name || "photo.jpg");
      const res = await fetch(buildUploadApiUrl("/api/me/upload-photo"), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to upload profile photo");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Profile photo updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/me/employee"] });
      setPhotoPreview(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    uploadPhotoMutation.mutate(file);
  };

  const { data: empRes, isLoading: empLoading, error: empError } = useQuery<{ success: boolean; data: Employee }>({
    queryKey: ["/api/me/employee"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/me/employee"), { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load your employee record");
      }
      return res.json();
    },
  });

  const employee = empRes?.data;

  const { data: rateHistoryData, isLoading: rateHistoryLoading } = useQuery<{ success: boolean; data: { rate_history_aid: number; rate_history_amount: string; rate_history_date: string; rate_history_created?: string; rate_history_pay_type?: string; rate_history_effective_start?: string; rate_history_effective_end?: string | null }[] }>({
    queryKey: ["/api/me/rate-history"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/me/rate-history"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch rate history");
      return res.json();
    },
    enabled: section === "rate-history",
  });

  const { data: payslipsData, isLoading: payslipsLoading } = useQuery<{ success: boolean; data: { payrun_list_aid: number; payrun_number?: string; payrun_status?: number; payrun_list_gross: string; payrun_list_deduction: string; payrun_list_net: string }[] }>({
    queryKey: ["/api/me/payslips"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/me/payslips"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payslips");
      return res.json();
    },
    enabled: section === "payslip",
  });

  if (!isValidSection) {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-muted-foreground">
          <p>Invalid section.</p>
          <Button
            variant="outline"
            className="mt-4 border-primary/30 text-primary"
            onClick={() => setLocation("/staff/my-info/personal-information")}
          >
            Go to Personal Information
          </Button>
        </div>
      </AdminLayout>
    );
  }

  if (empLoading || !empRes) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (empError || !employee) {
    const errorMessage = empError instanceof Error ? empError.message : null;
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-primary">My Info</h1>
            <p className="text-muted-foreground">Your profile and employment information.</p>
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-semibold text-foreground">We couldn&apos;t load your employee record.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {errorMessage ||
                        "You may not have an HR profile linked to this account. Please contact HR if you believe this is an error."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/me/employee"] })}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const fullName = [employee.employee_first_name, employee.employee_middle_name, employee.employee_last_name]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  const renderSectionContent = () => {
    if (section === "personal-information") {
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 text-sm xl:items-stretch">
          <Card className="bg-card border-border xl:h-full flex flex-col">
            <CardContent className="p-4">
              <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="font-bold uppercase text-[13px] text-primary">Basic Information</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="mb-3">
                  <p className="font-bold text-foreground mb-1">Profile Photo <span className="font-normal text-muted-foreground">(Optional)</span></p>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-full border-2 border-border flex items-center justify-center overflow-hidden bg-background shrink-0">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                      ) : employee.employee_photo ? (
                        <EmployeeDocumentImage
                          value={employee.employee_photo}
                          alt="Profile"
                          className="h-full w-full object-cover object-center rounded-full"
                        />
                      ) : (
                        <Image className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf"
                        className="hidden"
                        onChange={handlePhotoSelect}
                        disabled={uploadPhotoMutation.isPending}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-border"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadPhotoMutation.isPending}
                      >
                        {uploadPhotoMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {employee.employee_photo ? "Change Photo" : "Upload Photo"}
                      </Button>
                      <span className="text-[11px] text-muted-foreground">JPG, PNG, GIF, WebP, PDF (max 10 MB)</span>
                    </div>
                  </div>
                </div>
                <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-muted-foreground capitalize">
                  <li className="font-bold text-foreground">First Name:</li><li>{unspecified(employee.employee_first_name)}</li>
                  <li className="font-bold text-foreground">Middle Name:</li><li>{unspecified(employee.employee_middle_name)}</li>
                  <li className="font-bold text-foreground">Last Name:</li><li>{unspecified(employee.employee_last_name)}</li>
                  <li className="font-bold text-foreground">Birth Date:</li><li>{employee.employee_birthday ? formatDate(employee.employee_birthday) : "Unspecified"}</li>
                  <li className="font-bold text-foreground">Marital Status:</li><li>{unspecified(employee.employee_marital_status)}</li>
                  <li className="font-bold text-foreground">Social Security Number or EIN:</li><li>{unspecified(employee.employee_ssn_ein)}</li>
                  <li className="font-bold text-foreground">Street:</li><li>{unspecified(employee.employee_street)}</li>
                  <li className="font-bold text-foreground">City:</li><li>{unspecified(employee.employee_city)}</li>
                  <li className="font-bold text-foreground">State:</li><li>{unspecified(employee.employee_state)}</li>
                  <li className="font-bold text-foreground">Zip Code:</li><li>{unspecified(employee.employee_zip_code)}</li>
                  <li className="font-bold text-foreground">Country:</li><li>{unspecified(employee.employee_country)}</li>
                  <li className="font-bold text-foreground">Mobile Number:</li><li>{unspecified(employee.employee_mobile_number)}</li>
                  <li className="font-bold text-foreground">Telephone Number:</li><li>{unspecified(employee.employee_telephone)}</li>
                  <li className="font-bold text-foreground">Personal Email:</li><li className="break-words">{unspecified(employee.employee_email)}</li>
                  <li className="font-bold text-foreground">Shirt Size:</li><li>{unspecified(employee.employee_shirt_size)}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border xl:h-full flex flex-col">
            <CardContent className="p-4 flex flex-col flex-1">
              <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="font-bold uppercase text-[13px] text-primary">Other Information</span>
                </div>
              </div>
              <div className="mt-3 space-y-4 flex-1">
                <div>
                  <p className="font-bold text-foreground mb-2">Driver&apos;s License <span className="font-normal text-muted-foreground">(Optional)</span></p>
                  <div className="w-full max-w-[20rem] h-[9.7rem] border border-border rounded-md overflow-hidden bg-background">
                    {employee.employee_driver_license_photo ? (
                      <EmployeeDocumentImage value={employee.employee_driver_license_photo} alt="Driver's license" className="w-full h-full object-cover object-center" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1" title="No document uploaded">
                        <Image className="h-12 w-12 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">No document uploaded</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-bold text-foreground mb-2">Car Insurance <span className="font-normal text-muted-foreground">(Optional)</span></p>
                  <div className="w-full max-w-[20rem] h-[9.7rem] border border-border rounded-md overflow-hidden bg-background">
                    {employee.employee_car_insurance ? (
                      <EmployeeDocumentImage value={employee.employee_car_insurance} alt="Car insurance" className="w-full h-full object-cover object-center" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1" title="No document uploaded">
                        <Image className="h-12 w-12 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">No document uploaded</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[18rem,1fr] gap-2">
                  <p className="font-bold text-foreground">How did you hear about Golden Luxury Auto?</p>
                  <p className="text-muted-foreground">{unspecified(employee.employee_hear_about_gla)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="font-bold uppercase text-[13px] text-primary">Family Information</span>
                </div>
              </div>
              <div className="mt-3">
                <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-muted-foreground capitalize">
                  <li className="font-bold text-foreground">Mother&apos;s First Name:</li><li>{unspecified(employee.employee_mother_name)}</li>
                  <li className="font-bold text-foreground">Father&apos;s First Name:</li><li>{unspecified(employee.employee_father_name)}</li>
                  <li className="font-bold text-foreground">Home Contact:</li><li>{unspecified(employee.employee_home_contact)}</li>
                  <li className="font-bold text-foreground">Family Home Address:</li><li className="break-words">{unspecified(employee.employee_home_address)}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="font-bold uppercase text-[13px] text-primary">Emergency Contact</span>
                </div>
              </div>
              <div className="mt-3">
                <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-muted-foreground capitalize">
                  <li className="font-bold text-foreground">Name:</li><li>{unspecified(employee.employee_emergency_contact_person)}</li>
                  <li className="font-bold text-foreground">Relationship:</li><li>{unspecified(employee.employee_emergency_relationship)}</li>
                  <li className="font-bold text-foreground">Number:</li><li>{unspecified(employee.employee_emergency_number)}</li>
                  <li className="font-bold text-foreground">Address:</li><li className="break-words">{unspecified(employee.employee_emergency_address)}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (section === "job-and-pay") {
      return (
        <div className="space-y-4 max-w-[50rem]">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="border-b border-border pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="font-bold uppercase text-[13px] text-primary">Job Information</span>
                </div>
              </div>
              <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <li className="font-bold text-foreground">Employee Number:</li><li>{unspecified(employee.employee_number)}</li>
                <li className="font-bold text-foreground">Department:</li><li>{unspecified(employee.employee_job_pay_department_name)}</li>
                <li className="font-bold text-foreground">Job Title:</li><li>{unspecified(employee.employee_job_pay_job_title_name)}</li>
                <li className="font-bold text-foreground">Work Email:</li><li className="break-words">{unspecified(employee.employee_job_pay_work_email ?? employee.employee_email)}</li>
                <li className="font-bold text-foreground">Date Hired:</li><li>{employee.employee_job_pay_hired ? formatDate(employee.employee_job_pay_hired) : "Unspecified"}</li>
                <li className="font-bold text-foreground">Regularized On:</li><li>{employee.employee_job_pay_regular_on ? formatDate(employee.employee_job_pay_regular_on) : "Unspecified"}</li>
                <li className="font-bold text-foreground">Date Separated:</li><li>{employee.employee_job_pay_separated ? formatDate(employee.employee_job_pay_separated) : "Unspecified"}</li>
                <li className="font-bold text-foreground">Comment:</li><li>{unspecified(employee.employee_job_pay_comment)}</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="border-b border-border pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="font-bold uppercase text-[13px] text-primary">Pay Information</span>
                </div>
              </div>
              <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <li className="font-bold text-foreground">Payroll Eligibility:</li><li>{Number(employee.employee_job_pay_eligible) === 1 ? "Eligible" : "Not Eligible"}</li>
                <li className="font-bold text-foreground">Employee rate per hour:</li><li>{formatCurrency(employee.employee_job_pay_salary_rate)}</li>
                <li className="font-bold text-foreground">Bank Account:</li><li>{unspecified(employee.employee_job_pay_bank_acc)}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (section === "rate-history") {
      const loading = rateHistoryLoading;
      const rows = rateHistoryData?.data ?? [];
      return (
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h3 className="text-primary font-semibold mb-3 border-b border-border pb-2">Rate History</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="text-center py-3 w-12 text-foreground font-medium">#</th>
                      <th className="text-left py-3 min-w-[5rem] text-foreground font-medium">Status</th>
                      <th className="text-left py-3 min-w-[6rem] text-foreground font-medium">Pay Type</th>
                      <th className="text-left py-3 min-w-[10rem] text-foreground font-medium">Effective Start</th>
                      <th className="text-left py-3 min-w-[10rem] text-foreground font-medium">Effective End</th>
                      <th className="text-right py-3 min-w-[6rem] text-foreground font-medium">Amount</th>
                      <th className="text-left py-3 min-w-[12rem] text-foreground font-medium">Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.rate_history_aid} className="border-b border-border/50 hover:bg-card/50">
                        <td className="py-3 text-center text-muted-foreground">{i + 1}.</td>
                        <td className="py-3 pl-2">
                          <span className={`inline-block w-5 h-5 rounded-full flex-shrink-0 ${!row.rate_history_effective_end || row.rate_history_effective_end === "" ? "bg-green-500" : "bg-gray-500/50"}`} title={!row.rate_history_effective_end || row.rate_history_effective_end === "" ? "Current rate" : "Previous rate"} />
                        </td>
                        <td className="py-3 text-muted-foreground capitalize">{row.rate_history_pay_type || "Hourly"}</td>
                        <td className="py-3 text-muted-foreground">{formatDate(row.rate_history_effective_start || row.rate_history_date)}</td>
                        <td className="py-3 text-muted-foreground">{row.rate_history_effective_end ? formatDate(row.rate_history_effective_end) : "—"}</td>
                        <td className="py-3 text-right text-muted-foreground">{formatCurrency(row.rate_history_amount)}</td>
                        <td className="py-3 text-muted-foreground">{formatDateTime(row.rate_history_created)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-center text-sm text-foreground py-4">End of list.</p>
              </div>
            ) : (
              <p className="text-sm text-foreground">No rate history recorded yet.</p>
            )}
          </CardContent>
        </Card>
      );
    }

    if (section === "payslip") {
      const loading = payslipsLoading;
      const rows = payslipsData?.data ?? [];
      return (
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h3 className="text-primary font-semibold mb-3 border-b border-border pb-2">Payslip</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-foreground font-medium">#</th>
                      <th className="text-left py-2 text-foreground font-medium">Status</th>
                      <th className="text-left py-2 text-foreground font-medium">Payroll ID</th>
                      <th className="text-right py-2 text-foreground font-medium">Gross</th>
                      <th className="text-right py-2 text-foreground font-medium">Deduction</th>
                      <th className="text-right py-2 text-foreground font-medium">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.payrun_list_aid} className="border-b border-border/50">
                        <td className="py-2 text-muted-foreground">{i + 1}.</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${row.payrun_status === 1 ? "bg-green-500/20 text-green-700" : "bg-yellow-500/20 text-yellow-700"}`}>
                            {row.payrun_status === 1 ? "Paid" : "Unpaid"}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">{row.payrun_number || "—"}</td>
                        <td className="py-2 text-right text-muted-foreground">{formatCurrency(row.payrun_list_gross)}</td>
                        <td className="py-2 text-right text-muted-foreground">{formatCurrency(row.payrun_list_deduction)}</td>
                        <td className="py-2 text-right text-muted-foreground">{formatCurrency(row.payrun_list_net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-foreground">No payslips available yet.</p>
            )}
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  const currentLabel = PROFILE_SECTIONS.find((s) => s.id === section)?.label ?? section;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">My Info</h1>
          <p className="text-muted-foreground">Your profile and employment information.</p>
        </div>

        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="shrink-0">
                {employee.employee_photo ? (
                  <EmployeeDocumentImage
                    value={employee.employee_photo}
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover object-center border border-border"
                  />
                ) : (
                  <div
                    className="h-20 w-20 rounded-full border-2 border-border flex items-center justify-center bg-muted/30"
                    title="No photo uploaded"
                  >
                    <Image className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-serif text-primary italic truncate">
                  {fullName || "Employee"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">{unspecified(employee.employee_job_pay_job_title_name)}</span>
                  <span className="mx-2 opacity-50">•</span>
                  <span>{unspecified(employee.employee_job_pay_department_name)}</span>
                </p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <div>
                    <span className="font-semibold text-foreground">Employee #:</span>{" "}
                    {unspecified(employee.employee_number)}
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-foreground">Email:</span>{" "}
                    {unspecified(employee.employee_job_pay_work_email ?? employee.employee_email)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs
          value={section}
          onValueChange={(v) => setLocation(`/staff/my-info/${v}`)}
          className="flex-1"
        >
          <TabsList className="bg-muted border border-border mb-6 flex-wrap h-auto gap-1 p-1">
            {PROFILE_SECTIONS.map((s) => (
              <TabsTrigger
                key={s.id}
                value={s.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
              >
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="min-w-0">
            {renderSectionContent()}
          </div>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
