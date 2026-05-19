import React from "react";
import { ReportLinkCard } from "./ReportLinkCard";

interface LinkItem {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
  placeholder?: boolean;
}

interface QuickLinksSectionProps {
  title: string;
  links: LinkItem[];
  accentClass?: string;
  /**
   * Number of columns in the link grid. Defaults to 4 (matches ReportCenter).
   * Pass a smaller number for narrow sections like Accounting (1/3 width).
   */
  cols?: 2 | 3 | 4;
}

const colClass: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

/**
 * Generic quick-links section box. Matches the visual style of ReportCenter /
 * SupportCenter but accepts any title, link list and column count.
 */
export function QuickLinksSection({
  title,
  links,
  accentClass = "border-[#d3bc8d]",
  cols = 4,
}: QuickLinksSectionProps) {
  return (
    <div className={`h-full rounded-xl border-2 ${accentClass} bg-card px-6 py-5`}>
      <h2 className="text-base font-bold text-foreground mb-3">{title}</h2>
      <div className={`grid ${colClass[cols]} gap-x-6 gap-y-1 pl-2`}>
        {links.map((link, idx) =>
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
