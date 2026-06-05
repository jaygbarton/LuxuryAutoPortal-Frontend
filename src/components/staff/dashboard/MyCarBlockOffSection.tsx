import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, CalendarOff } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CarBlockOffRow {
  id: number;
  car_name: string;
  plate_number: string | null;
  owner_name: string;
  reason: string;
  reason_other: string | null;
  pickup_date: string | null;
  pickup_location: string | null;
  dropoff_date: string | null;
  dropoff_location: string | null;
  assigned_to: string | null;
  delivery_assigned_to: string | null;
  retrieval_assigned_to: string | null;
  status: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new:               { label: "New",               cls: "bg-gray-100 text-gray-700 border-gray-200" },
  car_not_available: { label: "Car Not Available", cls: "bg-red-100 text-red-700 border-red-200" },
  block_off_started: { label: "Block Off Started", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  blocked_off_ended: { label: "Blocked Off Ended", cls: "bg-green-100 text-green-700 border-green-200" },
};

const REASON_LABELS: Record<string, string> = {
  personal_use: "Personal Use",
  maintenance:  "Maintenance",
  others:       "Others",
};

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  try {
    const d = new Date(String(v).replace(" ", "T").replace(/Z$/, ""));
    return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return String(v); }
}

export default function MyCarBlockOffSection() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ success?: boolean; data?: CarBlockOffRow[] }>({
    queryKey: ["/api/me/car-block-off"],
    queryFn: async () => {
      const r = await fetch(buildApiUrl("/api/me/car-block-off"), { credentials: "include" });
      if (!r.ok) return { success: true, data: [] };
      return r.json();
    },
    retry: false,
  });

  const allRows = data?.data ?? [];
  const q = search.trim().toLowerCase();
  const rows = q
    ? allRows.filter((r) =>
        [r.car_name, r.plate_number, r.owner_name, r.pickup_location, r.dropoff_location, r.status]
          .some((v) => v && String(v).toLowerCase().includes(q))
      )
    : allRows;

  return (
    <section>
      <SectionHeader
        title="Car Block Off"
        subtitle="Block-off requests assigned to you"
        icon={<CalendarOff className="w-5 h-5" />}
        count={allRows.length}
      />

      <div className="relative mb-3 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border text-foreground text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Car", "Plate #", "Owner", "Reason", "Pick Up Date", "Pick Up Location", "Drop Off Date", "Drop Off Location", "My Role", "Status"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                No car block-off tasks assigned to you.
              </td></tr>
            ) : rows.map((r) => {
              const sm = STATUS_META[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
              // Determine which role(s) this employee plays in this record
              const roles: string[] = [];
              // We don't know the current user's name here, so show all assignment columns
              if (r.assigned_to) roles.push(`Assigned: ${r.assigned_to}`);
              if (r.delivery_assigned_to) roles.push(`Pick Up: ${r.delivery_assigned_to}`);
              if (r.retrieval_assigned_to) roles.push(`Drop Off: ${r.retrieval_assigned_to}`);

              return (
                <tr key={r.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-foreground">{r.car_name}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground text-xs">{r.plate_number ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-foreground">{r.owner_name}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-foreground">
                    {REASON_LABELS[r.reason] ?? r.reason}
                    {r.reason === "others" && r.reason_other && (
                      <div className="text-xs text-muted-foreground">{r.reason_other}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-foreground text-xs">{fmtDateTime(r.pickup_date)}</td>
                  <td className="px-3 py-2 text-foreground max-w-[150px] truncate">{r.pickup_location ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-foreground text-xs">{fmtDateTime(r.dropoff_date)}</td>
                  <td className="px-3 py-2 text-foreground max-w-[150px] truncate">{r.dropoff_location ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[160px]">
                    <div className="space-y-0.5">
                      {roles.map((role, i) => <div key={i}>{role}</div>)}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Badge variant="outline" className={cn("text-xs", sm.cls)}>{sm.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
