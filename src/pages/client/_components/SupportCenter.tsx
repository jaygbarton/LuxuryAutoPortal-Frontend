import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ReportLinkCard } from "./ReportLinkCard";

interface LinkItem {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
}

interface SupportCenterProps {
  supportLinks: LinkItem[];
}

export function SupportCenter({ supportLinks }: SupportCenterProps) {
  return (
    <Card className="border-border bg-card overflow-hidden">
      <div className="px-6 py-3" style={{ backgroundColor: "#d3bc8d" }}>
        <h2 className="text-base font-bold text-[#1a1a1a]">Support Center</h2>
      </div>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {supportLinks.map((link) => (
            <ReportLinkCard key={link.label} href={link.href} icon={link.icon} label={link.label} external={link.external} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
