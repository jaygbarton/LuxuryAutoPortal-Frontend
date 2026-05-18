import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VideoPreview } from "@/components/admin/video-preview";
import { buildApiUrl } from "@/lib/queryClient";

interface NewsItem {
  client_testimonial_aid: number;
  client_testimonial_title: string;
  client_testimonial_description: string;
  client_testimonial_file: string;
  news_media_type: string;
}

interface NewsMediaSlotProps {
  items: NewsItem[];
  slot: 1 | 2;
}

export function NewsMediaSlot({ items, slot }: NewsMediaSlotProps) {
  const [index, setIndex] = useState(0);

  if (!items || items.length === 0) return null;

  const item = items[index];
  const total = items.length;

  const NEWS_PREFIX = "[NEWS] ";
  const title = item.client_testimonial_title.startsWith(NEWS_PREFIX)
    ? item.client_testimonial_title.slice(NEWS_PREFIX.length)
    : item.client_testimonial_title;

  const fileUrl = item.client_testimonial_file?.startsWith("/uploads/")
    ? buildApiUrl(item.client_testimonial_file)
    : item.client_testimonial_file;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-sm font-semibold text-foreground">
          News & Media {slot}
        </span>
        {total > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + total) % total)}
              className="rounded p-0.5 hover:bg-muted transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground w-10 text-center">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % total)}
              className="rounded p-0.5 hover:bg-muted transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Media */}
      <div className="aspect-video w-full overflow-hidden bg-black">
        {fileUrl ? (
          <VideoPreview
            url={fileUrl}
            title={title}
            description={item.client_testimonial_description}
            className="group/preview relative block h-full w-full"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
            No media
          </div>
        )}
      </div>

      {/* Caption */}
      {(title || item.client_testimonial_description) && (
        <div className="px-4 py-3 space-y-0.5">
          {title && <p className="text-sm font-medium leading-snug">{title}</p>}
          {item.client_testimonial_description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {item.client_testimonial_description}
            </p>
          )}
        </div>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="flex justify-center gap-1.5 pb-3">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
              aria-label={`Go to item ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
