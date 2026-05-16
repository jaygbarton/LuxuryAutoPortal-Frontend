import { Fragment, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MaintenanceModal } from "@/pages/admin/operations/MaintenanceModal";

type Severity = "low" | "normal" | "urgent";

interface PendingContribution {
  id: number;
  user_id: number;
  user_name?: string;
  note: string | null;
  created_at: string;
  photos?: { id: number; url: string }[];
}

interface PendingCarIssue {
  id: number;
  car_id: number;
  car_label: string;
  plate?: string | null;
  severity: Severity;
  title: string;
  status: "pending" | "approved" | "dismissed";
  opened_by_name: string;
  opened_at: string;
  last_update_at: string;
  contribution_count: number;
  contributions?: PendingContribution[];
}

interface PendingResponse {
  success: boolean;
  data: PendingCarIssue[];
}

const SEVERITY_ORDER: Record<Severity, number> = { urgent: 0, normal: 1, low: 2 };

function severityBadge(severity: Severity) {
  const map: Record<Severity, string> = {
    urgent: "bg-red-100 text-red-700",
    normal: "bg-yellow-100 text-yellow-700",
    low: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${map[severity]}`}>
      {severity}
    </span>
  );
}

function ageInDays(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

interface SchedulePrefill {
  pending_issue_id: number;
  car_name: string;
  task_description: string;
  notes: string;
  photos: string[];
}

export default function PendingCarIssuesSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePrefill, setSchedulePrefill] = useState<SchedulePrefill | null>(null);

  const { data, isLoading, isError } = useQuery<PendingResponse>({
    queryKey: ["/api/car-issues/pending"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/car-issues/pending"), {
        credentials: "include",
      });
      if (!res.ok) {
        // Graceful fallback while backend is being built
        return { success: true, data: [] };
      }
      return res.json();
    },
  });

  // Fetch full detail (including all contributions + photos) so we can
  // pre-fill the Maintenance modal when "Approve & Schedule" is clicked.
  const openScheduleMutation = useMutation({
    mutationFn: async (row: PendingCarIssue) => {
      const res = await fetch(buildApiUrl(`/api/car-issues/${row.id}`), {
        credentials: "include",
      });
      // Even if detail fetch fails, fall back to the row we already have.
      const detail: PendingCarIssue = res.ok ? (await res.json()).data ?? row : row;
      return detail;
    },
    onSuccess: (detail) => {
      const noteParts: string[] = [];
      const photoUrls: string[] = [];
      for (const c of detail.contributions ?? []) {
        if (c.note && c.note.trim()) {
          const who = c.user_name ?? `User ${c.user_id}`;
          noteParts.push(`[${who}] ${c.note.trim()}`);
        }
        for (const p of c.photos ?? []) {
          if (p.url) photoUrls.push(p.url);
        }
      }

      setSchedulePrefill({
        pending_issue_id: detail.id,
        car_name: detail.car_label,
        task_description: detail.title,
        notes: noteParts.join("\n\n"),
        photos: photoUrls,
      });
      setScheduleOpen(true);
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/car-issues/${id}/dismiss`), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/car-issues/pending"] });
      toast({ title: "Issue dismissed" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const severityMutation = useMutation({
    mutationFn: async ({ id, severity }: { id: number; severity: Severity }) => {
      const res = await fetch(buildApiUrl(`/api/car-issues/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ severity }),
      });
      if (!res.ok) throw new Error("Failed to update severity");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/car-issues/pending"] });
    },
  });

  const rows = (data?.data ?? [])
    .slice()
    .sort((a, b) => {
      const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sev !== 0) return sev;
      return new Date(b.last_update_at).getTime() - new Date(a.last_update_at).getTime();
    });

  return (
    <div className="mt-6">
      <div className="rounded-t-lg bg-black px-4 py-2">
        <p className="text-sm font-bold uppercase text-[#FFCC00]">
          Pending Car Issues
          {!isLoading && rows.length > 0 && (
            <span className="ml-2 rounded-full bg-[#FFCC00] px-2 py-0.5 text-xs text-black">
              {rows.length}
            </span>
          )}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border border-gray-200 bg-white">
          <thead>
            <tr className="bg-black">
              {[
                "Car",
                "Issue",
                "Severity",
                "Reported By",
                "Age",
                "Contributors",
                "Last Update",
                "Actions",
              ].map((label) => (
                <th
                  key={label}
                  className="px-3 py-2 text-left text-xs font-bold uppercase text-white"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-red-500">
                  Failed to load pending issues.
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-400">
                  No pending car issues. New reports from staff will appear here for review.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const age = ageInDays(row.opened_at);
                const isStale = age > 60;
                const isOpen = expanded === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} cursor-pointer hover:bg-gray-100`}
                      onClick={() => setExpanded(isOpen ? null : row.id)}
                    >
                      <td className="px-3 py-2 text-sm">
                        <div className="font-medium">{row.car_label}</div>
                        {row.plate && <div className="text-xs text-gray-500">{row.plate}</div>}
                      </td>
                      <td className="px-3 py-2 text-sm">{row.title}</td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs"
                          value={row.severity}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            severityMutation.mutate({
                              id: row.id,
                              severity: e.target.value as Severity,
                            })
                          }
                        >
                          <option value="urgent">Urgent</option>
                          <option value="normal">Normal</option>
                          <option value="low">Low</option>
                        </select>
                        <div className="mt-1">{severityBadge(row.severity)}</div>
                      </td>
                      <td className="px-3 py-2 text-sm">{row.opened_by_name}</td>
                      <td className="px-3 py-2 text-sm">
                        {age}d
                        {isStale && (
                          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                            Stale
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm">{row.contribution_count}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {new Date(row.last_update_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="rounded bg-[#FFCC00] px-2 py-1 text-xs font-semibold text-black hover:bg-[#c4a974] disabled:opacity-50"
                            disabled={openScheduleMutation.isPending}
                            onClick={() => openScheduleMutation.mutate(row)}
                          >
                            Approve & Schedule
                          </button>
                          <button
                            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
                            disabled={dismissMutation.isPending}
                            onClick={() => dismissMutation.mutate(row.id)}
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && row.contributions && row.contributions.length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-6 py-3">
                          <div className="space-y-3">
                            {row.contributions.map((c) => (
                              <div key={c.id} className="rounded border border-gray-200 bg-white p-3">
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span className="font-semibold text-gray-700">
                                    {c.user_name ?? `User ${c.user_id}`}
                                  </span>
                                  <span>{new Date(c.created_at).toLocaleString()}</span>
                                </div>
                                {c.note && (
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{c.note}</p>
                                )}
                                {c.photos && c.photos.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {c.photos.map((p) => (
                                      <a
                                        key={p.id}
                                        href={p.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block"
                                      >
                                        <img
                                          src={p.url}
                                          alt=""
                                          className="h-16 w-16 rounded border border-gray-200 object-cover"
                                        />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <MaintenanceModal
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setSchedulePrefill(null);
        }}
        prefill={schedulePrefill ?? undefined}
      />
    </div>
  );
}
