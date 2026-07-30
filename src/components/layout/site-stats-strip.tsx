import { Award, BadgeCheck, Route, Star } from "lucide-react";
import { SITE_STATS } from "@/lib/site-config";

const STAT_ICONS = [Route, Star, Star, Award];

type SiteStatsStripProps = {
  variant?: "light" | "dark";
};

export function SiteStatsStrip({ variant = "light" }: SiteStatsStripProps) {
  const isDark = variant === "dark";

  return (
    <div
      className="grid grid-cols-2 gap-3 rounded-sm p-3 lg:grid-cols-4"
      style={{
        background: isDark ? "#111111" : "#E5E5E5",
        border: isDark ? "1px solid rgba(255, 215, 0, 0.22)" : undefined,
      }}
    >
      {SITE_STATS.map((stat, index) => {
        const Icon = STAT_ICONS[index] ?? BadgeCheck;
        return (
          <div
            key={stat.label}
            className="flex min-h-[86px] items-center gap-3 px-3 py-4"
            style={{
              border: isDark ? "1px solid rgba(255, 215, 0, 0.18)" : "1px solid rgba(28, 28, 28, 0.16)",
              background: isDark ? "#181818" : "#F7F7F7",
            }}
          >
            <Icon className="h-5 w-5 shrink-0" style={{ color: "#C49000" }} />
            <div>
              <div className="text-xl font-bold leading-none" style={{ color: isDark ? "#FFFFFF" : "#1C1C1C" }}>
                {stat.value}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider" style={{ color: isDark ? "rgba(255, 255, 255, 0.62)" : "#4A4A4A" }}>
                {stat.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
