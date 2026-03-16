/**
 * Admin Payroll – Report index (v1 ReportList parity).
 * Lists report types: Logged Hours (time records for payroll context).
 */

import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

const reportLinks = [
  {
    href: "/admin/payroll/report/logged-hours",
    label: "Logged Hours",
    description: "View employee time sheet records (clock in/out) for payroll.",
    icon: Clock,
  },
];

export default function PayrollReportIndexPage() {
  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Payroll Reports</h1>
          <p className="text-muted-foreground text-sm">Select a report to view.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {reportLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
