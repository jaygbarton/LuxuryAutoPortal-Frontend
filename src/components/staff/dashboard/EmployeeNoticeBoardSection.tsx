/**
 * Notice Board — visible to staff. Tries /api/me/notice-board (falls back
 * to /api/admin/notice-board if your account has admin/manager access).
 * Shows a friendly fallback when no notices are present.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";

interface NoticeRow {
  notice_board_aid: number;
  notice_board_title: string;
  notice_board_body: string;
  notice_board_category?: string;
  notice_board_priority?: string;
  notice_board_date?: string;
  notice_board_is_active?: number;
}

interface NoticeResponse {
  success: boolean;
  data?: NoticeRow[];
}

const categoryColors: Record<string, string> = {
  Operations: "bg-blue-100 text-blue-800",
  Policy: "bg-purple-100 text-purple-800",
  HR: "bg-green-100 text-green-800",
  Revenue: "bg-yellow-100 text-yellow-800",
  Compliance: "bg-orange-100 text-orange-800",
};

const priorityColors: Record<string, string> = {
  Urgent: "bg-red-100 text-red-800",
  Required: "bg-red-100 text-red-800",
  Important: "bg-[#d3bc8d]/20 text-[#B8860B]",
  Info: "bg-gray-100 text-gray-600",
};

function fmtDate(s: string | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

async function fetchNotices(): Promise<NoticeRow[]> {
  // Employee-scoped endpoint only — admin endpoint is gated and would 403 here.
  try {
    const r = await fetch(buildApiUrl("/api/me/notice-board"), { credentials: "include" });
    if (r.ok) {
      const json: NoticeResponse = await r.json();
      return json.data ?? [];
    }
  } catch {
    /* swallow — show empty state */
  }
  return [];
}

export default function EmployeeNoticeBoardSection() {
  const { data, isLoading } = useQuery<NoticeRow[]>({
    queryKey: ["staff-notice-board"],
    queryFn: fetchNotices,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const notices = (data ?? []).filter((n) => n.notice_board_is_active !== 0);

  return (
    <div className="mb-8">
      <SectionHeader title="NOTICE BOARD" subtitle="Important announcements from management." />

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : notices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className="text-sm text-gray-500">No active notices at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {notices.map((n) => {
            const catColor =
              categoryColors[n.notice_board_category ?? ""] ?? "bg-gray-100 text-gray-600";
            const priColor =
              priorityColors[n.notice_board_priority ?? ""] ?? "bg-gray-100 text-gray-600";
            return (
              <div
                key={n.notice_board_aid}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {n.notice_board_category && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catColor}`}>
                      {n.notice_board_category}
                    </span>
                  )}
                  {n.notice_board_priority && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priColor}`}>
                      {n.notice_board_priority}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-gray-900">{n.notice_board_title}</h3>
                {n.notice_board_date && (
                  <p className="mt-0.5 text-xs text-gray-400">{fmtDate(n.notice_board_date)}</p>
                )}
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                  {n.notice_board_body}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
