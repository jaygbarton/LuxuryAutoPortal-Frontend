/**
 * Admin HR – Time Off (Leave). List, add, approve/deny leave requests.
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

interface LeaveRow {
  leave_aid: number;
  leave_employee_id: number;
  leave_is_status: number;
  leave_date: string;
  leave_type: string;
  leave_amount: string;
  leave_hour: string;
  leave_minute: string;
  leave_remarks: string;
  fullname: string;
}

export default function AdminHrTimeOff() {
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  if (statusFilter !== "") params.set("status", statusFilter);
  const { data, isLoading } = useQuery<{ success: boolean; data: LeaveRow[]; total: number }>({
    queryKey: ["/api/admin/hr/leave", fromDate, toDate, statusFilter],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/leave?${params}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: number }) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/leave/${id}/status`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leave_is_status: status }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/leave"] }),
  });

  const rows = data?.data ?? [];
  const statusLabel = (s: number) => (s === 0 ? "Pending" : s === 1 ? "Approved" : "Declined");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Time Off</h1>
          <p className="text-muted-foreground text-sm">Manage employee leave requests.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm w-32">
                <option value="">All</option>
                <option value="0">Pending</option>
                <option value="1">Approved</option>
                <option value="2">Declined</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No leave records found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount / Hrs</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.leave_aid}>
                      <TableCell className="font-medium">{r.fullname ?? "—"}</TableCell>
                      <TableCell>{r.leave_date}</TableCell>
                      <TableCell>{r.leave_type || "—"}</TableCell>
                      <TableCell>{r.leave_amount || (r.leave_hour || r.leave_minute ? `${r.leave_hour}h ${r.leave_minute}m` : "—")}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.leave_remarks || "—"}</TableCell>
                      <TableCell>{statusLabel(r.leave_is_status)}</TableCell>
                      <TableCell>
                        {r.leave_is_status === 0 && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: r.leave_aid, status: 1 })} disabled={updateStatusMutation.isPending}>
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: r.leave_aid, status: 2 })} disabled={updateStatusMutation.isPending}>
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
