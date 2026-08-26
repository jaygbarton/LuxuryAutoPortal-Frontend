import React from "react";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";

/**
 * Records the real day a COGS expense was incurred — the date printed on the
 * receipt.
 *
 * Why this exists: car_cogs_expenses is keyed by (car, year, month) with no
 * day, so Operations > Service Due could only ever date a service to the 1st
 * of its month — a mechanic visit whose receipt reads 04/08/2026 showed as
 * 04/01/2026. Saving the date here makes that report exact. Clearing it falls
 * back to the month.
 *
 * Shared by the receipt viewer and the COGS cell editor: entering the amount
 * and entering the date it happened are the same moment of work, and when the
 * date lived only behind the receipt viewer nobody filled it in (the table had
 * zero rows fleet-wide, so every Service Due date still read as the 1st).
 */
export default function ServiceDateEditor({
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
          defaultValue={value}
          key={value}
          min={monthStart}
          max={monthEnd}
          disabled={!loaded || saving}
          onChange={(e) => {
            const next = e.target.value;
            // A native date input fires onChange on every keystroke, including
            // while the year is still partially typed (e.g. "0002-08-24"
            // before the "2026" finishes). It's uncontrolled (defaultValue, not
            // value) so a keystroke we're not ready to save yet still stays on
            // screen instead of the browser's partial year snapping back to
            // whatever we last rendered — only round-trip once the date is a
            // complete, plausible value.
            if (next && !/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
            if (next && Number(next.slice(0, 4)) < 1000) return;
            save(next);
          }}
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
