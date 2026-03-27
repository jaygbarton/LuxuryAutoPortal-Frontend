import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard";

interface NoticeBoardRow {
  notice_board_aid: number;
  notice_board_title: string;
  notice_board_body: string;
  notice_board_category: string;
  notice_board_priority: string;
  notice_board_date: string;
  notice_board_is_active: number;
  notice_board_created: string;
  notice_board_updated: string;
}

interface NoticeBoardResponse {
  success: boolean;
  data: NoticeBoardRow[];
  total: number;
}

interface Notice {
  title: string;
  category: string;
  categoryColor: string;
  priority: string;
  priorityColor: string;
  date: string;
  body: string;
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
  Important: "bg-[#FFD700]/20 text-[#B8860B]",
  Info: "bg-gray-100 text-gray-600",
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function mapRowToNotice(row: NoticeBoardRow): Notice {
  return {
    title: row.notice_board_title,
    category: row.notice_board_category,
    categoryColor:
      categoryColors[row.notice_board_category] || "bg-gray-100 text-gray-600",
    priority: row.notice_board_priority,
    priorityColor:
      priorityColors[row.notice_board_priority] || "bg-gray-100 text-gray-600",
    date: formatDate(row.notice_board_date),
    body: row.notice_board_body,
  };
}

// Fallback hardcoded notices when no data exists yet
function getCurrentMonthDate(day: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" },
  );
}

const fallbackNotices: Notice[] = [
  {
    title: "Fleet Inspection Schedule",
    category: "Operations",
    categoryColor: categoryColors.Operations,
    priority: "Important",
    priorityColor: priorityColors.Important,
    date: getCurrentMonthDate(1),
    body: "All vehicles must complete monthly inspections by the 15th. Please ensure pre-trip and post-trip photos are uploaded to the system.",
  },
  {
    title: "New Cleaning Protocol",
    category: "Policy",
    categoryColor: categoryColors.Policy,
    priority: "Required",
    priorityColor: priorityColors.Required,
    date: getCurrentMonthDate(3),
    body: "Updated vehicle cleaning checklist is now mandatory before every guest pickup. See the training manual for details.",
  },
  {
    title: "Insurance Renewal Reminder",
    category: "Compliance",
    categoryColor: categoryColors.Compliance,
    priority: "Urgent",
    priorityColor: priorityColors.Urgent,
    date: getCurrentMonthDate(10),
    body: "Vehicle insurance policies are up for renewal. All paperwork must be submitted to the office by end of month.",
  },
];

function NoticeItem({ notice }: { notice: Notice }) {
  return (
    <div className="border-b border-gray-200 px-6 py-4 last:border-b-0">
      <h3 className="text-base font-bold text-gray-900">{notice.title}</h3>
      <p className="mt-0.5 text-xs text-gray-400">{notice.date}</p>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{notice.body}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-2 space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200" />
      ))}
    </div>
  );
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

  const apiNotices = data?.data ?? [];
  const notices =
    apiNotices.length > 0
      ? apiNotices.map(mapRowToNotice)
      : fallbackNotices;
  const isUsingFallback = apiNotices.length === 0;

  return (
    <div className="mb-8">
      <SectionHeader title="NOTICE BOARD" />

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {notices.map((notice) => (
              <NoticeCard key={notice.title} notice={notice} />
            ))}
          </div>
          {isUsingFallback && (
            <p className="mt-3 text-center text-xs italic text-gray-400">
              Showing sample notices. Add notices via the admin panel to replace these.
            </p>
          )}
        </>
      )}
    </div>
  );
}
