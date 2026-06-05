/**
 * Employee Onboarding Process – Forms section content
 * Mirrors Client Onboarding: share form, contract 1099, approval/submissions, offboarding.
 * Admin can approve (auto-create profile), edit details, and set hourly pay from employee profile.
 */

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TablePagination,
  ItemsPerPage,
} from "@/components/ui/table-pagination";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import {
  Search,
  Loader2,
  Copy,
  ExternalLink,
  UserCheck,
  XCircle,
  Pencil,
  UserX,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EMPLOYEE_FORM_LINK =
  typeof window !== "undefined" ? `${window.location.origin}/employee-form` : "/employee-form";

interface Employee {
  employee_aid: number;
  employee_status: string;
  employee_number: string;
  employee_first_name: string;
  employee_last_name: string;
  employee_email: string;
  employee_mobile_number?: string;
  employee_created: string;
  fullname?: string;
}

export function EmployeeOnboardingFormContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/employees", "forms-onboarding", searchQuery, page, itemsPerPage],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      params.append("page", page.toString());
      params.append("limit", itemsPerPage.toString());
      const res = await fetch(buildApiUrl(`/api/employees?${params.toString()}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const res = await fetch(buildApiUrl(`/api/employees/${employeeId}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to approve");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Approved", description: "Employee approved. They can now set their password and sign in." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const res = await fetch(buildApiUrl(`/api/employees/${employeeId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to remove");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Removed", description: "Employee submission removed." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(EMPLOYEE_FORM_LINK);
      toast({ title: "Copied", description: "Employee onboarding form link copied." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const employees: Employee[] = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 0 };
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded border border-border bg-card p-2">
            <QRCodeSVG value={EMPLOYEE_FORM_LINK} size={64} level="M" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Share with candidate</p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{EMPLOYEE_FORM_LINK}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2 w-full sm:w-auto">
            <Copy className="w-4 h-4" /> Copy link
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <a href={EMPLOYEE_FORM_LINK} target="_blank" rel="noopener noreferrer" className="gap-2">
              <ExternalLink className="w-4 h-4" /> Open form
            </a>
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Recent submissions</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : employees.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No employee submissions yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground hidden md:table-cell">Email</TableHead>
                    <TableHead className="text-muted-foreground hidden lg:table-cell">Phone</TableHead>
                    <TableHead className="text-muted-foreground hidden lg:table-cell">Submitted</TableHead>
                    <TableHead className="text-foreground">Status</TableHead>
                    <TableHead className="text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => {
                    const isPending = (emp.employee_status || "").toLowerCase() === "pending";
                    return (
                      <TableRow key={emp.employee_aid} className="border-border">
                        <TableCell className="font-medium text-foreground">
                          {emp.employee_last_name}, {emp.employee_first_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell truncate max-w-[180px]">
                          {emp.employee_email || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell">
                          {emp.employee_mobile_number || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell text-xs">
                          {emp.employee_created ? new Date(emp.employee_created).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              isPending && "border-amber-500/50 text-amber-700 bg-amber-500/10",
                              emp.employee_status === "" && "border-green-500/50 text-green-700 bg-green-500/10",
                              (emp.employee_status === "declined" || emp.employee_status === "offboarded") &&
                                "border-red-500/50 text-red-700 bg-red-500/10"
                            )}
                          >
                            {isPending ? "Pending" : emp.employee_status || "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isPending && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                  onClick={() => approveMutation.mutate(emp.employee_aid)}
                                  disabled={approveMutation.isPending}
                                >
                                  <UserCheck className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  title="Remove submission"
                                  onClick={() => {
                                    if (confirm(`Remove ${emp.employee_first_name} ${emp.employee_last_name} from submissions?`)) {
                                      deleteMutation.mutate(emp.employee_aid);
                                    }
                                  }}
                                  disabled={deleteMutation.isPending}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => setLocation(`/admin/hr/employees/view?employeeId=${emp.employee_aid}`)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              currentPage={page}
              totalItems={pagination.total}
              onPageChange={setPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        After approval, the employee receives an email to create their password. You can edit their details and add
        their <strong>hourly pay</strong> from the employee profile (Edit → Job and Pay / Rate History).
      </p>
    </div>
  );
}

export function EmployeeContract1099Content() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">GLA Contractor Policy 1099</h3>
            <p className="text-sm text-muted-foreground">
              Use this contract for 1099 contractors. After an employee completes the Employee Onboarding Form and you
              approve them, you can send the GLA Contractor Policy 1099 for signature from the employee profile, or
              manage contract templates in Settings.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/admin/hr/employees">Go to Employees</a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/admin/settings">Settings</a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmployeeOffboardingContent() {
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/employees", "forms-offboarding", page, itemsPerPage],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", itemsPerPage.toString());
      params.append("status", "active");
      const res = await fetch(buildApiUrl(`/api/employees?${params.toString()}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  const offboardMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const res = await fetch(buildApiUrl(`/api/employees/${employeeId}/offboard`), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to offboard");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Offboarded", description: "Employee has been offboarded and access deactivated." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const employees: Employee[] = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 0 };
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        End contract for employees and deactivate their system access. You can also offboard from the employee profile.
      </p>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : employees.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No active employees to offboard.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Email</TableHead>
                  <TableHead className="text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.employee_aid} className="border-border">
                    <TableCell className="font-medium text-foreground">
                      {emp.employee_last_name}, {emp.employee_first_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[200px]">
                      {emp.employee_email || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-amber-600 border-amber-500/50 hover:bg-amber-500/10"
                          onClick={() => {
                            if (confirm(`Offboard ${emp.employee_first_name} ${emp.employee_last_name}? This will deactivate their access.`)) {
                              offboardMutation.mutate(emp.employee_aid);
                            }
                          }}
                          disabled={offboardMutation.isPending}
                        >
                          <UserX className="w-4 h-4" /> Offboard
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => setLocation(`/admin/hr/employees/view?employeeId=${emp.employee_aid}`)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            currentPage={page}
            totalItems={pagination.total}
            onPageChange={setPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </>
      )}
    </div>
  );
}
