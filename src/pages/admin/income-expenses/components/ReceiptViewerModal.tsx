import React from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import InAppReceipt from "@/components/receipts/InAppReceipt";
import ServiceDateEditor from "./ServiceDateEditor";

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
  return (
    <div className="relative block border border-border rounded-lg overflow-hidden hover:border-primary transition-colors">
      <div className="h-40 bg-background">
        <InAppReceipt
          src={url}
          filename={filename}
          alt={filename || "Receipt"}
          className="w-full h-40 object-cover bg-background"
          compact
          expandable
        />
      </div>
      <div className="px-2 py-1 text-xs text-muted-foreground truncate">
        {filename || "Receipt"}
      </div>
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
  images: { id: string; url: string; filename: string; ocr?: ReceiptOcr | null }[];
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
  /** Show the per-receipt line-item split reviewer and allow confirming it.
   *  Off by default so read-only surfaces (Earnings, client views) only read. */
  canReviewSplit?: boolean;
  /** Amount currently entered in this cell, used only to flag a receipt whose
   *  own total doesn't reconcile. Never written to. */
  cellAmount?: number | null;
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
  canReviewSplit = false,
  cellAmount,
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
          canReviewSplit={canReviewSplit}
          cellAmount={cellAmount}
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
 * Vocabulary of I&E rows a receipt line item can be mapped into. Mirrors the
 * backend OCR_FIELD_VOCABULARY in services/receiptOcrService.ts — keep in sync;
 * the backend rejects a category/field pair it doesn't recognize.
 */
const OCR_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "cogs.autoBodyShopWreck", label: "COGS · Auto Body Shop / Wreck" },
  { value: "cogs.alignment", label: "COGS · Alignment" },
  { value: "cogs.battery", label: "COGS · Battery" },
  { value: "cogs.brakes", label: "COGS · Brakes" },
  { value: "cogs.carPayment", label: "COGS · Car Payment" },
  { value: "cogs.carInsurance", label: "COGS · Car Insurance" },
  { value: "cogs.carSeats", label: "COGS · Car Seats" },
  { value: "cogs.cleaningSuppliesTools", label: "COGS · Cleaning Supplies / Tools" },
  { value: "cogs.emissions", label: "COGS · Emissions" },
  { value: "cogs.gpsSystem", label: "COGS · GPS System" },
  { value: "cogs.keyFob", label: "COGS · Keys & Fob" },
  { value: "cogs.laborCleaning", label: "COGS · Labor - Detailing" },
  { value: "cogs.licenseRegistration", label: "COGS · License & Registration" },
  { value: "cogs.mechanic", label: "COGS · Mechanic" },
  { value: "cogs.oilLube", label: "COGS · Oil/Lube" },
  { value: "cogs.parts", label: "COGS · Parts" },
  { value: "cogs.skiRacks", label: "COGS · Ski Racks" },
  { value: "cogs.tickets", label: "COGS · Tickets & Tolls" },
  { value: "cogs.tiredAirStation", label: "COGS · Tired Air Station" },
  { value: "cogs.tires", label: "COGS · Tires" },
  { value: "cogs.towingImpoundFees", label: "COGS · Towing / Impound Fees" },
  { value: "cogs.uberLyftLime", label: "COGS · Uber/Lyft/Lime" },
  { value: "cogs.windshield", label: "COGS · Windshield" },
  { value: "cogs.wipers", label: "COGS · Wipers" },
  { value: "directDelivery.laborCleaning", label: "Direct Delivery · Labor - Cleaning" },
  { value: "directDelivery.laborDelivery", label: "Direct Delivery · Labor - Delivery" },
  { value: "directDelivery.parkingAirport", label: "Direct Delivery · Parking - Airport" },
  { value: "directDelivery.parkingLot", label: "Direct Delivery · Parking - Lot" },
  { value: "directDelivery.uberLyftLime", label: "Direct Delivery · Uber/Lyft/Lime" },
  { value: "reimbursedBills.gasReimbursed", label: "Reimbursed Bills · Gas - Reimbursed" },
  { value: "reimbursedBills.gasNotReimbursed", label: "Reimbursed Bills · Gas - Not Reimbursed" },
  { value: "reimbursedBills.gasServiceRun", label: "Reimbursed Bills · Gas - Service Run" },
  { value: "reimbursedBills.parkingAirport", label: "Reimbursed Bills · Parking Airport" },
  { value: "reimbursedBills.uberLyftLimeReimbursed", label: "Reimbursed Bills · Uber/Lyft/Lime - Reimbursed" },
  { value: "reimbursedBills.uberLyftLimeNotReimbursed", label: "Reimbursed Bills · Uber/Lyft/Lime - Not Reimbursed" },
];

export interface ReceiptOcrItem {
  id: number;
  description: string | null;
  amount: number | null;
  suggestedCategory: string | null;
  suggestedField: string | null;
  confirmedCategory: string | null;
  confirmedField: string | null;
  dismissed: boolean;
}

export interface ReceiptOcr {
  id: number;
  imageId: number;
  vendor: string | null;
  receiptDate: string | null;
  total: number | null;
  confidence: string | null;
  status: string;
  items: ReceiptOcrItem[];
}

const money = (n: number | null) =>
  n === null || n === undefined ? "--" : `$${n.toFixed(2)}`;

/**
 * Shows what a receipt SAYS, and lets an admin confirm which I&E row each billed
 * line belongs to.
 *
 * Why this exists: a receipt used to be an opaque attachment filed only by the
 * cell it was dropped on, so a combined invoice — tires AND an oil change — could
 * only be tracked as one of them. This surfaces the per-line split.
 *
 * Confirming a split never moves money. The amounts typed into the I&E cells stay
 * authoritative; this records what the receipt itself breaks down to, and flags a
 * receipt total that doesn't reconcile against the cell so someone can look.
 */
function ReceiptOcrPanel({
  imageId,
  ocr,
  canEdit,
  cellAmount,
  onChanged,
}: {
  imageId: string;
  ocr: ReceiptOcr | null | undefined;
  canEdit: boolean;
  cellAmount?: number | null;
  onChanged?: () => void;
}) {
  const [local, setLocal] = React.useState<ReceiptOcr | null>(ocr ?? null);
  const [reading, setReading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  // Draft mapping per item id: "category.field", "" = unmapped, "__skip" = dismissed.
  const [draft, setDraft] = React.useState<Record<number, string>>({});

  React.useEffect(() => {
    setLocal(ocr ?? null);
    setMsg(null);
    const next: Record<number, string> = {};
    for (const it of ocr?.items || []) {
      if (it.dismissed) next[it.id] = "__skip";
      else if (it.confirmedCategory && it.confirmedField)
        next[it.id] = `${it.confirmedCategory}.${it.confirmedField}`;
      else if (it.suggestedCategory && it.suggestedField)
        next[it.id] = `${it.suggestedCategory}.${it.suggestedField}`;
      else next[it.id] = "";
    }
    setDraft(next);
  }, [ocr]);

  const readReceipt = async () => {
    setReading(true);
    setMsg(null);
    try {
      const res = await fetch(
        buildApiUrl(`/api/income-expense/receipt-ocr/${imageId}/read`),
        { method: "POST", credentials: "include" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Could not read receipt");
      setLocal(body.ocr || null);
      if (!body.ocr?.items?.length) {
        setMsg({ ok: false, text: "No line items could be read from this receipt." });
      }
      onChanged?.();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Could not read receipt" });
    } finally {
      setReading(false);
    }
  };

  const confirmSplit = async () => {
    if (!local) return;
    setSaving(true);
    setMsg(null);
    try {
      const items = local.items.map((it) => {
        const v = draft[it.id] ?? "";
        if (v === "__skip") return { id: it.id, dismissed: true };
        const [category, field] = v ? v.split(".") : [null, null];
        return { id: it.id, category, field, dismissed: false };
      });
      const res = await fetch(
        buildApiUrl(`/api/income-expense/receipt-ocr/${imageId}/confirm`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Could not save split");
      setLocal(body.ocr || local);
      setMsg({ ok: true, text: "Split confirmed." });
      onChanged?.();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Could not save split" });
    } finally {
      setSaving(false);
    }
  };

  if (!local) {
    return (
      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <span className="text-[11px] text-muted-foreground">
          This receipt hasn't been read yet.
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={readReceipt}
            disabled={reading}
            className="inline-flex items-center gap-1 text-[11px] text-primary underline hover:opacity-80 disabled:opacity-50"
          >
            {reading && <Loader2 className="h-3 w-3 animate-spin" />}
            {reading ? "Reading…" : "Read receipt"}
          </button>
        )}
        {msg && (
          <span className={`text-[11px] ${msg.ok ? "text-green-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
    );
  }

  const lineSum = local.items
    .filter((it) => (draft[it.id] ?? "") !== "__skip")
    .reduce((s, it) => s + (it.amount || 0), 0);
  // Reconciliation flag: the receipt's own total vs what's typed in this cell.
  // Advisory only — we never correct the cell from here.
  const mismatch =
    typeof cellAmount === "number" &&
    local.total !== null &&
    Math.abs(local.total - cellAmount) > 0.01;
  // A receipt whose lines map to more than one row is the combined-receipt case.
  const mappedTargets = new Set(
    local.items
      .map((it) => draft[it.id] ?? "")
      .filter((v) => v && v !== "__skip"),
  );

  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">
          {local.vendor || "Unknown vendor"}
        </span>
        {local.receiptDate && <span>{local.receiptDate}</span>}
        <span>Receipt total {money(local.total)}</span>
        {local.confidence === "low" && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
            Low confidence — check the lines
          </span>
        )}
        {local.status === "reviewed" && (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">Confirmed</span>
        )}
        {mappedTargets.size > 1 && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">
            Combined receipt · {mappedTargets.size} categories
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={readReceipt}
            disabled={reading}
            className="inline-flex items-center gap-1 underline hover:text-primary disabled:opacity-50"
          >
            {reading && <Loader2 className="h-3 w-3 animate-spin" />}
            {reading ? "Re-reading…" : "Re-read"}
          </button>
        )}
      </div>

      {mismatch && (
        <p className="mt-1 text-[11px] text-amber-700">
          Receipt total {money(local.total)} doesn't match the {money(cellAmount ?? null)} entered
          in this cell — the cell amount is unchanged; review whether part of this receipt belongs
          to another category.
        </p>
      )}

      {local.items.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          No line items were read from this receipt.
        </p>
      ) : (
        <div className="mt-2 space-y-1">
          {local.items.map((it) => {
            const v = draft[it.id] ?? "";
            const skipped = v === "__skip";
            return (
              <div key={it.id} className="flex items-center gap-2">
                <span
                  className={`min-w-0 flex-1 truncate text-[11px] ${skipped ? "text-muted-foreground line-through" : "text-foreground"}`}
                  title={it.description || ""}
                >
                  {it.description || "(no description)"}
                </span>
                <span
                  className={`w-20 text-right font-mono text-[11px] ${skipped ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {money(it.amount)}
                </span>
                <select
                  value={v}
                  disabled={!canEdit || saving}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [it.id]: e.target.value }))
                  }
                  className="h-7 max-w-[16rem] flex-1 rounded border border-border bg-card px-1 text-[11px] text-foreground disabled:opacity-60"
                >
                  <option value="">— unassigned —</option>
                  <option value="__skip">Skip (tax / fee / not a service)</option>
                  {OCR_FIELD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground">
              Lines total {money(Math.round(lineSum * 100) / 100)}
              {local.total !== null && Math.abs(lineSum - local.total) > 0.01 && (
                <> · differs from receipt total (tax/fees excluded)</>
              )}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={confirmSplit}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {saving ? "Saving…" : "Confirm split"}
              </button>
            )}
          </div>
        </div>
      )}

      <p className="mt-1 text-[10px] text-muted-foreground">
        Confirming a split records what the receipt breaks down to and marks each service it
        covers as done on {String.fromCharCode(8220)}Service Due{String.fromCharCode(8221)}, dated
        from this receipt. It does not change the amounts entered in Income &amp; Expenses.
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
  canReviewSplit,
  cellAmount,
  deletingId,
  setDeletingId,
  error,
  setError,
  serviceDateEditor,
}: Required<Pick<ReceiptViewerModalProps, "onClose" | "images" | "isLoading" | "monthLabel" | "year">> & {
  viewer: NonNullable<ReceiptViewerModalProps["viewer"]>;
  canDelete: boolean;
  onDeleted?: () => void;
  canReviewSplit: boolean;
  cellAmount?: number | null;
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
              <div key={img.id} className="flex flex-col">
                <ReceiptThumb
                  url={img.url}
                  filename={img.filename}
                  onDelete={canDelete ? () => handleDelete(img.id) : undefined}
                  deleting={deletingId === img.id}
                />
                <ReceiptOcrPanel
                  imageId={img.id}
                  ocr={img.ocr}
                  canEdit={canReviewSplit}
                  cellAmount={cellAmount}
                  onChanged={onDeleted}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
