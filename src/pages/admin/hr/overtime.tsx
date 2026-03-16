/**
 * Admin HR – Overtime. List overtime requests, approve/decline.
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";

interface OvertimeRow {
  hris_overtime_aid: number;
  hris_overtime_employee_id: number;
  hris_overtime_date: string;
  hris_overtime_hour: string;
  hris_overtime_minute: string;
  hris_overtime_hour_decimal: string;
  hris_overtime_amount: string;
  hris_overtime_description: string;
  hris_overtime_is_pending: number;
  hris_overtime_is_approved: number;
  hris_overtime_is_declined: number;
  fullname: string;
}

export default function AdminHrOvertime() {
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  if (pendingOnly) params.set("pending", "1");
  const { data, isLoading } = useQuery<{ success: boolean; data: OvertimeRow[]; total: number }>({
    queryKey: ["/api/admin/hr/overtime", fromDate, toDate, pendingOnly],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/overtime?${params}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/overtime/${id}/approve`), { method: "PUT", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/overtime"] }),
  });
  const declineMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/overtime/${id}/decline`), { method: "PUT", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/overtime"] }),
  });

  const rows = data?.data ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Overtime</h1>
          <p className="text-muted-foreground text-sm">View and approve overtime requests.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
                Pending only
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No overtime records found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.hris_overtime_aid}>
                      <TableCell className="font-medium">{r.fullname ?? "—"}</TableCell>
                      <TableCell>{r.hris_overtime_date}</TableCell>
                      <TableCell>{r.hris_overtime_hour_decimal || `${r.hris_overtime_hour}h ${r.hris_overtime_minute}m`}</TableCell>
                      <TableCell>${r.hris_overtime_amount || "0"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.hris_overtime_description || "—"}</TableCell>
                      <TableCell>
                        {r.hris_overtime_is_pending ? "Pending" : r.hris_overtime_is_approved ? "Approved" : "Declined"}
                      </TableCell>
                      <TableCell>
                        {r.hris_overtime_is_pending === 1 && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => approveMutation.mutate(r.hris_overtime_aid)} disabled={approveMutation.isPending}>
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => declineMutation.mutate(r.hris_overtime_aid)} disabled={declineMutation.isPending}>
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
