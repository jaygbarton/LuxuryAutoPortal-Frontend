import { Award, BadgeCheck, Route, Star } from "lucide-react";
import { SITE_STATS } from "@/lib/site-config";

const STAT_ICONS = [Route, Star, Star, Award];

export function SiteStatsStrip() {
  return (
    <div
      className="grid grid-cols-2 gap-3 rounded-sm p-3 lg:grid-cols-4"
      style={{ background: "#E5E5E5" }}
    >
      {SITE_STATS.map((stat, index) => {
        const Icon = STAT_ICONS[index] ?? BadgeCheck;
        return (
          <div
            key={stat.label}
            className="flex min-h-[86px] items-center gap-3 px-3 py-4"
            style={{ border: "1px solid rgba(28, 28, 28, 0.16)", background: "#F7F7F7" }}
          >
            <Icon className="h-5 w-5 shrink-0" style={{ color: "#C49000" }} />
            <div>
              <div className="text-xl font-bold leading-none" style={{ color: "#1C1C1C" }}>
                {stat.value}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider" style={{ color: "#4A4A4A" }}>
                {stat.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
