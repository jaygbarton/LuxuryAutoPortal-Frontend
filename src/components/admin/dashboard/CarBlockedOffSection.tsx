import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CalendarOff } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SectionHeader } from "./SectionHeader";
import { DashboardRecordCard } from "./DashboardRecordCard";
import { useLocation } from "wouter";

// Accent color per block-off reason so the cards are scannable at a glance.
const REASON_ACCENT: Record<string, { bg: string; border: string }> = {
  personal_use: { bg: "bg-purple-500", border: "border-purple-300" },
  maintenance: { bg: "bg-red-500", border: "border-red-300" },
  others: { bg: "bg-slate-500", border: "border-slate-300" },
};

interface CarBlockOff {
  id: number;
  car_name: string;
  plate_number: string | null;
  owner_name: string;
  reason: "personal_use" | "maintenance" | "others";
  reason_other: string | null;
  pickup_date: string;
  pickup_location: string;
  /** Planned end of the block-off, captured up front on the Start form. */
  block_off_end_date: string | null;
  /** ACTUAL return date, only set once the car owner submits the End (Drop
   *  Off) form. Null the whole time the block-off is open. */
  dropoff_date: string | null;
  status: "new" | "car_not_available" | "car_blocked_off";
}

interface SubmissionsResponse {
  success: boolean;
  data: CarBlockOff[];
  total: number;
}

// Ordered list so the inline status dropdown lists options in a sensible order —
// mirrors STATUS_OPTIONS in the Operations Car Block Off tab.
const STATUS_OPTIONS = [
  { value: "new", label: "New", className: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "car_blocked_off", label: "Car Blocked Off", className: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "car_not_available", label: "Car Not Available", className: "bg-red-100 text-red-700 border-red-200" },
];

function statusMeta(v: string) {
  return STATUS_OPTIONS.find((s) => s.value === v) ?? STATUS_OPTIONS[0];
}

const REASON_LABELS: Record<string, string> = {
  personal_use: "Personal Use",
  maintenance: "Maintenance",
  others: "Others",
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  try {
    // pickup/dropoff are captured via a <input type="datetime-local"> and stored
    // AS-IS (naive Mountain wall-clock) — mysql2 tacks on a spurious "Z". Strip
    // it and parse as local so the time shows exactly what was entered (matching
    // the Operations Car Block Off tab). Treating it as UTC would shift the hour.
    const normalized = String(v).replace(" ", "T").replace(/Z$/, "");
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
}

export default function CarBlockedOffSection() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<SubmissionsResponse>({
    queryKey: ["/api/car-block-off/submissions", "dashboard"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/car-block-off/submissions?limit=50"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // Inline status update — same endpoint the Operations Car Block Off tab uses,
  // so a status changed here shows up there and vice-versa. Invalidates both
  // query keys so every view refreshes.
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(buildApiUrl(`/api/car-block-off/submissions/${id}/status`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || `HTTP ${res.status}`);
      return body;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/car-block-off/submissions"] }),
    onError: (err: any) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const records = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="CAR BLOCKED OFF" subtitle="PERSONAL USE / MAINTENANCE" className="mb-0" />
        <button
          onClick={() => setLocation("/admin/car-block-off")}
          className="text-xs text-[#B8860B] hover:underline"
        >
          View All {total > 0 && `(${total})`}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <CalendarOff className="w-8 h-8 opacity-40" />
          <p className="text-sm">No car block-off records.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((r) => {
            const sm = statusMeta(r.status);
            const accent = REASON_ACCENT[r.reason] ?? REASON_ACCENT["others"];
            const reasonLabel = (REASON_LABELS[r.reason] ?? r.reason) +
              (r.reason === "others" && r.reason_other ? `: ${r.reason_other}` : "");
            // dropoff_date is only written once the car is actually returned
            // (submitDropoff) — it's null the whole time the block-off is open.
            // Fall back to the planned block_off_end_date (captured up front on
            // the Start form) so the card always answers "when is drop off?"
            // instead of silently hiding the row.
            const isActualDropoff = !!r.dropoff_date;
            const dropOffLabel = isActualDropoff ? "Drop Off Date" : "Drop Off Date (Planned)";
            const dropOffValue = fmtDate(r.dropoff_date ?? r.block_off_end_date);
            return (
              <DashboardRecordCard
                key={r.id}
                accentBg={accent.bg}
                accentBorder={accent.border}
                typeLabel={REASON_LABELS[r.reason] ?? r.reason}
                carName={r.car_name}
                plate={r.plate_number}
                guestName={r.owner_name ? `Owner: ${r.owner_name}` : null}
                pickupLocation={r.pickup_location}
                details={[
                  { label: "Reason", value: reasonLabel },
                  { label: "Pick Up Date", value: fmtDate(r.pickup_date) },
                  { label: dropOffLabel, value: dropOffValue },
                ]}
                statusControl={
                  // Inline status dropdown. stopPropagation so opening/changing
                  // it doesn't trigger the card's navigate-to-page onClick.
                  <div onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={r.status}
                      onValueChange={(v) => statusMutation.mutate({ id: r.id, status: v })}
                      disabled={statusMutation.isPending}
                    >
                      <SelectTrigger className={`h-7 text-xs w-40 border ${sm.className}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                }
                onClick={() => setLocation("/admin/car-block-off")}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
