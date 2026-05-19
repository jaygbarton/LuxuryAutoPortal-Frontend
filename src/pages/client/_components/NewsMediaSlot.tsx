import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { parseVideoUrl } from "@/components/admin/video-preview";
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

const NEWS_PREFIX = "[NEWS] ";

function resolveUrl(file: string): string {
  if (!file) return "";
  if (file.startsWith("/uploads/")) return buildApiUrl(file);
  return file;
}

/**
 * Render the media inline based on URL kind, falling back to news_media_type
 * only when the URL itself is ambiguous (kind === "other").
 */
function MediaInline({
  url,
  title,
  mediaTypeHint,
}: {
  url: string;
  title: string;
  mediaTypeHint: string;
}) {
  if (!url) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
        No media
      </div>
    );
  }

  const info = parseVideoUrl(url);

  if (info.kind === "image") {
    return (
      <img
        src={url}
        alt={title || "News media"}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  if (info.kind === "file") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
      >
        Your browser does not support video playback.
      </video>
    );
  }

  if (info.kind === "youtube" || info.kind === "vimeo" || info.kind === "drive") {
    return (
      <iframe
        src={info.embedUrl}
        title={title || "Media"}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  // Ambiguous URL — fall back to the admin-selected media type.
  if (mediaTypeHint === "photo") {
    return (
      <img
        src={url}
        alt={title || "News media"}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }
  if (mediaTypeHint === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
      >
        Your browser does not support video playback.
      </video>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full w-full items-center justify-center gap-1 bg-muted text-primary hover:underline"
    >
      <ExternalLink className="h-4 w-4" />
      <span className="text-sm">Open media</span>
    </a>
  );
}

export function NewsMediaSlot({ items, slot }: NewsMediaSlotProps) {
  const [index, setIndex] = useState(0);

  if (!items || items.length === 0) return null;

  const safeIndex = Math.min(index, items.length - 1);
  const item = items[safeIndex];
  const total = items.length;

  const title = item.client_testimonial_title.startsWith(NEWS_PREFIX)
    ? item.client_testimonial_title.slice(NEWS_PREFIX.length)
    : item.client_testimonial_title;

  const fileUrl = resolveUrl(item.client_testimonial_file);

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
              {safeIndex + 1} / {total}
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
        <MediaInline
          url={fileUrl}
          title={title}
          mediaTypeHint={item.news_media_type}
        />
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
                i === safeIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
              aria-label={`Go to item ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
