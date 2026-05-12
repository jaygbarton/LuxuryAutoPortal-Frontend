import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, PlayCircle, Video as VideoIcon } from "lucide-react";

type VideoKind = "youtube" | "vimeo" | "drive" | "file" | "image" | "other";

interface ParsedVideo {
  kind: VideoKind;
  embedUrl?: string;
  thumbnailUrl?: string;
}

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i;

export function parseVideoUrl(raw: string): ParsedVideo {
  if (!raw) return { kind: "other" };
  const url = raw.trim();
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "other" };
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    let id: string | null = null;
    if (host === "youtu.be") {
      id = parsed.pathname.replace(/^\//, "").split("/")[0] || null;
    } else if (parsed.pathname.startsWith("/watch")) {
      id = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/embed/")) {
      id = parsed.pathname.split("/")[2] || null;
    } else if (parsed.pathname.startsWith("/shorts/")) {
      id = parsed.pathname.split("/")[2] || null;
    }
    if (id) {
      return {
        kind: "youtube",
        embedUrl: `https://www.youtube.com/embed/${id}`,
        thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }

  // Vimeo
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const id = parts.find((p) => /^\d+$/.test(p));
    if (id) {
      return {
        kind: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${id}`,
      };
    }
  }

  // Google Drive
  if (host === "drive.google.com") {
    let id: string | null = null;
    const m = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (m) id = m[1];
    if (!id) id = parsed.searchParams.get("id");
    if (id) {
      return {
        kind: "drive",
        embedUrl: `https://drive.google.com/file/d/${id}/preview`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w320`,
      };
    }
  }

  if (IMAGE_EXT.test(parsed.pathname)) {
    return { kind: "image", embedUrl: url, thumbnailUrl: url };
  }

  if (VIDEO_EXT.test(parsed.pathname)) {
    return { kind: "file", embedUrl: url };
  }

  return { kind: "other", embedUrl: url };
}

interface VideoPreviewProps {
  url: string;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Compact thumbnail for a video URL. Clicking opens a dialog with an embedded player.
 * Falls back to "Open" link for unknown URL types.
 */
export function VideoPreview({ url, title, description, className }: VideoPreviewProps) {
  const [open, setOpen] = useState(false);
  if (!url) return <span className="text-muted-foreground text-xs">—</span>;

  const info = parseVideoUrl(url);

  if (info.kind === "other") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
        title={url}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        <span className="text-xs">Open</span>
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "group relative h-12 w-20 overflow-hidden rounded border border-border bg-muted hover:border-primary"
        }
        title={title || url}
      >
        {info.thumbnailUrl ? (
          <img
            src={info.thumbnailUrl}
            alt={title || "Video thumbnail"}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : info.kind === "file" ? (
          <video
            src={url}
            preload="metadata"
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <VideoIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <PlayCircle className="h-6 w-6 text-white" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span className="truncate">{title || "Video preview"}</span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-normal text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open original
              </a>
            </DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
            {info.kind === "file" ? (
              <video src={url} controls autoPlay className="h-full w-full">
                Your browser does not support video playback.
              </video>
            ) : info.kind === "image" ? (
              <img src={url} alt={title || "Preview"} className="h-full w-full object-contain" />
            ) : info.embedUrl ? (
              <iframe
                src={info.embedUrl}
                title={title || "Video"}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : null}
          </div>
          {description && description.trim() && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-3">
              {description}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
