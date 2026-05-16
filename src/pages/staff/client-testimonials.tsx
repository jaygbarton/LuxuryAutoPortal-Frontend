import { AdminLayout } from "@/components/admin/admin-layout";
import { buildApiUrl } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Loader2, Star } from "lucide-react";
import { VideoPreview } from "@/components/admin/video-preview";

interface ClientTestimonialItem {
  client_testimonial_aid: number;
  client_testimonial_is_active: number;
  client_testimonial_file: string;
  client_testimonial_title: string;
  client_testimonial_description: string;
  client_testimonial_created: string;
  client_testimonial_datetime: string;
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

export default function StaffClientTestimonials() {
  const { data, isLoading } = useQuery<{
    success?: boolean;
    list?: ClientTestimonialItem[];
  }>({
    queryKey: ["client-testimonials-active"],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl("/api/client-testimonials/active?limit=100"),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load testimonials");
      return res.json();
    },
  });

  // Filter out [NEWS] items — those are News & Media, not testimonials
  const rows: ClientTestimonialItem[] = (data?.list ?? []).filter(
    (r) => !r.client_testimonial_title.startsWith("[NEWS]"),
  );

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
            <Star className="w-6 h-6" />
            Client Testimonials
          </h1>
          <p className="text-muted-foreground">
            Videos and testimonials from our clients.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <MessageCircle className="w-12 h-12 opacity-20" />
            <p className="text-sm">No testimonials available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((item) => (
              <div
                key={item.client_testimonial_aid}
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Video / Media preview */}
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {item.client_testimonial_file ? (
                    <VideoPreview url={item.client_testimonial_file} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MessageCircle className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Text content */}
                <div className="flex flex-col gap-1.5 p-3 flex-1">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                    {item.client_testimonial_title}
                  </h3>
                  {item.client_testimonial_description && (
                    <p className="text-xs text-muted-foreground line-clamp-3 flex-1">
                      {item.client_testimonial_description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-auto pt-1 border-t border-border">
                    {formatDate(item.client_testimonial_datetime)}
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
