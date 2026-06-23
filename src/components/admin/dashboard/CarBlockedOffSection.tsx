import { useQuery } from "@tanstack/react-query";
import { Loader2, CalendarOff } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
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
  dropoff_date: string | null;
  status: "new" | "car_not_available" | "block_off_started" | "blocked_off_ended";
}

interface SubmissionsResponse {
  success: boolean;
  data: CarBlockOff[];
  total: number;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-gray-100 text-gray-700 border-gray-200" },
  car_not_available: { label: "Car Not Available", className: "bg-red-100 text-red-700 border-red-200" },
  block_off_started: { label: "Block Off Started", className: "bg-amber-100 text-amber-700 border-amber-200" },
  blocked_off_ended: { label: "Blocked Off Ended", className: "bg-green-100 text-green-700 border-green-200" },
};

const REASON_LABELS: Record<string, string> = {
  personal_use: "Personal Use",
  maintenance: "Maintenance",
  others: "Others",
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("en-US", {
      timeZone: "America/Denver",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(v);
  }
}

export default function CarBlockedOffSection() {
  const [, setLocation] = useLocation();

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {records.map((r) => {
            const sm = STATUS_META[r.status] ?? STATUS_META["new"];
            const accent = REASON_ACCENT[r.reason] ?? REASON_ACCENT["others"];
            const reasonLabel = (REASON_LABELS[r.reason] ?? r.reason) +
              (r.reason === "others" && r.reason_other ? `: ${r.reason_other}` : "");
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
                  { label: "Drop Off Date", value: fmtDate(r.dropoff_date) },
                ]}
                statusControl={
                  <Badge variant="outline" className={`text-xs ${sm.className}`}>{sm.label}</Badge>
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
