import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

// I&E edits are often made in one window while the dashboard is open in
// another (admin editing a car's I&E beside a "view as co-host" dashboard).
// React Query's refetchOnWindowFocus only listens for `visibilitychange`,
// which never fires for two windows side by side, so the dashboard kept its
// old splits until a manual reload. Saves announce themselves here instead.
const CHANNEL = "gla-income-expense";

/** Call after any I&E write succeeds; other tabs/windows refetch their views. */
export function notifyIncomeExpenseChanged(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage("changed");
  channel.close();
}

/**
 * Invalidate `queryKeys` when an I&E write is announced from another tab or
 * window, and when this window regains focus (covers a second browser, where
 * the broadcast cannot reach).
 */
export function useInvalidateOnIncomeExpenseChange(queryKeys: QueryKey[]): void {
  const queryClient = useQueryClient();
  const serializedKeys = JSON.stringify(queryKeys);
  useEffect(() => {
    const invalidate = () => {
      for (const queryKey of JSON.parse(serializedKeys) as QueryKey[]) {
        queryClient.invalidateQueries({ queryKey });
      }
    };
    window.addEventListener("focus", invalidate);
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
    if (channel) channel.onmessage = invalidate;
    return () => {
      window.removeEventListener("focus", invalidate);
      channel?.close();
    };
  }, [queryClient, serializedKeys]);
}
