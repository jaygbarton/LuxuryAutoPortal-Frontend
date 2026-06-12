import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { authMeQueryFn } from "@/lib/queryClient";

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
      queryFn: authMeQueryFn,
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

  // Does the cached data already carry server-computed role flags? The
  // optimistic login cache (login.tsx setQueryData) has a `user` object but
  // NO role flags, so we can't authorize from it. Once any of the role keys
  // is present we have real data and can render without waiting on a refetch.
  const hasRoleData =
    !!user &&
    ("isAdmin" in user ||
      "isClient" in user ||
      "isEmployee" in user ||
      "isCoHost" in user);

  // First load only: no usable role data yet AND a fetch is resolving it.
  // Returning null here is the unavoidable initial blank. Crucially we do NOT
  // blank during BACKGROUND refetches (window focus, 60s interval, the
  // refetchOnMount on every navigation) once we already hold real role data —
  // that was causing a white flicker on every page change. We keep rendering
  // the page (or redirecting) from the cached role flags instead.
  if (!hasRoleData && (isLoading || isFetching || !isFetchedAfterMount)) {
    return null;
  }

  if (!allowed) {
    setLocation(redirectTo);
    return null;
  }

  return <>{children}</>;
}
