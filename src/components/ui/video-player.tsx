import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, PlayCircle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseVideoSource } from "@/lib/video-utils";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  url?: string | null;
  placeholder?: string;
  className?: string;
  iframeClassName?: string;
  videoClassName?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  onStatusChange?: (status: { loading: boolean; error: boolean }) => void;
}

// Reusable video player that transparently handles YouTube, Vimeo and
// direct-file URLs. Falls back to an accessible "open in new tab" error
// state when the URL cannot be embedded.
export function VideoPlayer({
  url,
  placeholder,
  className,
  iframeClassName,
  videoClassName,
  autoPlay = false,
  loop = false,
  muted = true,
  controls = true,
  onStatusChange,
}: VideoPlayerProps) {
  const source = useMemo(() => (url ? parseVideoSource(url) : null), [url]);
  const [loading, setLoading] = useState<boolean>(source?.type === "direct");
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setError(false);
    setLoading(source?.type === "direct");
  }, [url, source?.type]);

  // Detect deleted / private / embedding-disabled YouTube & Vimeo videos.
  // The iframe's onLoad fires successfully even when YouTube serves its own
  // "Video unavailable" page inside the frame (the embed loaded; the content
  // didn't), so onError never trips and the user sees YouTube's raw error
  // screen instead of our placeholder. The oEmbed endpoint returns 401/404 for
  // unavailable videos, so we probe it and flip to the error state on failure.
  useEffect(() => {
    if (!source || (source.type !== "youtube" && source.type !== "vimeo")) return;
    let cancelled = false;
    const oembed =
      source.type === "youtube"
        ? `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${source.videoId}`)}&format=json`
        : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${source.videoId}`)}`;
    setLoading(true);
    fetch(oembed)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          // 401/403/404 → video removed, private, or embedding disabled.
          setError(true);
        }
        setLoading(false);
      })
      .catch(() => {
        // Network/CORS failure probing availability — don't block playback,
        // let the iframe try to render so a transient probe failure never
        // hides a working video.
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  });
  useEffect(() => {
    onStatusChangeRef.current?.({ loading, error });
  }, [loading, error]);

  if (!url || !source || source.type === "unknown") {
    return (
      <div
        className={cn(
          "w-full aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center p-6",
          className
        )}
      >
        <div className="text-center space-y-2">
          <Video className="w-10 h-10 text-gray-600 mx-auto" />
          <p className="text-muted-foreground text-sm">
            {placeholder || (url ? "Unsupported video URL" : "No video")}
          </p>
          {url && (
            <p className="text-xs text-gray-600 break-all mt-1">{url}</p>
          )}
          {url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.open(url, "_blank")}
              className="text-primary hover:text-primary hover:bg-primary/10 mt-1"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Open in new tab
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-800",
        className
      )}
    >
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
          <div className="text-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading video...</p>
          </div>
        </div>
      )}

      {error ? (
        <div className="w-full h-full flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
            <div className="text-muted-foreground text-sm">
              {placeholder || "Video failed to load"}
            </div>
            <div className="text-xs text-gray-600 break-all mt-1">{url}</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.open(url, "_blank")}
              className="text-primary hover:text-primary hover:bg-primary/10 mt-2"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Open in new tab
            </Button>
          </div>
        </div>
      ) : source.type === "youtube" || source.type === "vimeo" ? (
        <iframe
          key={source.embedUrl}
          src={
            source.type === "youtube"
              ? `${source.embedUrl}${autoPlay ? "&autoplay=1" : ""}${muted ? "&mute=1" : ""}`
              : `${source.embedUrl}${autoPlay ? "?autoplay=1" : ""}${muted ? `${autoPlay ? "&" : "?"}muted=1` : ""}`
          }
          title="Tutorial video"
          className={cn("w-full h-full", iframeClassName)}
          frameBorder={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      ) : (
        <video
          key={source.url}
          src={source.url}
          className={cn("w-full h-full object-contain", videoClassName)}
          controls={controls}
          loop={loop}
          muted={muted}
          playsInline
          autoPlay={autoPlay}
          onLoadStart={() => {
            setLoading(true);
            setError(false);
          }}
          onLoadedData={() => {
            setLoading(false);
            setError(false);
          }}
          onCanPlay={() => {
            setLoading(false);
            setError(false);
          }}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
}
