/**
 * The active user's effective timezone — their stored preference, or the
 * organization default (America/Denver) if they have not set one.
 *
 * Reads the same `["/api/auth/me"]` query the rest of the app already shares
 * (see use-co-host.ts for the same pattern), so this is a cache hit rather
 * than a second request. Deliberately not a React context provider: the
 * query cache already deduplicates across every consumer, and a provider
 * would only add a re-render boundary for nothing.
 */
import { useQuery } from "@tanstack/react-query";
import { authMeQueryFn, queryClient } from "@/lib/queryClient";

export const ORG_TIMEZONE_FALLBACK = "America/Denver";

/** Hook form, for use inside components. */
export function useTimezone(): string {
  const { data } = useQuery<{ user?: { effectiveTimezone?: string } }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    staleTime: 5 * 60 * 1000,
  });
  return data?.user?.effectiveTimezone ?? ORG_TIMEZONE_FALLBACK;
}

/**
 * Non-hook form, for event handlers and `mutationFn`s where a hook can't be
 * called. Reads whatever the query cache currently holds rather than issuing
 * its own request — if auth/me hasn't resolved yet, this falls back to the
 * org default rather than blocking.
 */
export function getActiveTimezone(): string {
  const data = queryClient.getQueryData<{ user?: { effectiveTimezone?: string } }>([
    "/api/auth/me",
  ]);
  return data?.user?.effectiveTimezone ?? ORG_TIMEZONE_FALLBACK;
}
