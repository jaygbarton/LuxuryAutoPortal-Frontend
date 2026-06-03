/**
 * My Tasks — tasks assigned to the current employee.
 * Pulls from /api/staff/task-management. Employees can edit the status
 * inline via PATCH /api/staff/task-management/:id/status.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { Link } from "wouter";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface TaskItem {
  task_timer_aid?: string | number;
  task_timer_created?: string;
  task_timer_date_start?: string;
  task_timer_date_end?: string;
  task_timer_emp_list?: string;
  task_timer_name?: string;
  task_timer_car_name?: string;
  task_timer_status?: number;
  task_timer_description?: string;
  task_timer_goal?: string; // "Assigned By" on the admin page
  task_timer_photos?: string; // JSON array of photo URLs
}

// Status codes match the admin Task Management page:
//   0 = New, 1 = In Progress, 2 = On Hold, 3 = Completed.
// The old mapping in this file (1→Completed, 2→In Progress) was wrong and made
// the dashboard show "Completed" for tasks that were actually just in progress.
const STATUS_OPTIONS: { value: string; label: string; className: string }[] = [
  { value: "0", label: "New", className: "bg-gray-100 text-gray-700" },
  { value: "1", label: "In Progress", className: "bg-blue-100 text-blue-700" },
  { value: "2", label: "On Hold", className: "bg-yellow-100 text-yellow-800" },
  { value: "3", label: "Completed", className: "bg-green-100 text-green-700" },
];

function statusLabel(v: number | undefined): string {
  return (
    STATUS_OPTIONS.find((s) => s.value === String(Number(v ?? 0)))?.label ??
    "New"
  );
}

function fmtDate(s: string | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

// task_timer_created is a UTC DATETIME ("YYYY-MM-DD HH:mm:ss"); show it in
// Mountain Time, matching the admin Task Management "Task Created" column.
function fmtCreatedAt(s: string | undefined): string {
  if (!s) return "—";
  const raw = String(s).trim();
  const iso = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)
    ? raw.replace(" ", "T") + "Z"
    : raw;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

// task_timer_photos is a JSON array of URLs. Return the parsed list.
function parsePhotos(s: string | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * task_timer_emp_list is stored as a JSON string. Historically it was a
 * mixed bag: a CSV of IDs, a JSON array of IDs/names, OR — and this is what
 * caused the "[object Object]" rendering bug — a JSON array of {id,name}
 * objects. We pull a display name out of each entry.
 */
function parseAssignees(empList: string | undefined): string {
  if (!empList) return "—";
  let parsed: unknown = empList;
  try {
    parsed = JSON.parse(empList);
  } catch {
    // Not JSON — treat as CSV string.
    return empList.trim() || "—";
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return "—";
  const names = (parsed as unknown[])
    .map((x) => {
      if (x == null) return "";
      if (typeof x === "string" || typeof x === "number") return String(x);
      if (typeof x === "object") {
        const obj = x as Record<string, unknown>;
        return String(
          obj.name ?? obj.fullname ?? obj.label ?? obj.email ?? obj.id ?? "",
        );
      }
      return "";
    })
    .map((s) => s.trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "—";
}

export default function MyTasksSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success?: boolean; data?: TaskItem[] }>({
    queryKey: ["staff-task-management", "/api/staff/task-management"],
    queryFn: async () => {
      const r = await fetch(buildApiUrl("/api/staff/task-management"), { credentials: "include" });
      if (r.status === 404 || r.status === 501) return { success: true, data: [] };
      if (!r.ok) throw new Error("Failed to load tasks");
      return r.json();
    },
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: async (vars: { id: number; status: number }) => {
      const r = await fetch(
        buildApiUrl(`/api/staff/task-management/${vars.id}/status`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_timer_status: vars.status }),
        },
      );
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) {
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["staff-task-management", "/api/staff/task-management"],
      });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => {
      toast({
        title: "Could not update status",
        description: e?.message ?? "",
        variant: "destructive",
      });
    },
  });

  const allTasks = data?.data ?? [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const tasks = useMemo(() => {
    let filtered = allTasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((t) =>
        [t.task_timer_name, t.task_timer_description, t.task_timer_goal, t.task_timer_car_name]
          .some((v) => v && v.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => String(Number(t.task_timer_status ?? 0)) === statusFilter);
    }
    return filtered;
  }, [allTasks, search, statusFilter]);

  return (
    <div className="mb-8">
      <SectionHeader title="TASK MANAGEMENT" subtitle="Tasks assigned to you." />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 mt-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task name, description..."
            className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#D3BC8D]"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {(search || statusFilter !== "all") && (
          <span className="text-xs text-gray-500">{tasks.length} result{tasks.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          {search || statusFilter !== "all" ? "No matching results." : "No tasks assigned."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-y border-[#D3BC8D] border-collapse text-sm">
            <thead>
              <tr className="bg-black border-y border-[#D3BC8D]">
                <th className="px-3 py-2 text-center font-bold uppercase text-white whitespace-nowrap">Task Created</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Task Name</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Assigned By</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Assigned To</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Due Date</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Status</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Description</th>
                <th className="px-3 py-2 text-center font-bold uppercase text-white">Photos</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => (
                <tr key={String(t.task_timer_aid ?? i)} className="bg-white border-y border-[#D3BC8D]">
                  <td className="px-3 py-2 text-center text-black whitespace-nowrap">{fmtCreatedAt(t.task_timer_created)}</td>
                  <td className="px-3 py-2 text-center text-black font-medium">{t.task_timer_name ?? "—"}</td>
                  <td className="px-3 py-2 text-center text-black">{t.task_timer_goal?.trim() || "—"}</td>
                  <td className="px-3 py-2 text-center text-black">{parseAssignees(t.task_timer_emp_list)}</td>
                  <td className="px-3 py-2 text-center text-black">{fmtDate(t.task_timer_date_end)}</td>
                  <td className="px-3 py-2 text-center text-black">
                    {t.task_timer_aid != null ? (
                      <Select
                        value={String(Number(t.task_timer_status ?? 0))}
                        onValueChange={(v) =>
                          updateStatus.mutate({
                            id: Number(t.task_timer_aid),
                            status: Number(v),
                          })
                        }
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger
                          className={`h-8 w-[140px] mx-auto text-xs ${
                            STATUS_OPTIONS.find(
                              (s) =>
                                s.value === String(Number(t.task_timer_status ?? 0)),
                            )?.className ?? ""
                          }`}
                        >
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      statusLabel(t.task_timer_status)
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-black max-w-[220px] truncate">
                    {t.task_timer_description?.trim() || "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-black">
                    {(() => {
                      const photos = parsePhotos(t.task_timer_photos);
                      if (photos.length === 0) return "—";
                      return (
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {photos.slice(0, 3).map((src, idx) => (
                            <img
                              key={idx}
                              src={getProxiedImageUrl(src)}
                              alt={`Photo ${idx + 1}`}
                              className="w-9 h-9 object-cover rounded border border-[#D3BC8D]"
                            />
                          ))}
                          {photos.length > 3 && (
                            <span className="text-xs text-gray-500">+{photos.length - 3}</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-center">
            <Link
              href="/staff/task-management"
              className="text-sm font-medium text-[#B8860B] hover:underline"
            >
              Go to Task Management →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
