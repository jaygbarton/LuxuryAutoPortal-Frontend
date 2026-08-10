import React from "react";
import { X, Loader2, Image as ImageIcon, ExternalLink, Trash2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";

/**
 * Receipt thumbnail. The receipt-image endpoint is auth-protected (session
 * cookie), so a plain <img src> fails with 401 when the API is a different
 * origin than the app (preview/staging builds where VITE_API_URL points at the
 * backend) — a cross-origin <img> doesn't send cookies, so the receipt comes up
 * blank. We instead fetch the bytes with credentials and render an object URL,
 * which works same- or cross-origin, and show an explicit fallback on error.
 */
function ReceiptThumb({
  url,
  filename,
  onDelete,
  deleting,
}: {
  url: string;
  filename: string;
  onDelete?: () => void;
  deleting?: boolean;
}) {
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
    <div className="relative block border border-border rounded-lg overflow-hidden hover:border-primary transition-colors">
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
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
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          title="Remove this receipt"
          className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

interface ReceiptViewerModalProps {
  viewer: { month: number; category: string; field: string; label: string } | null;
  onClose: () => void;
  images: { id: string; url: string; filename: string }[];
  isLoading: boolean;
  monthLabel: string;
  year: string | number;
  /** Show a remove button on each receipt and let the admin/co-host delete
   *  it. Omit (default false) to keep the viewer read-only — e.g. on
   *  Earnings, where upload/delete deliberately stays in the I&E editor. */
  canDelete?: boolean;
  /** Called after a receipt is successfully deleted so the caller can
   *  refetch (e.g. invalidate the images query). */
  onDeleted?: () => void;
}

/**
 * Receipt viewer, opened by clicking a value cell that has receipts. Shared
 * between Earnings (read-only) and Income & Expenses (canDelete) so both
 * surfaces offer the same "click the amount to see the receipt" affordance.
 */
export default function ReceiptViewerModal({
  viewer,
  onClose,
  images,
  isLoading,
  monthLabel,
  year,
  canDelete = false,
  onDeleted,
}: ReceiptViewerModalProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!viewer) return null;

  const handleDelete = async (imageId: string) => {
    if (!window.confirm("Remove this receipt? This can't be undone.")) return;
    setError(null);
    setDeletingId(imageId);
    try {
      // Cell-upload receipts have a plain numeric id; form-submission
      // receipts carry "form-<submissionId>-<index>" and live in a
      // different table, so they go through a different delete route.
      const formMatch = imageId.match(/^form-(\d+)-(\d+)$/);
      const url = formMatch
        ? buildApiUrl(`/api/income-expense/form-receipts/${formMatch[1]}/${formMatch[2]}`)
        : buildApiUrl(`/api/income-expense/images/${imageId}`);
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to remove receipt");
      }
      onDeleted?.();
    } catch (e: any) {
      setError(e?.message || "Failed to remove receipt");
    } finally {
      setDeletingId(null);
    }
  };

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
        {error && (
          <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}
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
              <ReceiptThumb
                key={img.id}
                url={img.url}
                filename={img.filename}
                onDelete={canDelete ? () => handleDelete(img.id) : undefined}
                deleting={deletingId === img.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
