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
import { Eye, Search, Loader2, UserCog, LogOut, Car } from "lucide-react";

interface ClientPick {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  carCount: number;
}

interface ViewStatus {
  active: boolean;
  clientId?: number;
  clientEmail?: string;
  clientName?: string;
  startedAt?: string;
}

export default function ViewAsClientPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: statusData } = useQuery<{ success: boolean; data: ViewStatus }>({
    queryKey: ["/api/admin/view-as-client/status"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-client/status"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load status");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });
  const status = statusData?.data;

  const { data, isLoading } = useQuery<{ success: boolean; data: ClientPick[] }>({
    queryKey: ["/api/admin/view-as-client/clients"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-client/clients"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load clients");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const clients = data?.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.displayName, c.email, c.firstName, c.lastName]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [clients, search]);

  const startMutation = useMutation({
    mutationFn: async (clientId: number) => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-client/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to start");
      return json.data as { clientId: number; clientName: string; clientEmail: string };
    },
    onSuccess: async (d) => {
      toast({
        title: "Now viewing as client",
        description: `${d.clientName} (${d.clientEmail})`,
      });
      qc.clear();
      // Hard reload so AuthGuard, AdminLayout, and every page-level useQuery
      // re-mount with the un-cached, impersonated /api/auth/me payload from
      // the first paint — same rationale as switch-role / view-as-employee.
      window.location.assign("/dashboard");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-client/stop"), {
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
        queryKey: ["/api/admin/view-as-client/status"],
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
              View as client
            </h1>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Temporarily browse the system exactly as the selected client sees
              it. Useful when running meetings with a client. Your admin session
              stays signed in; only the client-scoped data is swapped.
            </p>
          </div>
        </div>

        {status?.active && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-amber-700 text-base flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Currently viewing as: {status.clientName}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-sm text-amber-800/90">
                {status.clientEmail}
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
                  onClick={() => setLocation("/dashboard")}
                >
                  Open client dashboard
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
                  Stop viewing as client
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose a client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
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
                No clients found.
              </p>
            ) : (
              <div className="rounded-md border border-border divide-y divide-border max-h-[60vh] overflow-y-auto">
                {filtered.map((c) => {
                  const isCurrent = status?.active && status.clientId === c.id;
                  return (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 hover:bg-muted/30"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {c.displayName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          <Car className="w-3 h-3 mr-1" />
                          {c.carCount} {c.carCount === 1 ? "car" : "cars"}
                        </Badge>
                        <Button
                          size="sm"
                          variant={isCurrent ? "outline" : "default"}
                          disabled={startMutation.isPending}
                          onClick={() => startMutation.mutate(c.id)}
                        >
                          {startMutation.isPending && startMutation.variables === c.id ? (
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
