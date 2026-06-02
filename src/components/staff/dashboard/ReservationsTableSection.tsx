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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

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

export interface StatusOption {
  value: string;
  label: string;
  className?: string;
}

/**
 * Opt-in inline status editor for one column. When supplied, the table renders
 * a dropdown in `columnKey`'s cell and PATCHes `{endpoint}/{rowId}/status` with
 * `{ status }`. Rows missing the id field fall back to a static label.
 */
export interface StatusEditConfig {
  columnKey: string;
  idKey: string; // row field holding the record id (e.g. "id")
  endpoint: string; // PATCH base, e.g. "/api/me/inspections"
  options: StatusOption[];
}

interface Props {
  title: string;
  subtitle?: string;
  endpoint: string;
  queryKey: string;
  columns: Column[];
  emptyMessage?: string;
  maxRows?: number;
  statusEdit?: StatusEditConfig;
}

function asString(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

// Shared cell formatters so the staff dashboard tables render trip columns the
// same way the admin Operations tabs do.
export function fmtMoney(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtNum(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

// Days Rented can come back negative/NaN when a trip is missing a start or end
// date; show a dash rather than a misleading number.
export function fmtDays(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!isFinite(n) || n < 0) return "—";
  return String(n);
}

export default function ReservationsTableSection({
  title,
  subtitle,
  endpoint,
  queryKey,
  columns,
  emptyMessage = "Nothing assigned to you.",
  maxRows = 10,
  statusEdit,
}: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const updateStatus = useMutation({
    mutationFn: async (vars: { id: number | string; status: string }) => {
      const r = await fetch(
        buildApiUrl(`${statusEdit!.endpoint}/${vars.id}/status`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: vars.status }),
        },
      );
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey, endpoint] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => {
      toast({
        title: "Could not update status",
        description: e?.message ?? "",
        variant: "destructive",
      });
    },
  });

  // Render the inline status dropdown for the configured column. Falls back to
  // a plain label when the row has no id to PATCH against.
  function renderStatusCell(row: ReservationRow) {
    const cfg = statusEdit!;
    const id = row[cfg.idKey] as number | string | undefined;
    const current = String(row[cfg.columnKey] ?? "");
    const match = cfg.options.find((o) => o.value === current);
    if (id == null) return match?.label ?? asString(current);
    return (
      <Select
        value={match?.value ?? current}
        onValueChange={(v) => updateStatus.mutate({ id, status: v })}
        disabled={updateStatus.isPending}
      >
        <SelectTrigger className={`h-8 w-[150px] mx-auto text-xs ${match?.className ?? ""}`}>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {cfg.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

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
          <table className="w-full border-y border-[#D3BC8D] border-collapse text-xs">
            <thead>
              <tr className="bg-black border-y border-[#D3BC8D]">
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
                <tr key={i} className="bg-white border-y border-[#D3BC8D]">
                  {columns.map((c) => {
                    const isStatusEditor =
                      statusEdit && c.key === statusEdit.columnKey;
                    return (
                      <td key={c.key} className="px-3 py-2 text-center text-black">
                        {isStatusEditor
                          ? renderStatusCell(row)
                          : c.render
                            ? c.render(row)
                            : asString(row[c.key])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
