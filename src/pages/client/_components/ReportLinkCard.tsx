import React from "react";
import { Link } from "wouter";

interface ReportLinkCardProps {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
}

export function ReportLinkCard({ href, icon: Icon, label, external = false }: ReportLinkCardProps) {
  const inner = (
    <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-md px-1 py-2 transition-colors hover:bg-muted/40 sm:min-h-8 sm:gap-3 sm:py-1.5">
      <Icon className="w-5 h-5 shrink-0 text-foreground/80" strokeWidth={1.5} />
      <span className="min-w-0 break-words text-sm text-foreground leading-snug">{label}</span>
    </div>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{inner}</a>;
  }
  return <Link href={href} className="block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{inner}</Link>;
}
