import { useQuery } from "@tanstack/react-query";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";

/**
 * Returns the list of car IDs assigned to the active co-host.
 * Returns null when not in co-host context (i.e. regular admin — no filter needed).
 */
type CoHostVehicle = { id: number; locationTag?: string | null };

function useCoHostVehicles() {
  const { isCoHost } = useCoHost();
  const { data } = useQuery<{ success: boolean; cars: CoHostVehicle[] }>({
    queryKey: ["/api/co-host/my-vehicles"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/co-host/my-vehicles"), { credentials: "include" });
      if (!res.ok) return { success: false, cars: [] };
      return res.json();
    },
    enabled: isCoHost,
    staleTime: 2 * 60 * 1000,
  });
  return { isCoHost, cars: data?.cars ?? [] };
}

export function useCoHostCarIds(): number[] | null {
  const { isCoHost, cars } = useCoHostVehicles();
  if (!isCoHost) return null;
  return cars.map((c) => c.id);
}

/**
 * The distinct location tags of the co-host's own cars, or null for a regular
 * admin (no restriction). A co-host whose fleet is all in one city must not be
 * offered the other locations in a filter — that reveals the existence of
 * vehicles they have no access to.
 *
 * Returns an empty array while the fleet is still loading or genuinely empty;
 * callers should fall back to showing everything only when this is null.
 */
export function useCoHostLocationTags(): string[] | null {
  const { isCoHost, cars } = useCoHostVehicles();
  if (!isCoHost) return null;
  const tags = new Set<string>();
  for (const c of cars) {
    const tag = c.locationTag?.trim().toLowerCase();
    if (tag) tags.add(tag);
  }
  return [...tags];
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
