import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl, refreshAuthForSessionTransition } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { Eye, Search, Loader2, FileUser, LogOut } from "lucide-react";

interface ApplicantPick {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  stage: string | null;
}

interface ViewStatus {
  active: boolean;
  userId?: number;
  email?: string;
  name?: string;
}

/** Preview an LYC applicant's own pages, read-only, to see what they see. */
export default function ViewAsApplicantPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: statusData } = useQuery<{ success: boolean; data: ViewStatus }>({
    queryKey: ["/api/admin/view-as-applicant/status"],
    queryFn: () => api.get("/api/admin/view-as-applicant/status", { fallbackMessage: "Failed to load status" }),
    refetchOnWindowFocus: false,
  });
  const status = statusData?.data;

  const { data, isLoading, isError, refetch } = useQuery<{ success: boolean; data: ApplicantPick[] }>({
    queryKey: ["/api/admin/view-as-applicant/applicants"],
    queryFn: () => api.get("/api/admin/view-as-applicant/applicants", { fallbackMessage: "Failed to load applicants" }),
    refetchOnWindowFocus: false,
  });

  const applicants = data?.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return applicants;
    return applicants.filter((a) => [a.displayName, a.email, a.firstName, a.lastName, a.stage ?? ""].join(" ").toLowerCase().includes(q));
  }, [applicants, search]);

  const startMutation = useMutation({
    mutationFn: async (userId: number) => {
      const json = await api.post<{ data?: unknown }>("/api/admin/view-as-applicant/start", { userId }, { fallbackMessage: "Failed to start" });
      return json.data as { userId: number; name: string; email: string };
    },
    onSuccess: async (d) => {
      toast({ title: "Now viewing as applicant", description: `${d.name} (${d.email}) · read-only` });
      await refreshAuthForSessionTransition(qc);
      setLocation("/lyc/status");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-applicant/stop"), { method: "POST", credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to stop");
      return json;
    },
    onSuccess: async () => {
      toast({ title: "Stopped", description: "Returned to admin view." });
      await refreshAuthForSessionTransition(qc);
      await qc.invalidateQueries({ queryKey: ["/api/admin/view-as-applicant/status"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-primary flex items-center gap-2 leading-tight">
            <FileUser className="w-6 h-6" />
            View as Applicant
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            See an LYC applicant's own pages exactly as they do: their status, profile and saved
            applications. The preview is read-only. Saving and submitting are blocked, and secure
            answers (SSN, bank details, documents) are hidden. Your admin session stays signed in.
          </p>
        </div>

        {status?.active && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-amber-700 text-base flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Currently viewing as: {status.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-sm text-amber-800/90 break-words">{status.email}</p>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" className="border-amber-500/50 w-full sm:w-auto" onClick={() => setLocation("/lyc/status")}>
                  Open applicant view
                </Button>
                <Button
                  variant="outline"
                  className="border-red-500/50 text-red-700 hover:bg-red-500/10 w-full sm:w-auto"
                  disabled={stopMutation.isPending}
                  onClick={() => stopMutation.mutate()}
                >
                  {stopMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <LogOut className="w-4 h-4 mr-1" />}
                  Stop viewing as applicant
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose an applicant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name, email or stage..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" aria-label="Search applicants" />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : isError ? (
              <p role="alert" className="text-sm text-red-700 py-6 text-center">
                Applicants could not be loaded. <button className="underline" onClick={() => void refetch()}>Retry</button>
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {applicants.length === 0 ? "No applicant accounts yet." : "No applicants match your search."}
              </p>
            ) : (
              <div className="rounded-md border border-border divide-y divide-border max-h-[60vh] overflow-y-auto">
                {filtered.map((a) => {
                  const isCurrent = status?.active && status.userId === a.id;
                  return (
                    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 hover:bg-muted/30">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{a.displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        {a.stage && <Badge variant="outline" className="text-xs">{a.stage}</Badge>}
                        <Button size="sm" variant={isCurrent ? "outline" : "default"} disabled={startMutation.isPending} onClick={() => startMutation.mutate(a.id)}>
                          {startMutation.isPending && startMutation.variables === a.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
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
      <AdminPageLinks />
    </AdminLayout>
  );
}
