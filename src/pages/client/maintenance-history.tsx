import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench, ExternalLink } from "lucide-react";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";

interface ClientMaintenance {
  id: number;
  car_name: string | null;
  car_make: string | null;
  car_model: string | null;
  car_year: number | null;
  car_plate_number: string | null;
  task_description: string | null;
  status: string;
  scheduled_date: string | null;
  due_date: string | null;
  repair_shop: string | null;
  notes: string | null;
  photos: string[];
  reservation_id: string | null;
  owner_approval_status: "not_sent" | "email_sent" | "approved" | "declined" | "auto_approved" | null;
  owner_decline_reason: string | null;
  owner_wants_pickup: 0 | 1 | null;
  owner_responded_at: string | null;
  approval_token: string | null;
  created_at: string;
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  damage_reported: "Maintenance Reported",
  in_review: "In Review",
  in_progress: "In Progress",
  in_repair: "In Repair",
  completed: "Completed",
  charged_customer: "Charged Customer",
};

function approvalBadge(rec: ClientMaintenance) {
  const s = rec.owner_approval_status || "not_sent";
  if (s === "not_sent")
    return <span className="text-xs text-muted-foreground">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    email_sent: {
      label: "Awaiting your response",
      cls: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    },
    approved: {
      label: "Approved",
      cls: "bg-green-500/10 text-green-700 border-green-500/30",
    },
    declined: {
      label: "Declined",
      cls: "bg-red-500/10 text-red-700 border-red-500/30",
    },
    auto_approved: {
      label: "Auto-Approved (no response in 5 days)",
      cls: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    },
  };
  const m = map[s] || map.email_sent;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

export default function ClientMaintenanceHistory() {
  const { data, isLoading } = useQuery<{
    success: boolean;
    data: ClientMaintenance[];
  }>({
    queryKey: ["/api/client/maintenance-history"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/client/maintenance-history"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch maintenance history");
      return res.json();
    },
  });

  const records = data?.data ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-primary leading-tight">
              Maintenance History
            </h1>
            <p className="text-sm text-muted-foreground">
              Maintenance reported and performed on your vehicles.
            </p>
          </div>
        </div>

        <ClientPageLinks />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No maintenance records for your vehicles yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Vehicle</TableHead>
                  <TableHead className="whitespace-nowrap">Reservation #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Your Approval</TableHead>
                  <TableHead className="whitespace-nowrap">Scheduled</TableHead>
                  <TableHead className="whitespace-nowrap">Repair Shop</TableHead>
                  <TableHead className="whitespace-nowrap">Photos</TableHead>
                  <TableHead className="whitespace-nowrap">Reported</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((rec) => {
                  const carLabel =
                    rec.car_make && rec.car_model
                      ? `${rec.car_make} ${rec.car_model} ${rec.car_year ?? ""}`.trim()
                      : rec.car_name || "—";
                  return (
                    <TableRow key={rec.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {carLabel}
                        {rec.car_plate_number && (
                          <span className="block text-xs text-muted-foreground">
                            {rec.car_plate_number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {rec.reservation_id || "—"}
                      </TableCell>
                      <TableCell className="max-w-[280px] text-sm">
                        {rec.task_description || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {STATUS_LABELS[rec.status] || rec.status}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {approvalBadge(rec)}
                          {rec.owner_approval_status === "declined" &&
                            rec.owner_decline_reason && (
                              <span
                                className="text-xs text-muted-foreground max-w-[180px] truncate"
                                title={rec.owner_decline_reason}
                              >
                                {rec.owner_decline_reason}
                              </span>
                            )}
                          {rec.owner_approval_status === "declined" &&
                            (rec.owner_wants_pickup === 1) && (
                              <span className="text-xs text-amber-600">
                                Self-pickup requested
                              </span>
                            )}
                          {rec.owner_approval_status === "email_sent" &&
                            rec.approval_token && (
                              <a
                                href={`/maintenance-approval/${rec.approval_token}`}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                Respond now
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {fmt(rec.scheduled_date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {rec.repair_shop || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {rec.photos && rec.photos.length > 0 ? (
                          <div className="flex gap-1">
                            {rec.photos.slice(0, 3).map((p, i) => (
                              <a
                                key={i}
                                href={getProxiedImageUrl(p)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={getProxiedImageUrl(p)}
                                  alt={`Photo ${i + 1}`}
                                  className="h-10 w-10 object-cover rounded border border-border"
                                />
                              </a>
                            ))}
                            {rec.photos.length > 3 && (
                              <span className="text-xs text-muted-foreground self-center">
                                +{rec.photos.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {fmt(rec.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
