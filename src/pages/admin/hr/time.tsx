/**
 * Admin HR – Time (list all employee time sheet records).
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
function formatTime(d: string | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function AdminHrTime() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  const { data, isLoading } = useQuery<{ success: boolean; data: any[]; total: number }>({
    queryKey: ["/api/admin/hr/time", fromDate, toDate],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/time?${params}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const rows = data?.data ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Time</h1>
          <p className="text-muted-foreground text-sm">View all employee time sheet (clock in/out) records.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" placeholder="From" />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" placeholder="To" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No time records found.</p>
            ) : (
              <div className="overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Time in</TableHead>
                      <TableHead>Lunch out</TableHead>
                      <TableHead>Lunch in</TableHead>
                      <TableHead>Time out</TableHead>
                      <TableHead>Total hrs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r: any) => (
                      <TableRow key={r.time_aid}>
                        <TableCell className="font-medium">{r.fullname ?? "—"}</TableCell>
                        <TableCell>{formatDate(r.time_date)}</TableCell>
                        <TableCell>{r.time_working_hours ?? "—"}</TableCell>
                        <TableCell>{formatDate(r.time_date)} {formatTime(r.time_in)}</TableCell>
                        <TableCell>{r.time_lunch_out ? formatTime(r.time_lunch_out) : "—"}</TableCell>
                        <TableCell>{r.time_lunch_in ? formatTime(r.time_lunch_in) : "—"}</TableCell>
                        <TableCell>{r.time_out ? formatTime(r.time_out) : "—"}</TableCell>
                        <TableCell>{r.time_total_hours ?? "—"}</TableCell>
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
