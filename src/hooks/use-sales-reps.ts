import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";

/** Fallback while loading / on error — matches the backend default list. */
export const DEFAULT_SALES_REPS = ["Jay Barton", "Jenn Mason", "Brynn Lunn"];

/**
 * Admin-managed sales representative names (Settings → Sales Representatives).
 * Used by the client onboarding form and the client edit modal.
 * "Other" is never stored — append it in the dropdown where needed.
 */
export function useSalesReps() {
  const { data, isLoading } = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ["/api/settings/sales-reps"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/settings/sales-reps"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch sales representatives");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const salesReps =
    data?.data && data.data.length > 0 ? data.data : DEFAULT_SALES_REPS;

  return { salesReps, isLoading };
}
