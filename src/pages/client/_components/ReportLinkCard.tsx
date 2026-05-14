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
    <div className="flex items-center gap-3 py-1.5 px-1 rounded-md hover:bg-muted/40 transition-colors cursor-pointer">
      <Icon className="w-5 h-5 shrink-0 text-foreground/80" strokeWidth={1.5} />
      <span className="text-sm text-foreground leading-tight">{label}</span>
    </div>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  }
  return <Link href={href}>{inner}</Link>;
}
