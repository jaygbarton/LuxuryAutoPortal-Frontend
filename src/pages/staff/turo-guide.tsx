import { AdminLayout } from "@/components/admin/admin-layout";
import { buildApiUrl } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Loader2, Map } from "lucide-react";
import { VideoPreview } from "@/components/admin/video-preview";

interface TuroGuideRow {
  turo_guide_aid: number;
  turo_guide_is_active: number;
  turo_guide_file: string;
  turo_guide_title: string;
  turo_guide_description: string;
  turo_guide_created: string;
  turo_guide_datetime: string;
}

function formatDate(d: string | undefined, fallback = "--") {
  if (!d) return fallback;
  try {
    const x = new Date(d);
    return isNaN(x.getTime())
      ? fallback
      : x.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
  } catch {
    return fallback;
  }
}

export default function StaffTuroGuide() {
  const { data, isLoading } = useQuery<{
    success?: boolean;
    list?: TuroGuideRow[];
  }>({
    queryKey: ["turo-guides-active"],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl("/api/turo-guides/active?limit=100"),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load Turo guides");
      return res.json();
    },
  });

  const rows: TuroGuideRow[] = data?.list ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
            <Map className="w-6 h-6" />
            Turo Guide
          </h1>
          <p className="text-muted-foreground">
            Turo hosting and operations guide videos and resources.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <BookOpen className="w-12 h-12 opacity-20" />
            <p className="text-sm">No guide entries available yet.</p>
            <p className="text-xs">
              Check back soon — management adds new guides regularly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((item) => (
              <div
                key={item.turo_guide_aid}
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Video / Media preview */}
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {item.turo_guide_file ? (
                    <VideoPreview url={item.turo_guide_file} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Text content */}
                <div className="flex flex-col gap-1.5 p-3 flex-1">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                    {item.turo_guide_title}
                  </h3>
                  {item.turo_guide_description && (
                    <p className="text-xs text-muted-foreground line-clamp-3 flex-1">
                      {item.turo_guide_description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-auto pt-1 border-t border-border">
                    {formatDate(item.turo_guide_datetime)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
