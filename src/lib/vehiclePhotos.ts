import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";

/** car_photo is usually JSON, but older rows may contain one plain URL. */
export function vehiclePhotoSources(raw: string | null | undefined, size = 360): string[] {
  if (!raw?.trim()) return [];
  let value: unknown = raw;
  try { value = JSON.parse(raw); } catch {
    // Broken JSON is not a relative image path.
    if (/^[\[{]/.test(raw.trim())) return [];
  }
  const photos = Array.isArray(value) ? value : [value];
  const urls = photos.flatMap(photo => {
    if (typeof photo === "string") return [photo.trim()];
    if (!photo || typeof photo !== "object") return [];
    const entry = photo as Record<string, unknown>;
    for (const field of [entry.url, entry.path]) {
      if (typeof field === "string" && field.trim()) return [field.trim()];
    }
    return typeof entry.id === "string" && entry.id.trim()
      ? [buildApiUrl(`/api/employees/drive-file?fileId=${encodeURIComponent(entry.id.trim())}`)] : [];
  }).filter(Boolean);
  return [...new Set(urls.map(url => {
    if (url.includes("/api/employees/drive-file")) return url;
    const proxied = getProxiedImageUrl(url);
    return proxied.includes("/api/gcs-image-proxy")
      ? `${proxied}${proxied.includes("?") ? "&" : "?"}size=${size}` : proxied;
  }))];
}
