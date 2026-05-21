/**
 * Shared reservation-style table section for the employee dashboard.
 * Used by Pick Up & Drop Off, Turo Inspections, Car Issues, Maintenance, Operations.
 *
 * Each consumer supplies:
 *   - title / subtitle
 *   - api endpoint (graceful fallback on 404/501)
 *   - column definitions
 *
 * Rows are expected to be plain reservation-shaped objects coming from `/api/me/...`.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";

export interface ReservationRow {
  [key: string]: unknown;
}

export interface Column {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
  render?: (row: ReservationRow) => React.ReactNode;
}

interface Props {
  title: string;
  subtitle?: string;
  endpoint: string;
  queryKey: string;
  columns: Column[];
  emptyMessage?: string;
  maxRows?: number;
}

function asString(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default function ReservationsTableSection({
  title,
  subtitle,
  endpoint,
  queryKey,
  columns,
  emptyMessage = "Nothing assigned to you.",
  maxRows = 10,
}: Props) {
  const { data, isLoading } = useQuery<{ success?: boolean; data?: ReservationRow[] }>({
    queryKey: [queryKey, endpoint],
    queryFn: async () => {
      const r = await fetch(buildApiUrl(endpoint), { credentials: "include" });
      if (r.status === 404 || r.status === 501) return { success: true, data: [] };
      if (!r.ok) throw new Error(`Failed to load ${title}`);
      return r.json();
    },
    retry: false,
  });

  const rows = (data?.data ?? []).slice(0, maxRows);

  return (
    <div className="mb-8">
      <SectionHeader title={title} subtitle={subtitle} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-y border-[#FFCC00] border-collapse text-xs">
            <thead>
              <tr className="bg-black border-y border-[#FFCC00]">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="px-3 py-2 text-center font-bold uppercase text-white whitespace-nowrap"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="bg-white border-y border-[#FFCC00]">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-center text-black">
                      {c.render ? c.render(row) : asString(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
