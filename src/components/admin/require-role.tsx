import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { buildApiUrl } from "@/lib/queryClient";

interface AuthMe {
  user?: {
    isAdmin?: boolean;
    isClient?: boolean;
    isEmployee?: boolean;
    isCoHost?: boolean;
  };
}

interface RequireRoleProps {
  children: React.ReactNode;
  /** At least one of these flags must be true on the authenticated user. */
  roles: ("isAdmin" | "isClient" | "isEmployee" | "isCoHost")[];
  /** Where to send unauthorized users. Defaults to /dashboard. */
  redirectTo?: string;
}

/**
 * Route-level authorization guard. Reads the already-cached /api/auth/me
 * response (populated by AuthGuard) and redirects to `redirectTo` if the
 * logged-in user doesn't have one of the required roles.
 *
 * Use inside AdminLayout's inner Switch to gate individual routes, e.g.:
 *   <RequireRole roles={["isAdmin"]}><AdminOnlyPage /></RequireRole>
 */
export function RequireRole({
  children,
  roles,
  redirectTo = "/dashboard",
}: RequireRoleProps) {
  const [, setLocation] = useLocation();

  const { data, isLoading, isFetching } = useQuery<AuthMe>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), {
        credentials: "include",
      });
      if (!res.ok) return { user: undefined };
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 30,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 60,
  });

  const user = data?.user;
  const allowed = !!user && roles.some((role) => user[role] === true);

  // Only redirect once the auth state has genuinely settled. Without this,
  // a background refetch (mount / window-focus / 60s interval) or the
  // optimistic login cache — which is MISSING server-computed role flags
  // like isAdmin — flips `allowed` to false for a moment and we'd hard-
  // redirect the user back to /dashboard a few seconds after they navigate
  // to an admin page. We wait for fetching to finish, then confirm the
  // denial after a short debounce so a transient miss can't bounce the user.
  useEffect(() => {
    if (isLoading || isFetching) return;
    if (allowed) return;

    const timer = setTimeout(() => {
      setLocation(redirectTo);
    }, 600);
    return () => clearTimeout(timer);
  }, [isLoading, isFetching, allowed, redirectTo, setLocation]);

  // While loading, fetching, or in the pre-redirect grace window for an
  // unauthorized user, render nothing rather than flashing the page.
  if (isLoading || isFetching) return null;
  if (!allowed) return null;

  return <>{children}</>;
}
