import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { buildApiUrl } from "@/lib/queryClient";

interface AuthMe {
  user?: {
    isAdmin?: boolean;
    isClient?: boolean;
    isEmployee?: boolean;
  };
}

interface RequireRoleProps {
  children: React.ReactNode;
  /** At least one of these flags must be true on the authenticated user. */
  roles: ("isAdmin" | "isClient" | "isEmployee")[];
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

  const { data, isLoading } = useQuery<AuthMe>({
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

  if (isLoading) return null;

  const user = data?.user;
  const allowed = user && roles.some((role) => user[role] === true);

  if (!allowed) {
    setLocation(redirectTo);
    return null;
  }

  return <>{children}</>;
}
