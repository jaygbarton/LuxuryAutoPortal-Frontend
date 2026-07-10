import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, { bg: string; text: string }> = {
  new: { bg: "bg-gray-500/20", text: "text-gray-400" },
  in_progress: { bg: "bg-yellow-500/20", text: "text-yellow-500" },
  completed: { bg: "bg-green-500/20", text: "text-green-500" },
  delivered: { bg: "bg-blue-500/20", text: "text-blue-400" },
  booked: { bg: "bg-blue-500/20", text: "text-blue-400" },
  ended: { bg: "bg-slate-500/20", text: "text-slate-300" },
  returned: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  cancelled: { bg: "bg-red-500/20", text: "text-red-500" },
  active: { bg: "bg-green-500/20", text: "text-green-500" },
  damage_reported: { bg: "bg-orange-500/20", text: "text-orange-500" },
  in_review: { bg: "bg-purple-500/20", text: "text-purple-400" },
  in_repair: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  charged_customer: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  no_issues: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  estimate_requested: { bg: "bg-amber-500/20", text: "text-amber-500" },
  estimate_sent_to_turo: { bg: "bg-blue-500/20", text: "text-blue-400" },
  turo_managed: { bg: "bg-indigo-500/20", text: "text-indigo-400" },
  charged_guest: { bg: "bg-amber-500/20", text: "text-amber-500" },
  paid: { bg: "bg-green-500/20", text: "text-green-500" },
  disputed: { bg: "bg-red-500/20", text: "text-red-500" },
  resolved: { bg: "bg-green-500/20", text: "text-green-500" },
  not_resolved: { bg: "bg-red-500/20", text: "text-red-500" },
};

const statusLabels: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  completed: "Completed",
  delivered: "Delivered",
  booked: "Booked",
  ended: "Ended",
  returned: "Returned",
  cancelled: "Cancelled",
  active: "Active",
  damage_reported: "Maintenance Reported",
  in_review: "In Review",
  in_repair: "In Repair",
  charged_customer: "Charged Customer",
  no_issues: "No Car Issues",
  estimate_requested: "Estimate Requested",
  estimate_sent_to_turo: "Invoiced Guest",
  turo_managed: "Turo Managed",
  charged_guest: "Charged the Guest",
  paid: "Paid",
  disputed: "Disputed",
  resolved: "Resolved",
  not_resolved: "Not Resolved",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  const colors = statusColors[normalized] || statusColors.new;
  const label = statusLabels[normalized] || status;

  return (
    <Badge className={`${colors.bg} ${colors.text} border-0 text-xs font-medium ${className || ""}`}>
      {label}
    </Badge>
  );
}
