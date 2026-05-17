import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";

interface CarRow {
  id: number;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  makeModel?: string | null;
  plateNumber?: string | null;
  licensePlate?: string | null;
}

/**
 * Hook that returns a helper which appends the car's year to a car name string.
 *
 * Turo's emails ship bare make+model strings like "Lexus GX". The user wants
 * the table cells to show "Lexus GX 2025" — the trailing year matches the
 * format the team uses verbally ("Toyota Sequoia 2024"). The year is sourced
 * from the Cars table, matched by plate # first (unique) and falling back to
 * make+model substring.
 *
 * Used across every operations tab + the Turo Trips page so the column
 * always renders consistently.
 */
export function useCarNameWithYear() {
  const { data } = useQuery<{ success: boolean; data: CarRow[] }>({
    queryKey: ["/api/cars", "name-year-lookup"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/cars?limit=500"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const byPlate = useMemo(() => {
    const map = new Map<string, CarRow>();
    for (const c of data?.data || []) {
      const plate = (c.plateNumber || c.licensePlate || "").trim().toUpperCase();
      if (plate) map.set(plate, c);
    }
    return map;
  }, [data]);

  const byMakeModel = useMemo(() => {
    const map = new Map<string, CarRow>();
    for (const c of data?.data || []) {
      const key = `${c.make || ""} ${c.model || ""}`.trim().toLowerCase();
      if (key) map.set(key, c);
    }
    return map;
  }, [data]);

  return useCallback(
    (carName: string | null | undefined, plate?: string | null): string => {
      if (!carName) return "-";
      // Already has a 4-digit year anywhere in the string — leave it alone.
      if (/\b(19|20)\d{2}\b/.test(carName)) return carName;
      // Prefer plate-based match — plate # uniquely identifies one car.
      if (plate) {
        const hit = byPlate.get(plate.trim().toUpperCase());
        if (hit?.year) return `${carName} ${hit.year}`;
      }
      // Fallback: match by make+model substring.
      const lower = carName.toLowerCase();
      for (const [key, c] of byMakeModel.entries()) {
        if (key && lower.includes(key) && c.year) {
          return `${carName} ${c.year}`;
        }
      }
      return carName;
    },
    [byPlate, byMakeModel],
  );
}
