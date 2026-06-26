import { useState } from "react";
import { createPortal } from "react-dom";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";

function parseCarPhotoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      if (typeof first === "object") {
        // GCS or direct URL
        const url = first.url ?? first.path ?? null;
        if (url && typeof url === "string" && url.trim()) return url.trim();
        // Legacy Drive-only entry: has id but no url — proxy through backend
        if (first.id && typeof first.id === "string" && first.id.trim()) {
          return buildApiUrl(`/api/employees/drive-file?fileId=${encodeURIComponent(first.id.trim())}`);
        }
      } else {
        const s = String(first);
        if (s.trim()) return s.trim();
      }
    }
  } catch {
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

function CarPhotoLightbox({ url, carName, onClose }: { url: string; carName: string; onClose: () => void }) {
  const src = toDisplaySrc(url, 1200);
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <img src={src} alt={carName} className="max-h-[80vh] max-w-full object-contain rounded" />
        <button onClick={onClose} className="absolute -top-8 right-0 text-white/70 hover:text-white text-sm">✕ Close</button>
      </div>
    </div>,
    document.body
  );
}

function toDisplaySrc(url: string, size: number): string {
  // Drive proxy URLs are already fully resolved by parseCarPhotoUrl — pass through
  if (url.includes("/api/employees/drive-file")) return url;
  const proxied = getProxiedImageUrl(url);
  return proxied.includes("/api/gcs-image-proxy")
    ? proxied + (proxied.includes("?") ? "&" : "?") + `size=${size}`
    : proxied;
}

/** Clickable car photo thumbnail — opens a lightbox on click. */
export function CarPhotoCell({ carPhoto, carName }: { carPhoto: string | null | undefined; carName?: string | null }) {
  const [open, setOpen] = useState(false);
  const url = parseCarPhotoUrl(carPhoto);
  if (!url) return null;

  const src = toDisplaySrc(url, 128);

  return (
    <>
      <img
        src={src}
        alt={carName ?? "Car"}
        className="h-10 w-16 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        title="Click to view car photo"
      />
      {open && <CarPhotoLightbox url={url} carName={carName ?? "Car"} onClose={() => setOpen(false)} />}
    </>
  );
}
