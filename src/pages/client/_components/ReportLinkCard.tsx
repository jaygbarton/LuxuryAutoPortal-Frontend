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
    <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card hover:border-[#d3bc8d]/50 hover:bg-muted/30 transition-colors text-center cursor-pointer">
      <Icon className="w-6 h-6 text-[#d3bc8d]" />
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
    </div>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  }
  return <Link href={href}>{inner}</Link>;
}
