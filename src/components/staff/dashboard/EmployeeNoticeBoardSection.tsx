import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";

interface NoticeRow {
  notice_board_aid: number;
  notice_board_title: string;
  notice_board_body: string;
  notice_board_is_active?: number;
}

interface NoticeResponse {
  success: boolean;
  data?: NoticeRow[];
}

async function fetchNotices(): Promise<NoticeRow[]> {
  try {
    const r = await fetch(buildApiUrl("/api/me/notice-board"), { credentials: "include" });
    if (r.ok) {
      const json: NoticeResponse = await r.json();
      return json.data ?? [];
    }
  } catch {
    /* swallow */
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
      <SectionHeader title="NOTICE BOARD" />

      {isLoading ? (
        <div className="bg-white py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#d3bc8d]" />
        </div>
      ) : notices.length === 0 ? (
        <div className="bg-white px-6 py-4 text-center">
          <p className="text-xs text-gray-500">No active notices at the moment.</p>
        </div>
      ) : (
        <div
          className={`bg-white px-4 py-4 ${
            notices.length >= 3
              ? "grid grid-cols-1 md:grid-cols-3 gap-x-6"
              : "space-y-4"
          }`}
        >
          {notices.map((n) => (
            <div key={n.notice_board_aid}>
              <p className="whitespace-pre-wrap text-[11px] leading-snug text-black text-center">
                {n.notice_board_body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
