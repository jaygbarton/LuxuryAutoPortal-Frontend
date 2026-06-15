import { useState } from "react";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

/** Gas-level dropdown options shared by every Operations tab. Values match the
 *  turo_trips.gas_level_trip_start / _end column values written by the parser. */
const GAS_OPTIONS: { value: string; label: string }[] = [
  { value: "empty", label: "Empty" },
  { value: "quarter", label: "1/4" },
  { value: "half", label: "1/2" },
  { value: "three_quarters", label: "3/4" },
  { value: "full", label: "Full" },
];

const NONE = "__none__";

/**
 * GasLevelCells — renders TWO <TableCell>s (Gas Level Trip Start + Trip End) with
 * editable dropdowns that write back to the originating Turo trip via
 * PATCH /api/turo-trips/:id/gas-levels.
 *
 * Shared across Trip Tasks, Turo Messages, Car Issues, Maintenance, and No Car
 * Issues so all tabs edit the same trip-level fields consistently. Drop it into a
 * <TableRow> exactly where the two columns belong (it returns a fragment of two
 * cells), and add the matching pair of <TableHead>s to that table's header.
 *
 * `tripId` null/undefined → the row has no linked trip, so both cells show "--"
 * and are non-editable (there's nothing to save against). A single Save button
 * (on the Start cell) commits both values.
 */
export function GasLevelCells({
  tripId,
  start,
  end,
  onSaved,
}: {
  tripId: number | null | undefined;
  start: string | null | undefined;
  end: string | null | undefined;
  /** Called after a successful save so the caller can invalidate its queries. */
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  // Local pending edits; undefined means "not edited, show the prop value".
  const [draftStart, setDraftStart] = useState<string | undefined>(undefined);
  const [draftEnd, setDraftEnd] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const startVal = draftStart !== undefined ? draftStart : (start ?? "");
  const endVal = draftEnd !== undefined ? draftEnd : (end ?? "");
  const dirty = draftStart !== undefined || draftEnd !== undefined;
  const noTrip = tripId == null;

  const save = async () => {
    if (tripId == null) return;
    setSaving(true);
    try {
      const res = await fetch(buildApiUrl(`/api/turo-trips/${tripId}/gas-levels`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gasLevelTripStart: startVal || null,
          gasLevelTripEnd: endVal || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setDraftStart(undefined);
      setDraftEnd(undefined);
      toast({ title: "Gas levels saved" });
      onSaved?.();
    } catch {
      toast({ title: "Failed to save gas levels", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const renderSelect = (value: string, onChange: (v: string) => void) => (
    <Select
      value={value || NONE}
      onValueChange={(v) => onChange(v === NONE ? "" : v)}
      disabled={noTrip}
    >
      <SelectTrigger className="h-7 w-[110px] text-xs">
        <SelectValue placeholder="--" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>--</SelectItem>
        {GAS_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <TableCell className="text-foreground text-sm whitespace-nowrap">
        {noTrip ? (
          <span className="text-muted-foreground text-xs">--</span>
        ) : (
          <div className="flex items-center gap-1">
            {renderSelect(startVal, setDraftStart)}
            {dirty && (
              <Button
                variant="default"
                size="sm"
                className="h-7 px-2"
                onClick={save}
                disabled={saving}
              >
                {saving ? "…" : "Save"}
              </Button>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-foreground text-sm whitespace-nowrap">
        {noTrip ? (
          <span className="text-muted-foreground text-xs">--</span>
        ) : (
          <div className="flex items-center gap-1">
            {renderSelect(endVal, setDraftEnd)}
          </div>
        )}
      </TableCell>
    </>
  );
}
