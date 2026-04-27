import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AuthMe {
  user?: {
    isAdmin?: boolean;
    isEmployee?: boolean;
    isClient?: boolean;
    /**
     * True when the underlying logged-in user is an admin, even though the
     * /api/auth/me payload is currently presenting them as a client/employee
     * because of the "View as ..." impersonation features. We rely on this
     * (rather than `isAdmin`) to decide whether to render the impersonation
     * banner, since `isAdmin` is intentionally false during impersonation so
     * that page-level role checks correctly treat the session as the
     * impersonated role.
     */
    impersonatorIsAdmin?: boolean;
    viewAsClient?: {
      clientId: number;
      clientEmail: string;
      clientName: string;
      startedAt: string;
    };
    viewAsEmployee?: {
      employeeId: number;
      employeeEmail: string;
      employeeName: string;
      startedAt: string;
    };
  };
}

/**
 * Unified "View as ..." banner.
 *
 * Shows a sticky bar across the top of every page whenever an admin is
 * browsing the system as another role via real backend impersonation:
 *   - "View as Client"   — session.viewAsClient is set
 *   - "View as Employee" — session.viewAsEmployee is set
 *
 * Both states render the same UX with a single "Exit" button so admins can
 * always return to their own admin dashboard. Because impersonation is real
 * (the /api/auth/me payload flips role flags), the rendered pages match
 * exactly what the impersonated client/employee would see when logged in.
 */
export function ViewAsClientBanner() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data } = useQuery<AuthMe>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), {
        credentials: "include",
      });
      if (!res.ok) return { user: undefined };
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const stopClientMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-client/stop"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to stop");
      }
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "Back to admin", description: "Returned to admin view." });
      qc.clear();
      // Hard reload so every component re-mounts with the un-impersonated
      // session (admin flags restored). Same rationale as switch-role.
      window.location.assign("/dashboard");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const stopEmployeeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/view-as-employee/stop"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to stop");
      }
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "Back to admin", description: "Returned to admin view." });
      qc.clear();
      window.location.assign("/dashboard");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const user = data?.user;
  // Show the banner whenever the underlying logged-in user is an admin —
  // either currently identified as admin, or temporarily presenting as a
  // client/employee through the impersonation feature (impersonatorIsAdmin).
  const isUnderlyingAdmin = !!user?.isAdmin || !!user?.impersonatorIsAdmin;
  if (!isUnderlyingAdmin) return null;

  const viewingAsClient = !!user?.viewAsClient?.clientId;
  const viewingAsEmployee = !viewingAsClient && !!user?.viewAsEmployee?.employeeId;

  if (!viewingAsClient && !viewingAsEmployee) return null;

  const label = viewingAsClient ? "Client" : "Employee";
  const subtitle = viewingAsClient
    ? `${user.viewAsClient!.clientName} (${user.viewAsClient!.clientEmail})`
    : `${user.viewAsEmployee!.employeeName} (${user.viewAsEmployee!.employeeEmail})`;
  const actionLabel = viewingAsClient ? "Exit client view" : "Exit employee view";
  const onAction = () => {
    if (viewingAsClient) {
      stopClientMutation.mutate();
    } else {
      stopEmployeeMutation.mutate();
    }
  };
  const isLoading =
    (viewingAsClient && stopClientMutation.isPending) ||
    (viewingAsEmployee && stopEmployeeMutation.isPending);

  return (
    <div className="sticky top-0 z-30 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-3 sm:mb-4 md:mb-6 border-b border-amber-500/40 bg-amber-500/15 backdrop-blur px-3 sm:px-4 md:px-6 py-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-amber-900 min-w-0">
          <Eye className="w-4 h-4 shrink-0" />
          <span className="truncate">
            Admin view: viewing as <span className="font-semibold">{label}</span>
            <span className="hidden sm:inline"> — {subtitle}</span>
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-600/60 text-amber-900 hover:bg-amber-500/20 shrink-0"
          disabled={isLoading}
          onClick={onAction}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5 mr-1" />
          )}
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
