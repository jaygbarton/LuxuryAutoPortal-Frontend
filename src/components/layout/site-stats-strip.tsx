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
      className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] lg:grid-cols-4"
      style={{
        background: isDark ? "linear-gradient(135deg, rgba(212,160,23,0.55), rgba(255,255,255,0.16), rgba(212,160,23,0.26))" : "#D7D2C7",
        boxShadow: isDark ? "0 18px 60px rgba(0, 0, 0, 0.28)" : "0 14px 45px rgba(28, 28, 28, 0.08)",
      }}
    >
      {SITE_STATS.map((stat, index) => {
        const Icon = STAT_ICONS[index] ?? BadgeCheck;
        return (
          <div
            key={stat.label}
            className="relative flex min-h-[92px] items-center gap-3 overflow-hidden px-4 py-4"
            style={{
              background: isDark ? "linear-gradient(135deg, #171717, #101010)" : "linear-gradient(135deg, #FBFAF7, #F0ECE4)",
            }}
          >
            <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#D4A017]/10" />
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D4A017]/12">
              <Icon className="h-5 w-5" style={{ color: "#C49000" }} />
            </div>
            <div className="relative">
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
