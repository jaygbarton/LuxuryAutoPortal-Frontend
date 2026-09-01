import React from "react";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";

/**
 * Records the real day a COGS expense was incurred — the date printed on the
 * receipt. That day is what Operations > Service Due shows as Last Windshield /
 * Last Oil Change / etc., and what it uses to calculate the next due date.
 *
 * The I&E cell is keyed by (car, year, month) only, so the receipt date is
 * stored separately and may fall in a different month than the cell (expense
 * booked in March, work done in August). Clearing the date falls back to the
 * cell's month.
 *
 * Shared by the receipt viewer and the COGS cell editor: entering the amount
 * and entering the date it happened are the same moment of work.
 */

const SERVICE_DUE_COLUMN: Record<string, string> = {
  oilLube: "Last Oil Change",
  tires: "Last Tires",
  brakes: "Last Brakes",
  windshield: "Last Windshield",
  mechanic: "Last Mechanic",
  licenseRegistration: "Last License & Reg.",
};

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
  const dueLabel = SERVICE_DUE_COLUMN[field];

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
        {dueLabel
          ? `The date printed on the receipt — the actual service date. Operations > Service Due uses this as ${dueLabel} and to calculate the next due date. It does not have to match this month.`
          : "The date printed on the receipt — the actual service date. Used by Operations > Service Due. It does not have to match this month."}
      </p>
      {msg && (
        <p className={`mt-1 text-[11px] ${msg.ok ? "text-green-600" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
