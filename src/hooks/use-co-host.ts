import { useQuery } from "@tanstack/react-query";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";

/**
 * Returns the list of car IDs assigned to the active co-host.
 * Returns null when not in co-host context (i.e. regular admin — no filter needed).
 */
export function useCoHostCarIds(): number[] | null {
  const { isCoHost } = useCoHost();
  const { data } = useQuery<{ success: boolean; cars: { id: number }[] }>({
    queryKey: ["/api/co-host/my-vehicles"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/co-host/my-vehicles"), { credentials: "include" });
      if (!res.ok) return { success: false, cars: [] };
      return res.json();
    },
    enabled: isCoHost,
    staleTime: 2 * 60 * 1000,
  });
  if (!isCoHost) return null;
  return (data?.cars ?? []).map((c) => c.id);
}

/**
 * Returns co-host context for the current session.
 * Works for both:
 *   - Real co-host logged in (isCoHost=true from /api/auth/me)
 *   - Admin impersonating a co-host via "View as Co-Host"
 */
export function useCoHost() {
  const { data } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    staleTime: 5 * 60 * 1000,
  });

  const user = data?.user;
  const isRealCoHost = !!(user as any)?.isCoHost;
  const isViewingAsCoHost = !!(user as any)?.viewAsCoHost?.coHostId;
  const isCoHost = isRealCoHost || isViewingAsCoHost;
  const coHostId: number | null = isRealCoHost
    ? (user as any).coHostId ?? null
    : isViewingAsCoHost
      ? (user as any).viewAsCoHost.coHostId
      : null;

  return { isCoHost, isRealCoHost, isViewingAsCoHost, coHostId, user };
}
