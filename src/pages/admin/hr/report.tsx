/**
 * Admin HR – Report (time records with form details, v1 StatsReport parity).
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildApiUrl } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

function formatDate(d: string | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "—";
  }
}

export default function AdminHrReport() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  if (search.trim()) params.set("search", search.trim());
  const { data, isLoading } = useQuery<{ success: boolean; data: any[]; total: number }>({
    queryKey: ["/api/admin/hr/report", fromDate, toDate, search],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/report?${params}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const rows = data?.data ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Report</h1>
          <p className="text-muted-foreground text-sm">Time sheet records with form details (end-of-day reports).</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee" className="w-48" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No report records found.</p>
            ) : (
              <div className="overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time in</TableHead>
                      <TableHead>Time out</TableHead>
                      <TableHead>Total hrs</TableHead>
                      <TableHead>Form details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r: any) => (
                      <TableRow key={r.time_aid}>
                        <TableCell className="font-medium">{r.fullname ?? "—"}</TableCell>
                        <TableCell>{formatDate(r.time_date)}</TableCell>
                        <TableCell>{r.time_in ? new Date(r.time_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                        <TableCell>{r.time_out ? new Date(r.time_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                        <TableCell>{r.time_total_hours ?? "—"}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-muted-foreground text-sm">
                          {r.time_form_details ? (typeof r.time_form_details === "string" && r.time_form_details.length > 80 ? r.time_form_details.slice(0, 80) + "…" : r.time_form_details) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {data?.total != null && data.total > rows.length && (
              <p className="text-muted-foreground text-sm mt-2">Showing {rows.length} of {data.total} records.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
