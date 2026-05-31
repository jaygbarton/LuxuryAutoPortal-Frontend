import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { SectionHeader } from "@/components/admin/dashboard";

interface NoticeBoardRow {
  notice_board_aid: number;
  notice_board_title: string;
  notice_board_body: string;
  notice_board_is_active: number;
}

interface NoticeBoardResponse {
  success: boolean;
  data: NoticeBoardRow[];
  total: number;
}

export default function NoticeBoardSection() {
  const { data, isLoading } = useQuery<NoticeBoardResponse>({
    queryKey: ["/api/admin/notice-board"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/notice-board"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notices");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const notices = (data?.data ?? []).filter((n) => n.notice_board_is_active !== 0);

  return (
    <div className="mb-8">
      <SectionHeader title="NOTICE BOARD" />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#D3BC8D]" />
        </div>
      ) : notices.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">No active notices at the moment.</p>
      ) : (
        <div
          className={`bg-white py-4 px-2 ${
            notices.length >= 3
              ? "grid grid-cols-1 md:grid-cols-3 gap-x-6"
              : "flex flex-col gap-6"
          }`}
        >
          {notices.map((n) => (
            <div key={n.notice_board_aid} className="px-4 first:pl-0 last:pr-0 text-center">
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
