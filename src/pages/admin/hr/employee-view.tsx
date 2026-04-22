import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/queryClient";
import { EmployeeDocumentImage } from "@/components/admin/EmployeeDocumentImage";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronRight, Image, List, Loader2, Pencil, Plus, Trash2, User, UserCheck, UserX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EditBasicInfoModal } from "./components/EditBasicInfoModal";
import { EditFamilyInfoModal } from "./components/EditFamilyInfoModal";
import { EditEmergencyModal } from "./components/EditEmergencyModal";
import { EditOtherInfoModal } from "./components/EditOtherInfoModal";
import { EditJobInfoModal } from "./components/EditJobInfoModal";
import { EditPayInfoModal } from "./components/EditPayInfoModal";

type ProfileSection =
  | "personal-information"
  | "job-and-pay"
  | "rate-history"
  | "job-history"
  | "earnings"
  | "deduction"
  | "payslip";

const PROFILE_SECTIONS: { id: ProfileSection; label: string }[] = [
  { id: "personal-information", label: "Personal Information" },
  { id: "job-and-pay", label: "Job and Pay" },
  { id: "rate-history", label: "Rate History" },
  { id: "job-history", label: "Job History" },
  { id: "earnings", label: "Earnings" },
  { id: "deduction", label: "Deduction" },
  { id: "payslip", label: "Payslip" },
];

interface Employee {
  employee_aid: number;
  employee_status: string;
  employee_is_active: number;
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
  employee_created: string;
  employee_job_pay_aid?: number | null;
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
  fullname?: string;
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

function orDash(val: string | null | undefined): string {
  return (val ?? "").trim() || "—";
}

/** V1-style fallback for empty values */
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
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

function AddRateModal({ employeeId, onSuccess }: { employeeId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [effectiveStart, setEffectiveStart] = useState(new Date().toISOString().slice(0, 10));
  const [payType, setPayType] = useState("hourly");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl(`/api/employees/${employeeId}/rate-history`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rate_history_amount: amount,
          rate_history_date: effectiveStart,
          rate_history_pay_type: payType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to add rate");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rate added", description: "Previous rate auto-closed. New rate is now active." });
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "rate-history"] });
      setOpen(false);
      setAmount("");
      setEffectiveStart(new Date().toISOString().slice(0, 10));
      onSuccess();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
        <Plus className="w-4 h-4 mr-2" />
        Add New Rate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border text-muted-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">Add New Rate</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label className="text-muted-foreground">Pay Type</Label>
              <Select value={payType} onValueChange={setPayType}>
                <SelectTrigger className="bg-background border-border mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground">Effective Start Date</Label>
              <Input
                type="date"
                value={effectiveStart}
                onChange={(e) => setEffectiveStart(e.target.value)}
                className="bg-background border-border mt-1"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Rate Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-background border-border mt-1"
                placeholder="0.00"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">The previous rate will be auto-closed (effective end = day before this start date).</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-border">
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || !amount} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Rate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function EmployeeViewPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [activeSection, setActiveSection] = useState<ProfileSection>("personal-information");
  const [editBasicOpen, setEditBasicOpen] = useState(false);
  const [editFamilyOpen, setEditFamilyOpen] = useState(false);
  const [editEmergencyOpen, setEditEmergencyOpen] = useState(false);
  const [editOtherOpen, setEditOtherOpen] = useState(false);
  const [editJobOpen, setEditJobOpen] = useState(false);
  const [editPayOpen, setEditPayOpen] = useState(false);
  const employeeId = useMemo(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const id = params.get("employeeId");
    return id ? parseInt(id, 10) : null;
  }, [location]);

  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; data: Employee }>({
    queryKey: ["/api/employees", employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error("Invalid employee");
      const res = await fetch(buildApiUrl(`/api/employees/${employeeId}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employee");
      return res.json();
    },
    enabled: !!employeeId,
  });

  const employee = data?.data;

  const { data: rateHistoryData, isLoading: rateHistoryLoading, refetch: refetchRateHistory } = useQuery<{ success: boolean; data: { rate_history_aid: number; rate_history_amount: string; rate_history_date: string; rate_history_created?: string; rate_history_pay_type?: string; rate_history_effective_start?: string; rate_history_effective_end?: string | null }[] }>({
    queryKey: ["/api/employees", employeeId, "rate-history"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/employees/${employeeId}/rate-history`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch rate history");
      return res.json();
    },
    enabled: !!employeeId && activeSection === "rate-history",
  });

  const { data: jobHistoryData, isLoading: jobHistoryLoading } = useQuery<{ success: boolean; data: { employment_history_aid: number; employment_history_company_name: string; employment_history_years_deployed: string; employment_history_start_date: string; employment_history_end_date: string; employment_history_is_active: number }[] }>({
    queryKey: ["/api/employees", employeeId, "employment-history"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/employees/${employeeId}/employment-history`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employment history");
      return res.json();
    },
    enabled: !!employeeId && activeSection === "job-history",
  });

  const { data: earningsData, isLoading: earningsLoading } = useQuery<{ success: boolean; data: { hris_earning_deduction_aid: number; hris_earning_deduction_amount: string; hris_earning_deduction_date: string; hris_earning_deduction_is_paid: number; payitem_name?: string }[] }>({
    queryKey: ["/api/employees", employeeId, "earnings"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/employees/${employeeId}/earnings`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch earnings");
      return res.json();
    },
    enabled: !!employeeId && activeSection === "earnings",
  });

  const { data: deductionsData, isLoading: deductionsLoading } = useQuery<{ success: boolean; data: { hris_earning_deduction_aid: number; hris_earning_deduction_amount: string; hris_earning_deduction_date: string; hris_earning_deduction_is_paid: number; payitem_name?: string }[] }>({
    queryKey: ["/api/employees", employeeId, "deductions"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/employees/${employeeId}/deductions`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deductions");
      return res.json();
    },
    enabled: !!employeeId && activeSection === "deduction",
  });

  const { data: payslipsData, isLoading: payslipsLoading } = useQuery<{ success: boolean; data: { payrun_list_aid: number; payrun_number?: string; payrun_status?: number; payrun_list_gross: string; payrun_list_deduction: string; payrun_list_net: string }[] }>({
    queryKey: ["/api/employees", employeeId, "payslips"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/employees/${employeeId}/payslips`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payslips");
      return res.json();
    },
    enabled: !!employeeId && activeSection === "payslip",
  });

  const { data: unpaidPayrollData } = useQuery<{ success: boolean; count: number }>({
    queryKey: ["/api/payroll/unpaid-count"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/payroll/unpaid-count"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!employeeId && (activeSection === "job-and-pay" || activeSection === "rate-history"),
  });

  const canEditPay = (unpaidPayrollData?.count ?? 0) === 0;
  const isPending = employee?.employee_status === "pending";
  const isOffboarded = employee?.employee_status === "offboarded" || employee?.employee_status === "separated";
  const isActive = !isPending && !isOffboarded && employee?.employee_is_active === 1;
  const [offboarding, setOffboarding] = useState(false);

  const handleOffboard = async () => {
    if (!employee || !confirm(`End contract for ${employee.employee_last_name}, ${employee.employee_first_name}? This will deactivate their system access.`)) return;
    setOffboarding(true);
    try {
      const res = await fetch(buildApiUrl(`/api/employees/${employee.employee_aid}/offboard`), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to offboard");
      }
      toast({ title: "Contract ended", description: "Employee has been offboarded and system access deactivated." });
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to offboard", variant: "destructive" });
    } finally {
      setOffboarding(false);
    }
  };

  const handleApprove = async () => {
    if (!employee) return;
    try {
      const res = await fetch(buildApiUrl(`/api/employees/${employee.employee_aid}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      toast({ title: "Approved", description: "Employee approved successfully." });
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to approve", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!employee || !confirm(`Delete ${employee.employee_last_name}, ${employee.employee_first_name}?`)) return;
    try {
      const res = await fetch(buildApiUrl(`/api/employees/${employee.employee_aid}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Deleted", description: "Employee deleted successfully." });
      window.location.href = "/admin/hr/employees";
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete", variant: "destructive" });
    }
  };

  if (!employeeId) {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-muted-foreground">
          <p>Invalid employee ID.</p>
          <Link href="/admin/hr/employees">
            <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/80">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Employees
            </Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  if (isLoading || !data) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !employee) {
    return (
      <AdminLayout>
        <div className="p-6 text-center">
          <p className="text-red-700">Employee not found.</p>
          <Link href="/admin/hr/employees">
            <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/80">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Employees
            </Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const fullName = `${employee.employee_last_name}, ${employee.employee_first_name}`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/hr/employees">
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-serif text-primary italic">
              {fullName}
            </h1>
            {isPending && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-500/20 text-yellow-700 border border-yellow-500/30">
                Pending
              </span>
            )}
            {isOffboarded && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-500/20 text-muted-foreground border border-gray-500/30">
                Offboarded
              </span>
            )}
          </div>
          {isActive && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleOffboard}
                disabled={offboarding}
              >
                {offboarding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserX className="w-4 h-4 mr-2" />}
                End Contract
              </Button>
            </div>
          )}
          {isPending && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-foreground"
                onClick={handleApprove}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Section navigation list */}
          <div className="w-full lg:w-72 shrink-0">
            <ul className="rounded-lg border border-border bg-card overflow-hidden">
              {PROFILE_SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-card ${
                        isActive ? "bg-[#D3BC8D]/15 text-primary" : "text-muted-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0" />
                        <span>{section.label}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                    </button>
                    {section.id !== "payslip" && (
                      <div className="h-px bg-muted" aria-hidden />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Section content */}
          <div className="flex-1 min-w-0">
            {activeSection === "personal-information" && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 text-sm xl:items-stretch">
                  {/* Basic Information - v1 exact structure */}
                  <Card className="bg-card border-border xl:h-full flex flex-col order-1">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                          <div className="flex items-center gap-2">
                            <List className="h-4 w-4 text-primary" />
                            <span className="font-bold uppercase text-[13px] text-primary">Basic Information</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditBasicOpen(true)}
                            className="flex items-center gap-2 py-2 text-blue-700 hover:underline"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Update</span>
                          </button>
                        </div>
                        <div className="mt-3">
                          <div className="mb-3">
                            <p className="font-bold text-muted-foreground mb-1">Profile Photo <span className="font-normal text-gray-600">(Optional)</span></p>
                            {employee.employee_photo ? (
                              <EmployeeDocumentImage
                                value={employee.employee_photo}
                                alt="Profile"
                                className="h-20 w-20 rounded-full object-cover object-center"
                              />
                            ) : (
                              <div className="h-20 w-20 rounded-full border-2 border-border flex items-center justify-center" title="No photo uploaded (optional)">
                                <Image className="h-10 w-10 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-muted-foreground capitalize">
                            <li className="font-bold text-muted-foreground">First Name:</li>
                            <li>{unspecified(employee.employee_first_name)}</li>
                            <li className="font-bold text-muted-foreground">Middle Name:</li>
                            <li>{unspecified(employee.employee_middle_name)}</li>
                            <li className="font-bold text-muted-foreground">Last Name:</li>
                            <li>{unspecified(employee.employee_last_name)}</li>
                            <li className="font-bold text-muted-foreground">Birth Date:</li>
                            <li>{employee.employee_birthday ? formatDate(employee.employee_birthday) : "Unspecified"}</li>
                            <li className="font-bold text-muted-foreground">Marital Status:</li>
                            <li>{unspecified(employee.employee_marital_status)}</li>
                            <li className="font-bold text-muted-foreground">Social Security Number or EIN:</li>
                            <li>{unspecified(employee.employee_ssn_ein)}</li>
                            <li className="font-bold text-muted-foreground">Street:</li>
                            <li>{unspecified(employee.employee_street)}</li>
                            <li className="font-bold text-muted-foreground">City:</li>
                            <li>{unspecified(employee.employee_city)}</li>
                            <li className="font-bold text-muted-foreground">State:</li>
                            <li>{unspecified(employee.employee_state)}</li>
                            <li className="font-bold text-muted-foreground">Zip Code:</li>
                            <li>{unspecified(employee.employee_zip_code)}</li>
                            <li className="font-bold text-muted-foreground">Country:</li>
                            <li>{unspecified(employee.employee_country)}</li>
                            <li className="font-bold text-muted-foreground">Mobile Number:</li>
                            <li>{unspecified(employee.employee_mobile_number)}</li>
                            <li className="font-bold text-muted-foreground">Telephone Number:</li>
                            <li>{unspecified(employee.employee_telephone)}</li>
                            <li className="font-bold text-muted-foreground">Personal Email:</li>
                            <li className="break-words">{unspecified(employee.employee_email)}</li>
                            <li className="font-bold text-muted-foreground">Shirt Size:</li>
                            <li>{unspecified(employee.employee_shirt_size)}</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                  {/* Other Information - v1 (same row as Basic on xl for equal height) */}
                  <Card className="bg-card border-border xl:h-full flex flex-col order-4 xl:order-2">
                    <CardContent className="p-4 flex flex-col flex-1">
                      <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <List className="h-4 w-4 text-primary" />
                          <span className="font-bold uppercase text-[13px] text-primary">Other Information</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditOtherOpen(true)}
                          className="flex items-center gap-2 py-2 text-blue-700 hover:underline"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Update</span>
                        </button>
                      </div>
                      <div className="mt-3 space-y-4 flex-1">
                        <div>
                          <p className="font-bold text-muted-foreground mb-2">Driver's License <span className="font-normal text-gray-600">(Optional)</span></p>
                          <div className="w-full max-w-[20rem] h-[9.7rem] border border-border rounded-md overflow-hidden bg-background">
                            {employee.employee_driver_license_photo ? (
                              <EmployeeDocumentImage
                                value={employee.employee_driver_license_photo}
                                alt="Driver's license"
                                className="w-full h-full object-cover object-center"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1" title="No document uploaded">
                                <Image className="h-12 w-12 text-muted-foreground" />
                                <span className="text-xs text-gray-600">No document uploaded</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-muted-foreground mb-2">Car Insurance <span className="font-normal text-gray-600">(Optional)</span></p>
                          <div className="w-full max-w-[20rem] h-[9.7rem] border border-border rounded-md overflow-hidden bg-background">
                            {employee.employee_car_insurance ? (
                              <EmployeeDocumentImage
                                value={employee.employee_car_insurance}
                                alt="Car insurance"
                                className="w-full h-full object-cover object-center"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1" title="No document uploaded">
                                <Image className="h-12 w-12 text-muted-foreground" />
                                <span className="text-xs text-gray-600">No document uploaded</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[18rem,1fr] gap-2">
                          <p className="font-bold text-muted-foreground">How did you hear about Golden Luxury Auto?</p>
                          <p className="text-muted-foreground">{unspecified(employee.employee_hear_about_gla)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Family Information - v1 exact structure */}
                  <Card className="bg-card border-border order-2 xl:order-3">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                          <div className="flex items-center gap-2">
                            <List className="h-4 w-4 text-primary" />
                            <span className="font-bold uppercase text-[13px] text-primary">Family Information</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditFamilyOpen(true)}
                            className="flex items-center gap-2 py-2 text-blue-700 hover:underline"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Update</span>
                          </button>
                        </div>
                        <div className="mt-3">
                          <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-muted-foreground capitalize">
                            <li className="font-bold text-muted-foreground">Mother's First Name:</li>
                            <li>{unspecified(employee.employee_mother_name)}</li>
                            <li className="font-bold text-muted-foreground">Father's First Name:</li>
                            <li>{unspecified(employee.employee_father_name)}</li>
                            <li className="font-bold text-muted-foreground">Home Contact:</li>
                            <li>{unspecified(employee.employee_home_contact)}</li>
                            <li className="font-bold text-muted-foreground">Family Home Address:</li>
                            <li className="break-words">{unspecified(employee.employee_home_address)}</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                  {/* Emergency Contact - v1 */}
                  <Card className="bg-card border-border order-3 xl:order-4">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <List className="h-4 w-4 text-primary" />
                          <span className="font-bold uppercase text-[13px] text-primary">Emergency Contact</span>
                        </div>
                          <button
                            type="button"
                            onClick={() => setEditEmergencyOpen(true)}
                            className="flex items-center gap-2 py-2 text-blue-700 hover:underline"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Update</span>
                          </button>
                        </div>
                        <div className="mt-3">
                          <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-muted-foreground capitalize">
                            <li className="font-bold text-muted-foreground">Name:</li>
                            <li>{unspecified(employee.employee_emergency_contact_person)}</li>
                          <li className="font-bold text-muted-foreground">Relationship:</li>
                          <li>{unspecified(employee.employee_emergency_relationship)}</li>
                          <li className="font-bold text-muted-foreground">Number:</li>
                          <li>{unspecified(employee.employee_emergency_number)}</li>
                          <li className="font-bold text-muted-foreground">Address:</li>
                          <li className="break-words">{unspecified(employee.employee_emergency_address)}</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
            )}

            {activeSection === "job-and-pay" && (
              <div className="space-y-4 max-w-[50rem]">
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <List className="h-4 w-4 text-primary" />
                        <span className="font-bold uppercase text-[13px] text-primary">Job Information</span>
                      </div>
                      <button type="button" onClick={() => setEditJobOpen(true)} className="flex items-center gap-2 py-2 text-blue-700 hover:underline">
                        <Pencil className="h-3 w-3" /> <span>Update</span>
                      </button>
                    </div>
                    <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <li className="font-bold text-muted-foreground">Employee Number:</li>
                      <li>{unspecified(employee.employee_number)}</li>
                      <li className="font-bold text-muted-foreground">Department:</li>
                      <li>{unspecified(employee.employee_job_pay_department_name)}</li>
                      <li className="font-bold text-muted-foreground">Job Title:</li>
                      <li>{unspecified(employee.employee_job_pay_job_title_name)}</li>
                      <li className="font-bold text-muted-foreground">Work Email:</li>
                      <li className="break-words">{unspecified(employee.employee_job_pay_work_email ?? employee.employee_email)}</li>
                      <li className="font-bold text-muted-foreground">Date Hired:</li>
                      <li>{employee.employee_job_pay_hired ? formatDate(employee.employee_job_pay_hired) : "Unspecified"}</li>
                      <li className="font-bold text-muted-foreground">Regularized On:</li>
                      <li>{employee.employee_job_pay_regular_on ? formatDate(employee.employee_job_pay_regular_on) : "Unspecified"}</li>
                      <li className="font-bold text-muted-foreground">Date Separated:</li>
                      <li>{employee.employee_job_pay_separated ? formatDate(employee.employee_job_pay_separated) : "Unspecified"}</li>
                      <li className="font-bold text-muted-foreground">Comment:</li>
                      <li>{unspecified(employee.employee_job_pay_comment)}</li>
                    </ul>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <List className="h-4 w-4 text-primary" />
                        <span className="font-bold uppercase text-[13px] text-primary">Pay Information</span>
                      </div>
                      {canEditPay ? (
                        <button type="button" onClick={() => setEditPayOpen(true)} className="flex items-center gap-2 py-2 text-blue-700 hover:underline">
                          <Pencil className="h-3 w-3" /> <span>Update</span>
                        </button>
                      ) : (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-700 border border-yellow-500/30">On-going payroll</span>
                      )}
                    </div>
                    <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <li className="font-bold text-muted-foreground">Payroll Eligibility:</li>
                      <li>{Number(employee.employee_job_pay_eligible) === 1 ? "Eligible" : "Not Eligible"}</li>
                      <li className="font-bold text-muted-foreground">Employee rate per hour:</li>
                      <li>{formatCurrency(employee.employee_job_pay_salary_rate)}</li>
                      <li className="font-bold text-muted-foreground">Bank Account:</li>
                      <li>{unspecified(employee.employee_job_pay_bank_acc)}</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === "rate-history" && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                    <h3 className="text-primary font-semibold">
                      Rate History
                    </h3>
                    {canEditPay && employeeId && (
                      <AddRateModal employeeId={employeeId} onSuccess={() => refetchRateHistory()} />
                    )}
                  </div>
                  {rateHistoryLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : rateHistoryData?.data?.length ? (
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
                            <th className="text-right py-3 min-w-[8rem] text-foreground font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rateHistoryData.data.map((row, i) => (
                            <tr key={row.rate_history_aid} className="border-b border-border/50 hover:bg-card/50">
                              <td className="py-3 text-center text-muted-foreground">{i + 1}.</td>
                              <td className="py-3 pl-2">
                                <span
                                  className={`inline-block w-5 h-5 rounded-full flex-shrink-0 ${
                                    !row.rate_history_effective_end || row.rate_history_effective_end === "" ? "bg-green-500" : "bg-gray-500/50"
                                  }`}
                                  title={!row.rate_history_effective_end || row.rate_history_effective_end === "" ? "Current rate" : "Previous rate"}
                                />
                              </td>
                              <td className="py-3 text-muted-foreground capitalize">{row.rate_history_pay_type || "Hourly"}</td>
                              <td className="py-3 text-muted-foreground">{formatDate(row.rate_history_effective_start || row.rate_history_date)}</td>
                              <td className="py-3 text-muted-foreground">{row.rate_history_effective_end ? formatDate(row.rate_history_effective_end) : "—"}</td>
                              <td className="py-3 text-right text-muted-foreground">{formatCurrency(row.rate_history_amount)}</td>
                              <td className="py-3 text-muted-foreground">{formatDateTime(row.rate_history_created)}</td>
                              <td className="py-3 text-right">
                                {!canEditPay && i === 0 ? (
                                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-yellow-500/20 text-yellow-700 border border-yellow-500/30">
                                    On-going payroll
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-center text-sm text-muted-foreground py-4">End of list.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No rate history recorded yet.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "job-history" && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <h3 className="text-primary font-semibold mb-3 border-b border-border pb-2">
                    Job History
                  </h3>
                  {jobHistoryLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : jobHistoryData?.data?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 text-foreground font-medium">#</th>
                            <th className="text-left py-2 text-foreground font-medium">Status</th>
                            <th className="text-left py-2 text-foreground font-medium">Company Name</th>
                            <th className="text-left py-2 text-foreground font-medium">Years Deployed</th>
                            <th className="text-left py-2 text-foreground font-medium">From</th>
                            <th className="text-left py-2 text-foreground font-medium">To</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobHistoryData.data.map((row, i) => (
                            <tr key={row.employment_history_aid} className="border-b border-border/50">
                              <td className="py-2 text-muted-foreground">{i + 1}.</td>
                              <td className="py-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${row.employment_history_is_active === 1 ? "bg-green-500/20 text-green-700" : "bg-gray-500/20 text-gray-700"}`}>
                                  {row.employment_history_is_active === 1 ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="py-2 text-muted-foreground">{row.employment_history_company_name || "—"}</td>
                              <td className="py-2 text-muted-foreground">{row.employment_history_years_deployed || "—"}</td>
                              <td className="py-2 text-muted-foreground">{formatDate(row.employment_history_start_date)}</td>
                              <td className="py-2 text-muted-foreground">{formatDate(row.employment_history_end_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No job history recorded yet.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "earnings" && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <h3 className="text-primary font-semibold mb-3 border-b border-border pb-2">
                    Earnings
                  </h3>
                  {earningsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : earningsData?.data?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 text-foreground font-medium">#</th>
                            <th className="text-left py-2 text-foreground font-medium">Status</th>
                            <th className="text-left py-2 text-foreground font-medium">Date</th>
                            <th className="text-left py-2 text-foreground font-medium">Payitem</th>
                            <th className="text-right py-2 text-foreground font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {earningsData.data.map((row, i) => (
                            <tr key={row.hris_earning_deduction_aid} className="border-b border-border/50">
                              <td className="py-2 text-muted-foreground">{i + 1}.</td>
                              <td className="py-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${row.hris_earning_deduction_is_paid === 1 ? "bg-green-500/20 text-green-700" : "bg-yellow-500/20 text-yellow-700"}`}>
                                  {row.hris_earning_deduction_is_paid === 1 ? "Paid" : "Unpaid"}
                                </span>
                              </td>
                              <td className="py-2 text-muted-foreground">{formatDate(row.hris_earning_deduction_date)}</td>
                              <td className="py-2 text-muted-foreground">{row.payitem_name || "—"}</td>
                              <td className="py-2 text-right text-muted-foreground">{formatCurrency(row.hris_earning_deduction_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No earnings recorded yet.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "deduction" && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <h3 className="text-primary font-semibold mb-3 border-b border-border pb-2">
                    Deduction
                  </h3>
                  {deductionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : deductionsData?.data?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 text-foreground font-medium">#</th>
                            <th className="text-left py-2 text-foreground font-medium">Status</th>
                            <th className="text-left py-2 text-foreground font-medium">Date</th>
                            <th className="text-left py-2 text-foreground font-medium">Payitem</th>
                            <th className="text-right py-2 text-foreground font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deductionsData.data.map((row, i) => (
                            <tr key={row.hris_earning_deduction_aid} className="border-b border-border/50">
                              <td className="py-2 text-muted-foreground">{i + 1}.</td>
                              <td className="py-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${row.hris_earning_deduction_is_paid === 1 ? "bg-green-500/20 text-green-700" : "bg-yellow-500/20 text-yellow-700"}`}>
                                  {row.hris_earning_deduction_is_paid === 1 ? "Paid" : "Unpaid"}
                                </span>
                              </td>
                              <td className="py-2 text-muted-foreground">{formatDate(row.hris_earning_deduction_date)}</td>
                              <td className="py-2 text-muted-foreground">{row.payitem_name || "—"}</td>
                              <td className="py-2 text-right text-muted-foreground">{formatCurrency(row.hris_earning_deduction_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No deductions recorded yet.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "payslip" && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <h3 className="text-primary font-semibold mb-3 border-b border-border pb-2">
                    Payslip
                  </h3>
                  {payslipsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : payslipsData?.data?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 text-muted-foreground font-medium">#</th>
                            <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                            <th className="text-left py-2 text-muted-foreground font-medium">Payroll ID</th>
                            <th className="text-right py-2 text-muted-foreground font-medium">Gross</th>
                            <th className="text-right py-2 text-muted-foreground font-medium">Deduction</th>
                            <th className="text-right py-2 text-muted-foreground font-medium">Net Pay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payslipsData.data.map((row, i) => (
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
                    <p className="text-sm text-muted-foreground">No payslips available yet.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Edit modals for personal information */}
      <EditBasicInfoModal open={editBasicOpen} onOpenChange={setEditBasicOpen} employee={employee} />
      <EditFamilyInfoModal open={editFamilyOpen} onOpenChange={setEditFamilyOpen} employee={employee} />
      <EditEmergencyModal open={editEmergencyOpen} onOpenChange={setEditEmergencyOpen} employee={employee} />
      <EditOtherInfoModal open={editOtherOpen} onOpenChange={setEditOtherOpen} employee={employee} />
      <EditJobInfoModal open={editJobOpen} onOpenChange={setEditJobOpen} employee={employee} />
      <EditPayInfoModal open={editPayOpen} onOpenChange={setEditPayOpen} employee={employee} />
    </AdminLayout>
  );
}