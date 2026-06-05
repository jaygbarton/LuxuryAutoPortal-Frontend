import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Loader2, ImageIcon } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface TuroEarningRow {
  id: number;
  car_id: number;
  year: number;
  month: number;
  image_url: string;
  filename: string;
}

interface Props {
  carId: number;
  year: string;
}

/**
 * Admin view of the monthly Turo earnings screenshots for a car/year.
 * Ported from gla-v3 (shown inside the car income/expense view).
 */
export function TuroEarningsPanel({ carId, year }: Props) {
  const [preview, setPreview] = useState<TuroEarningRow | null>(null);

  const { data, isLoading } = useQuery<{ success?: boolean; list?: TuroEarningRow[] }>({
    queryKey: ["/api/client-turo-earnings", carId, year],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/client-turo-earnings?carId=${carId}&year=${year}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load Turo earnings");
      return res.json();
    },
    enabled: !!carId,
  });

  const rows = [...(data?.list ?? [])].sort((a, b) => a.month - b.month);

  // Drive-backed rows return a relative proxy path; resolve against API origin.
  const resolveSrc = (u: string) => (u.startsWith("http") ? u : buildApiUrl(u));

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <ImageIcon className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-primary">Turo Earnings Screenshots — {year}</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No Turo earnings screenshots for {year}.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {rows.map((row) => (
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
