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
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
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

function parsePhotos(v: unknown): string[] {
  if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const p = JSON.parse(v);
    if (Array.isArray(p)) return p.map(String).filter(Boolean);
  } catch {}
  // single URL string
  if (v.startsWith("http")) return [v];
  return [];
}

function PhotosCell({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const photos = parsePhotos(value);
  if (photos.length === 0) return <span>—</span>;
  const visible = expanded ? photos : photos.slice(0, 2);
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {visible.map((src, i) => (
        <a key={i} href={src} target="_blank" rel="noopener noreferrer">
          <img
            src={getProxiedImageUrl(src)}
            alt={`Photo ${i + 1}`}
            className="w-10 h-10 object-cover rounded border border-[#D3BC8D] hover:opacity-80 transition-opacity"
          />
        </a>
      ))}
      {!expanded && photos.length > 2 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-[10px] text-[#B8860B] hover:underline whitespace-nowrap"
        >
          +{photos.length - 2} more
        </button>
      )}
    </div>
  );
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

export function fmtDateTime(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  try {
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString("en-US", {
      timeZone: "America/Denver",
      weekday: "short",
      month: "short",
      day: "numeric",
    }) + ", " + d.toLocaleTimeString("en-US", {
      timeZone: "America/Denver",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignedToFilter, setAssignedToFilter] = useState("all");
  const [tripStartFrom, setTripStartFrom] = useState("");
  const [tripEndTo, setTripEndTo] = useState("");

  const colKeys = useMemo(() => new Set(columns.map((c) => c.key)), [columns]);
  const hasAssignedTo = colKeys.has("assigned_to");
  const hasTripStart = colKeys.has("trip_start");
  const hasTripEnd = colKeys.has("trip_end");

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

  const allRows = data?.data ?? [];

  const statusOptions = useMemo(() => (statusEdit ? statusEdit.options : []), [statusEdit]);

  const assignedToOptions = useMemo(() => {
    if (!hasAssignedTo) return [];
    const names = new Set<string>();
    for (const row of allRows) {
      const v = String(row["assigned_to"] ?? "").trim();
      if (v && v !== "—") names.add(v);
    }
    return Array.from(names).sort();
  }, [allRows, hasAssignedTo]);

  const rows = useMemo(() => {
    let filtered = allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((row) =>
        Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all" && statusEdit) {
      filtered = filtered.filter((row) => String(row[statusEdit.columnKey] ?? "") === statusFilter);
    }
    if (assignedToFilter !== "all" && hasAssignedTo) {
      filtered = filtered.filter((row) => String(row["assigned_to"] ?? "").trim() === assignedToFilter);
    }
    if (tripStartFrom && hasTripStart) {
      const from = new Date(tripStartFrom).getTime();
      filtered = filtered.filter((row) => {
        const v = row["trip_start"];
        if (!v) return false;
        return new Date(String(v)).getTime() >= from;
      });
    }
    if (tripEndTo && hasTripEnd) {
      const to = new Date(tripEndTo).getTime() + 86400000 - 1; // inclusive end of day
      filtered = filtered.filter((row) => {
        const v = row["trip_end"];
        if (!v) return false;
        return new Date(String(v)).getTime() <= to;
      });
    }
    return filtered.slice(0, maxRows);
  }, [allRows, search, statusFilter, assignedToFilter, tripStartFrom, tripEndTo, statusEdit, hasAssignedTo, hasTripStart, hasTripEnd, maxRows]);

  const isFiltered = search || statusFilter !== "all" || assignedToFilter !== "all" || tripStartFrom || tripEndTo;

  function clearAll() {
    setSearch(""); setStatusFilter("all"); setAssignedToFilter("all"); setTripStartFrom(""); setTripEndTo("");
  }

  return (
    <div className="mb-8">
      <SectionHeader title={title} subtitle={subtitle} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 mt-2">
        {/* Search */}
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reservation, car, guest…"
            className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Status */}
        {statusOptions.length > 0 && (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]">
            <option value="all">All Statuses</option>
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}

        {/* Assigned To */}
        {hasAssignedTo && assignedToOptions.length > 0 && (
          <select value={assignedToFilter} onChange={(e) => setAssignedToFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]">
            <option value="all">All Assignees</option>
            {assignedToOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}

        {/* Trip Start From */}
        {hasTripStart && (
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">Trip Start From</label>
            <input type="date" value={tripStartFrom} onChange={(e) => setTripStartFrom(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
            {tripStartFrom && <button onClick={() => setTripStartFrom("")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
          </div>
        )}

        {/* Trip End To */}
        {hasTripEnd && (
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">Trip Ends To</label>
            <input type="date" value={tripEndTo} onChange={(e) => setTripEndTo(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]" />
            {tripEndTo && <button onClick={() => setTripEndTo("")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
          </div>
        )}

        {/* Results count + clear */}
        {isFiltered && (
          <>
            <span className="text-xs text-gray-500">{rows.length} result{rows.length !== 1 ? "s" : ""}</span>
            <button onClick={clearAll} className="text-xs text-[#B8860B] hover:underline">Clear all</button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {isFiltered ? "No matching results." : emptyMessage}
        </p>
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
                            : c.key === "photos"
                              ? <PhotosCell value={row[c.key]} />
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
