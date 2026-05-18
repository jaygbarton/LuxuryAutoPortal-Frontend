import React from "react";
import { ReportLinkCard } from "./ReportLinkCard";

interface LinkItem {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
  /**
   * When true, renders an invisible cell that holds a slot in the grid.
   * Use this to force the next link onto a fresh row instead of letting
   * CSS Grid auto-flow tuck it into the leftover column.
   */
  placeholder?: boolean;
}

interface ReportCenterProps {
  reportLinks: LinkItem[];
}

export function ReportCenter({ reportLinks }: ReportCenterProps) {
  return (
    <div className="rounded-xl border-2 border-[#d3bc8d] bg-card px-6 py-5">
      <h2 className="text-base font-bold text-foreground mb-3">Report Center</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1 pl-2">
        {reportLinks.map((link, idx) =>
          link.placeholder ? (
            <div key={`placeholder-${idx}`} aria-hidden className="invisible" />
          ) : (
            <ReportLinkCard
              key={link.label}
              href={link.href}
              icon={link.icon}
              label={link.label}
              external={link.external}
            />
          ),
        )}
      </div>
    </div>
  );
}
