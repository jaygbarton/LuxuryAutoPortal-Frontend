import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { SectionHeader } from "@/components/admin/dashboard";
import { DayScheduleTab } from "@/pages/admin/operations/DayScheduleTab";

/**
 * Dashboard → Operations: the same Day Schedule as Operations → Day Schedule.
 * It replaced the "Pick Up and Drop Off" list, which mirrored the Trips
 * Overview tab after that tab was removed. Outside the Operations page there
 * is no Location / Vehicles filter, so every location and vehicle is shown,
 * like the other Dashboard sections.
 */
export default function DayScheduleSection() {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionHeader title="OPERATIONS" subtitle="DAY SCHEDULE" />
        <Link
          href="/admin/operations?tab=day-schedule"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#B8860B] hover:underline"
        >
          Open in Operations <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="mt-2">
        <DayScheduleTab />
      </div>
    </div>
  );
}
