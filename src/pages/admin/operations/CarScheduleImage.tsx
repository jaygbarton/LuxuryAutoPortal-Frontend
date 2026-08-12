import { useState } from "react";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";

function parseCarPhotoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!first) return null;
    if (typeof first === "string") return first.trim() || null;
    if (typeof first === "object") {
      const url = first.url ?? first.path ?? null;
      if (typeof url === "string" && url.trim()) return url.trim();
      if (typeof first.id === "string" && first.id.trim()) {
        return buildApiUrl(`/api/employees/drive-file?fileId=${encodeURIComponent(first.id.trim())}`);
      }
    }
  } catch {
    return raw.trim() || null;
  }
  return null;
}

function toDisplaySrc(url: string, size: number): string {
  if (url.includes("/api/employees/drive-file")) return url;
  const proxied = getProxiedImageUrl(url);
  return proxied.includes("/api/gcs-image-proxy")
    ? proxied + (proxied.includes("?") ? "&" : "?") + `size=${size}`
    : proxied;
}

export function CarScheduleImage({
  carPhoto,
  carName,
  className = "",
  size = 360,
  hideBelowMd = true,
  fit = "cover",
}: {
  carPhoto: string | null | undefined;
  carName?: string | null;
  className?: string;
  size?: number;
  hideBelowMd?: boolean;
  fit?: "cover" | "contain";
}) {
  const [failed, setFailed] = useState(false);
  const url = parseCarPhotoUrl(carPhoto);
  if (!url || failed) return null;

  return (
    <div className={`${hideBelowMd ? "hidden md:block" : ""} shrink-0 overflow-hidden rounded-md border border-border bg-muted ${className}`}>
      <img
        src={toDisplaySrc(url, size)}
        alt={carName ? `${carName} photo` : "Vehicle photo"}
        className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
