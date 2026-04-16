import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, { bg: string; text: string }> = {
  new: { bg: "bg-gray-500/20", text: "text-gray-400" },
  in_progress: { bg: "bg-yellow-500/20", text: "text-yellow-500" },
  completed: { bg: "bg-green-500/20", text: "text-green-500" },
  delivered: { bg: "bg-blue-500/20", text: "text-blue-400" },
  booked: { bg: "bg-blue-500/20", text: "text-blue-400" },
  cancelled: { bg: "bg-red-500/20", text: "text-red-500" },
  active: { bg: "bg-green-500/20", text: "text-green-500" },
  damage_reported: { bg: "bg-orange-500/20", text: "text-orange-500" },
  in_review: { bg: "bg-purple-500/20", text: "text-purple-400" },
  in_repair: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  charged_customer: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
};

const statusLabels: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  completed: "Completed",
  delivered: "Delivered",
  booked: "Booked",
  cancelled: "Cancelled",
  active: "Active",
  damage_reported: "Damage Reported",
  in_review: "In Review",
  in_repair: "In Repair",
  charged_customer: "Charged Customer",
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
