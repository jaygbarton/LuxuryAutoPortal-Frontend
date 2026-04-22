import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { EmployeeDocumentImage } from "@/components/admin/EmployeeDocumentImage";
import { AlertCircle, ChevronRight, Image as ImageIcon, Loader2, RefreshCw, User } from "lucide-react";

interface MyEmployee {
  employee_aid?: number;
  employee_number?: string | null;
  employee_first_name?: string | null;
  employee_last_name?: string | null;
  employee_middle_name?: string | null;
  employee_email?: string | null;
  employee_photo?: string | null;
  employee_job_pay_department_name?: string | null;
  employee_job_pay_job_title_name?: string | null;
  employee_job_pay_work_email?: string | null;
}

/** V1-style section list: Personal Information, Job and Pay, Earnings, Deduction, Payslip */
const MY_INFO_SECTIONS = [
  { id: "personal-information", label: "Personal Information" },
  { id: "job-and-pay", label: "Job and Pay" },
  { id: "earnings", label: "Earnings" },
  { id: "deduction", label: "Deduction" },
  { id: "payslip", label: "Payslip" },
] as const;

function unspecified(val: string | null | undefined): string {
  return (val ?? "").trim() || "Unspecified";
}

export default function StaffMyInfo() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<{ success: boolean; data: MyEmployee }>({
    queryKey: ["/api/me/employee"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/me/employee"), { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message =
          (err && (err.error || err.message)) ||
          (res.status === 404
            ? "No employee record is linked to your account."
            : res.status === 401
              ? "Your session has expired. Please sign in again."
              : `Failed to load your employee record (HTTP ${res.status}).`);
        throw new Error(message);
      }
      return res.json();
    },
    retry: false,
  });

  const employee = data?.data;
  const hasEmployee = !!employee;
  const errorMessage = error instanceof Error ? error.message : null;

  const fullName = employee
    ? [employee.employee_first_name, employee.employee_middle_name, employee.employee_last_name]
        .map((part) => (part ?? "").trim())
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">My Info</h1>
          <p className="text-muted-foreground">Your profile and employment information.</p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && error && (
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
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {isFetching ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Try again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && hasEmployee && (
          <div className="space-y-5">
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="shrink-0">
                    {employee?.employee_photo ? (
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
                        <ImageIcon className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-serif text-primary italic truncate">
                      {fullName || "Employee"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">{unspecified(employee?.employee_job_pay_job_title_name)}</span>
                      <span className="mx-2 opacity-50">•</span>
                      <span>{unspecified(employee?.employee_job_pay_department_name)}</span>
                    </p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <div>
                        <span className="font-semibold text-foreground">Employee #:</span>{" "}
                        {unspecified(employee?.employee_number)}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-foreground">Email:</span>{" "}
                        {unspecified(employee?.employee_job_pay_work_email ?? employee?.employee_email)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {MY_INFO_SECTIONS.map((section) => (
                    <li key={section.id}>
                      <Link
                        href={`/staff/my-info/${section.id}`}
                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <span className="flex items-center gap-2">
                          <User className="h-4 w-4 shrink-0 text-primary" />
                          <span className="text-foreground">{section.label}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
