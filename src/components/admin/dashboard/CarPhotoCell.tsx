import { useState } from "react";
import { createPortal } from "react-dom";
import { getProxiedImageUrl } from "@/lib/queryClient";

function parseCarPhotoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      const url = typeof first === "object" ? (first.url ?? first.path ?? null) : String(first);
      if (url && typeof url === "string" && url.trim()) return url.trim();
    }
  } catch {
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

function CarPhotoLightbox({ url, carName, onClose }: { url: string; carName: string; onClose: () => void }) {
  const proxied = getProxiedImageUrl(url);
  const src = proxied.includes("/api/gcs-image-proxy")
    ? proxied + (proxied.includes("?") ? "&" : "?") + "size=1200"
    : proxied;
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

/** Clickable car photo thumbnail — opens a lightbox on click. */
export function CarPhotoCell({ carPhoto, carName }: { carPhoto: string | null | undefined; carName?: string | null }) {
  const [open, setOpen] = useState(false);
  const url = parseCarPhotoUrl(carPhoto);
  if (!url) return null;

  const proxied = getProxiedImageUrl(url);
  const src = proxied.includes("/api/gcs-image-proxy")
    ? proxied + (proxied.includes("?") ? "&" : "?") + "size=128"
    : proxied;

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
