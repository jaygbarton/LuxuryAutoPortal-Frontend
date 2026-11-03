import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Fallback while loading / on error — matches the backend default list. */
export const DEFAULT_SALES_REPS = ["Andy Zhang", "Jay Barton", "Jenn Mason", "Brynn Lunn"];

/**
 * Admin-managed sales representative names (Settings → Sales Representatives).
 * Used by the client onboarding form and the client edit modal.
 * "Other" is never stored — append it in the dropdown where needed.
 */
export function useSalesReps() {
  const { data, isLoading } = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ["/api/settings/sales-reps"],
    queryFn: async () => {
      return api.get("/api/settings/sales-reps", {
        fallbackMessage: "Failed to fetch sales representatives",
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  const salesReps =
    data?.data && data.data.length > 0 ? data.data : DEFAULT_SALES_REPS;

  return { salesReps, isLoading };
}
