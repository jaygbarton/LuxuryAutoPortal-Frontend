import React from "react";
import { X, Loader2, Image as ImageIcon, ExternalLink } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";

/**
 * Receipt thumbnail. The receipt-image endpoint is auth-protected (session
 * cookie), so a plain <img src> fails with 401 when the API is a different
 * origin than the app (preview/staging builds where VITE_API_URL points at the
 * backend) — a cross-origin <img> doesn't send cookies, so the receipt comes up
 * blank. We instead fetch the bytes with credentials and render an object URL,
 * which works same- or cross-origin, and show an explicit fallback on error.
 */
function ReceiptThumb({ url, filename }: { url: string; filename: string }) {
  const fullUrl = url.startsWith("/") ? buildApiUrl(url) : url;
  // Form-submission receipts carry no real filename ("Form receipt #123"), so
  // we can't rely on a ".pdf" suffix to know it's a PDF. We fetch the bytes and
  // detect PDF vs image from the response's content-type instead. Start by
  // treating only an explicit .pdf name as a known PDF.
  const nameIsPdf = (filename || "").toLowerCase().endsWith(".pdf");
  const [isPdf, setIsPdf] = React.useState(nameIsPdf);
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let revoked = false;
    let created: string | null = null;
    setFailed(false);
    setObjectUrl(null);
    setIsPdf(nameIsPdf);
    (async () => {
      try {
        const res = await fetch(fullUrl, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (revoked) return;
        // Trust the served content-type: a PDF gets the open-in-tab tile, an
        // image gets an inline preview. This fixes extension-less receipts.
        if ((blob.type || "").toLowerCase().includes("pdf")) {
          setIsPdf(true);
          return;
        }
        setIsPdf(false);
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      } catch {
        if (!revoked) setFailed(true);
      }
    })();
    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [fullUrl, nameIsPdf]);

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-border rounded-lg overflow-hidden hover:border-primary transition-colors"
      title={`Open ${filename}`}
    >
      {isPdf ? (
        <div className="flex items-center justify-center h-40 bg-background text-sm text-muted-foreground">
          <ImageIcon className="w-5 h-5 mr-2" /> {filename || "PDF receipt"}
        </div>
      ) : failed ? (
        <div className="flex flex-col items-center justify-center h-40 bg-background text-xs text-muted-foreground gap-1 px-2 text-center">
          <ExternalLink className="w-5 h-5" />
          <span>Couldn't load preview.</span>
          <span className="text-primary underline">Open in new tab</span>
        </div>
      ) : objectUrl ? (
        <img
          src={objectUrl}
          alt={filename || "Receipt"}
          className="w-full h-40 object-cover bg-background"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex items-center justify-center h-40 bg-background text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}
      <div className="px-2 py-1 text-xs text-muted-foreground truncate">
        {filename || "Receipt"}
      </div>
    </a>
  );
}

interface ReceiptViewerModalProps {
  viewer: { month: number; category: string; field: string; label: string } | null;
  onClose: () => void;
  images: { id: string; url: string; filename: string }[];
  isLoading: boolean;
  monthLabel: string;
  year: string | number;
}

/**
 * View-only receipt viewer, opened by clicking a value cell that has
 * receipts. Shared between Earnings and Income & Expenses so both surfaces
 * offer the same "click the amount to see the receipt" affordance for
 * clients (who never get the full edit modal — upload/delete stays admin/
 * co-host-only, in the I&E editor).
 */
export default function ReceiptViewerModal({
  viewer,
  onClose,
  images,
  isLoading,
  monthLabel,
  year,
}: ReceiptViewerModalProps) {
  if (!viewer) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Receipts — {viewer.label} · {monthLabel} {year}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading receipts…
          </div>
        ) : images.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No receipts found for this cell.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {images.map((img) => (
              <ReceiptThumb key={img.id} url={img.url} filename={img.filename} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
