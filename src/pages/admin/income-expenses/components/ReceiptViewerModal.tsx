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
  /** Car this cell belongs to. Required to show the Service Date editor —
   *  omit it (e.g. on the aggregated All Cars view) and the editor is hidden. */
  carId?: number;
  /** Let the admin record the real service date printed on the receipt.
   *  Off by default so read-only surfaces (Earnings) stay read-only. */
  canEditServiceDate?: boolean;
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
  carId,
  canEditServiceDate = false,
}: ReceiptViewerModalProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const showServiceDate = canEditServiceDate && carId != null && viewer != null;

  return (
    <>
      {viewer && (
        <ReceiptViewerBody
          viewer={viewer}
          onClose={onClose}
          images={images}
          isLoading={isLoading}
          monthLabel={monthLabel}
          year={year}
          canDelete={canDelete}
          onDeleted={onDeleted}
          deletingId={deletingId}
          setDeletingId={setDeletingId}
          error={error}
          setError={setError}
          serviceDateEditor={
            showServiceDate ? (
              <ServiceDateEditor
                carId={carId!}
                year={Number(year)}
                month={viewer.month}
                category={viewer.category}
                field={viewer.field}
              />
            ) : null
          }
        />
      )}
    </>
  );
}

/**
 * Records the real day the expense was incurred, read off the receipt shown
 * alongside it.
 *
 * Why this exists: car_cogs_expenses is keyed by (car, year, month) with no
 * day, so Operations > Service Due could only ever date a service to the 1st
 * of its month — a mechanic visit whose receipt reads 04/08/2026 showed as
 * 04/01/2026. Saving the date here makes that report exact. Clearing it falls
 * back to the month.
 */
function ServiceDateEditor({
  carId,
  year,
  month,
  category,
  field,
}: {
  carId: number;
  year: number;
  month: number;
  category: string;
  field: string;
}) {
  const [value, setValue] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  // The <input type="date"> must be constrained to this cell's month — the
  // backend rejects anything outside it, so don't let the user pick it at all.
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  React.useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setMsg(null);
    (async () => {
      try {
        const res = await fetch(
          buildApiUrl(`/api/income-expense/service-dates/${carId}/${year}`),
          { credentials: "include" },
        );
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        const hit = (body?.data ?? []).find(
          (r: any) =>
            Number(r.month) === month && r.category === category && r.field === field,
        );
        setValue(hit?.service_date ?? "");
      } catch {
        // Non-fatal: leave the field blank so it can still be set.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [carId, year, month, category, field]);

  const save = async (next: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(buildApiUrl("/api/income-expense/service-date"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ carId, year, month, category, field, serviceDate: next || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to save service date");
      setValue(next);
      setMsg({ ok: true, text: next ? "Service date saved." : "Service date cleared." });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Failed to save service date" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-3 rounded border border-border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-foreground" htmlFor="ie-service-date">
          Service date
        </label>
        <input
          id="ie-service-date"
          type="date"
          className="h-8 rounded-md border border-input bg-card px-2 text-sm"
          value={value}
          min={monthStart}
          max={monthEnd}
          disabled={!loaded || saving}
          onChange={(e) => save(e.target.value)}
        />
        {value && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline hover:text-primary"
            disabled={saving}
            onClick={() => save("")}
          >
            Clear
          </button>
        )}
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        The date printed on the receipt. Used by Operations &gt; Service Due —
        without it that report can only date this expense to the 1st of the month.
      </p>
      {msg && (
        <p className={`mt-1 text-[11px] ${msg.ok ? "text-green-600" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function ReceiptViewerBody({
  viewer,
  onClose,
  images,
  isLoading,
  monthLabel,
  year,
  canDelete,
  onDeleted,
  deletingId,
  setDeletingId,
  error,
  setError,
  serviceDateEditor,
}: Required<Pick<ReceiptViewerModalProps, "onClose" | "images" | "isLoading" | "monthLabel" | "year">> & {
  viewer: NonNullable<ReceiptViewerModalProps["viewer"]>;
  canDelete: boolean;
  onDeleted?: () => void;
  deletingId: string | null;
  setDeletingId: (v: string | null) => void;
  error: string | null;
  setError: (v: string | null) => void;
  serviceDateEditor: React.ReactNode;
}) {

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
        {serviceDateEditor}
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
