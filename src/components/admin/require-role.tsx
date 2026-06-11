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

  const { data, isLoading, isFetching, isFetchedAfterMount } =
    useQuery<AuthMe>({
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
      // Force a fresh fetch on every mount, ignoring staleTime. Without this,
      // the optimistic login cache (written by login.tsx's setQueryData and
      // MISSING server-computed role flags like isAdmin) is treated as "fresh"
      // for 30s, so navigating to an admin page right after login would judge
      // authorization against role-less data and bounce the user to /dashboard.
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchInterval: 1000 * 60,
    });

  const user = data?.user;
  const allowed = !!user && roles.some((role) => user[role] === true);

  // Authorization is decided ONLY after a genuine /api/auth/me network
  // response triggered by THIS mount has landed (isFetchedAfterMount). Until
  // then `data` may be the partial optimistic login cache, whose missing
  // isAdmin would wrongly read as "not allowed". Gating on the real fetch —
  // not a timing debounce — closes the post-login race deterministically:
  // there is no window in which we redirect based on pre-fetch cache.
  if (isLoading || isFetching || !isFetchedAfterMount) return null;

  if (!allowed) {
    setLocation(redirectTo);
    return null;
  }

  return <>{children}</>;
}
