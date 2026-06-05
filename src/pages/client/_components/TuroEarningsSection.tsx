import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Loader2, ImageIcon } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MONTHS_SHORT } from "./constants";

interface TuroEarningRow {
  id: number;
  car_id: number;
  year: number;
  month: number;
  image_url: string;
  filename: string;
}

interface Props {
  carId: number | null;
  year: string;
}

/**
 * Monthly Turo earnings screenshots for a car/year. Ported from gla-v3, where
 * each month carried an uploaded Turo earnings screenshot shown alongside the
 * income/expense view. Read-only here (admins manage the images).
 */
export function TuroEarningsSection({ carId, year }: Props) {
  const [preview, setPreview] = useState<TuroEarningRow | null>(null);

  const { data, isLoading } = useQuery<{ success?: boolean; list?: TuroEarningRow[] }>({
    queryKey: ["/api/client-turo-earnings", carId, year],
    queryFn: async () => {
      if (!carId) return { list: [] };
      const res = await fetch(
        buildApiUrl(`/api/client-turo-earnings?carId=${carId}&year=${year}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load Turo earnings");
      return res.json();
    },
    enabled: !!carId,
  });

  const rows = data?.list ?? [];
  if (!carId) return null;

  // Backend returns either a signed GCS https URL or a relative proxy path
  // (/api/client-turo-earnings/image/:id) for Drive-backed rows. Relative paths
  // must be resolved against the API origin.
  const resolveSrc = (u: string) => (u.startsWith("http") ? u : buildApiUrl(u));

  // Sort by month ascending for display.
  const byMonth = [...rows].sort((a, b) => a.month - b.month);

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <ImageIcon className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-primary">Turo Earnings Screenshots — {year}</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : byMonth.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No Turo earnings screenshots for {year}.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {byMonth.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setPreview(row)}
              className="group flex flex-col gap-1.5 rounded-lg border border-border overflow-hidden bg-muted/30 hover:shadow-md transition-shadow text-left"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                <img
                  src={resolveSrc(row.image_url)}
                  alt={`Turo earnings ${MONTHS_SHORT[row.month - 1]} ${row.year}`}
                  loading="lazy"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <span className="text-xs font-medium text-center pb-1.5">
                {MONTHS_SHORT[row.month - 1]} {row.year}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          {preview && (
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold">
                Turo Earnings — {MONTHS_SHORT[preview.month - 1]} {preview.year}
              </h4>
              <img
                src={resolveSrc(preview.image_url)}
                alt={`Turo earnings ${MONTHS_SHORT[preview.month - 1]} ${preview.year}`}
                className="w-full h-auto rounded-md"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
