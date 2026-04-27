import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { Eye, Search, Loader2, UserCog, LogOut, Briefcase } from "lucide-react";

/**
 * Mirror of /admin/view-as-client. Lets an admin pick a specific employee and
 * temporarily browse the staff workspace exactly as that employee sees it.
 *
 * Once started, the backend flips the session role flags on /api/auth/me
 * (isAdmin → false, isEmployee → true) and routes every staff /api/me/*
 * endpoint to the impersonated employee_aid, so the rendered pages are
 * identical to what the employee would see when logged in themselves.
 */

interface EmployeePick {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobTitle: string;
  displayName: string;
}

interface ViewStatus {
  active: boolean;
  employeeId?: number;
  employeeEmail?: string;
  employeeName?: string;
  startedAt?: string;
}

export default function ViewAsEmployeePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: statusData } = useQuery<{ success: boolean; data: ViewStatus }>({
    queryKey: ["/api/admin/view-as-employee/status"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-employee/status"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load status");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });
  const status = statusData?.data;

  const { data, isLoading } = useQuery<{ success: boolean; data: EmployeePick[] }>({
    queryKey: ["/api/admin/view-as-employee/employees"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-employee/employees"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load employees");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const employees = data?.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.displayName, e.email, e.firstName, e.lastName, e.employeeNumber, e.jobTitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [employees, search]);

  const startMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-employee/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employeeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to start");
      return json.data as {
        employeeId: number;
        employeeName: string;
        employeeEmail: string;
      };
    },
    onSuccess: async (d) => {
      toast({
        title: "Now viewing as employee",
        description: `${d.employeeName} (${d.employeeEmail})`,
      });
      // Hard-clear the cache so prior admin-scoped data doesn't render briefly
      // before the new auth/me payload (with flipped isAdmin) takes effect.
      qc.clear();
      // Force a full reload so AuthGuard, AdminLayout, and every page-level
      // useQuery re-mount with fresh state — same pattern as switch-role.
      window.location.assign("/staff/dashboard");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-employee/stop"), {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to stop");
      return json;
    },
    onSuccess: async () => {
      toast({ title: "Stopped", description: "Returned to admin view." });
      await qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await qc.invalidateQueries({
        queryKey: ["/api/admin/view-as-employee/status"],
      });
      qc.clear();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
              <UserCog className="w-6 h-6" />
              View as employee
            </h1>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Temporarily browse the staff workspace exactly as the selected
              employee sees it. Useful when training a new hire or
              troubleshooting their pages. Your admin session stays signed in;
              only the employee-scoped data is swapped, so every page (My Info,
              Time Sheet, Forms, etc.) renders the same way the employee would
              see it after logging in themselves.
            </p>
          </div>
        </div>

        {status?.active && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-amber-700 text-base flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Currently viewing as: {status.employeeName}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-sm text-amber-800/90">
                {status.employeeEmail}
                {status.startedAt && (
                  <>
                    {" "}
                    • started{" "}
                    {new Date(status.startedAt).toLocaleString("en-US", {
                      timeZone: "America/Denver",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })}
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-amber-500/50"
                  onClick={() => setLocation("/staff/dashboard")}
                >
                  Open employee workspace
                </Button>
                <Button
                  variant="outline"
                  className="border-red-500/50 text-red-700 hover:bg-red-500/10"
                  disabled={stopMutation.isPending}
                  onClick={() => stopMutation.mutate()}
                >
                  {stopMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4 mr-1" />
                  )}
                  Stop viewing as employee
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose an employee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, employee number, or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No employees found.
              </p>
            ) : (
              <div className="rounded-md border border-border divide-y divide-border max-h-[60vh] overflow-y-auto">
                {filtered.map((e) => {
                  const isCurrent = status?.active && status.employeeId === e.id;
                  return (
                    <div
                      key={e.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 hover:bg-muted/30"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {e.displayName}
                          {e.employeeNumber && (
                            <span className="text-xs text-muted-foreground ml-2">
                              #{e.employeeNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {e.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {e.jobTitle && (
                          <Badge variant="outline" className="text-xs">
                            <Briefcase className="w-3 h-3 mr-1" />
                            {e.jobTitle}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={isCurrent ? "outline" : "default"}
                          disabled={startMutation.isPending}
                          onClick={() => startMutation.mutate(e.id)}
                        >
                          {startMutation.isPending && startMutation.variables === e.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 mr-1" />
                          )}
                          {isCurrent ? "Re-enter" : "View as"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
