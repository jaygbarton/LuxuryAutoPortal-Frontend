import type { ReactNode } from "react";
import { Car, Clock, ArrowRight, ArrowUpFromLine, ArrowDownToLine, User } from "lucide-react";

/**
 * Reusable dashboard record card, styled after the Day Schedule `EventCard`
 * (see operations/DayScheduleTab.tsx). It replaces the wide horizontally-
 * scrolling tables in the dashboard operations sections so each record reads
 * top-to-bottom on any screen width — no left/right scrolling.
 *
 * Layout: a colored accent bar on the left, then a content column with
 *  - a header row (category/type badge, optional reservation #, status slot)
 *  - the car name + plate
 *  - an optional guest / assigned-to line
 *  - the trip window (start → end) with a clock
 *  - pickup (green ↑) / drop off (red ↓) locations
 *  - a responsive key/value "details" grid for everything else
 *  - optional remarks/notes and an optional media (photo) slot
 *
 * Every field is OPTIONAL so each section can pass only what it has. This keeps
 * full parity with the old tables — no column is dropped, it's just re-laid-out.
 */

export interface DetailItem {
  label: string;
  /** Pre-formatted display value. Falsy / "—" values are skipped. */
  value: ReactNode;
}

export interface DashboardRecordCardProps {
  /** Tailwind bg-* class for the left accent bar + the type badge background. */
  accentBg?: string;
  /** Tailwind border-* class for the card border (matches the accent). */
  accentBorder?: string;
  /** Small uppercase label shown in the colored badge (e.g. "Pick Up", "Maintenance"). */
  typeLabel?: string;
  /** Optional className for the type badge text color (default white). */
  typeTextClass?: string;
  reservationId?: string | null;
  carName?: string | null;
  plate?: string | null;
  /** Guest name or, for non-trip records, any secondary identity line. */
  guestName?: string | null;
  assignedTo?: string | null;
  tripStart?: string | null;
  tripEnd?: string | null;
  /** Custom label for the time window when it isn't a Turo trip (default "Trip"). */
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  /** Key/value rows for all remaining fields. Empty/"—" rows are dropped. */
  details?: DetailItem[];
  /** Free-text remarks shown italic at the bottom. */
  notes?: string | null;
  /** Optional media (e.g. a photo thumbnail) shown at the top-right. */
  media?: ReactNode;
  /** Status control (the existing <Select>/<select>) — rendered in the header. */
  statusControl?: ReactNode;
  /** Optional click handler (e.g. navigate to a detail page). */
  onClick?: () => void;
}

function isEmpty(v: ReactNode): boolean {
  return v === null || v === undefined || v === "" || v === "—";
}

export function DashboardRecordCard({
  accentBg = "bg-slate-500",
  accentBorder = "border-slate-300",
  typeLabel,
  typeTextClass = "text-white",
  reservationId,
  carName,
  plate,
  guestName,
  assignedTo,
  tripStart,
  tripEnd,
  pickupLocation,
  dropoffLocation,
  details = [],
  notes,
  media,
  statusControl,
  onClick,
}: DashboardRecordCardProps) {
  const shownDetails = details.filter((d) => !isEmpty(d.value));
  const hasWindow = !isEmpty(tripStart) || !isEmpty(tripEnd);

  return (
    <div
      onClick={onClick}
      className={`flex items-stretch rounded-lg overflow-hidden border ${accentBorder} bg-white shadow-sm ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
    >
      {/* Accent bar */}
      <div className={`w-1.5 flex-shrink-0 ${accentBg}`} />

      {/* Content */}
      <div className="flex-1 min-w-0 px-3 py-2.5 space-y-1.5">
        {/* Header: type badge · reservation # · (spacer) · status */}
        <div className="flex items-start gap-2 flex-wrap">
          {typeLabel && (
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${accentBg} ${typeTextClass}`}>
              {typeLabel}
            </span>
          )}
          {!isEmpty(reservationId) && (
            <span className="text-[11px] font-medium text-muted-foreground">
              #{reservationId}
            </span>
          )}
          <div className="flex-1" />
          {media}
          {statusControl}
        </div>

        {/* Car + plate */}
        {!isEmpty(carName) && (
          <div className="flex items-center gap-1.5 text-sm text-foreground">
            <Car className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="font-semibold">{carName}</span>
            {!isEmpty(plate) && <span className="text-muted-foreground text-xs">· {plate}</span>}
          </div>
        )}

        {/* Guest */}
        {!isEmpty(guestName) && (
          <div className="text-xs text-muted-foreground">{guestName}</div>
        )}

        {/* Assigned to */}
        {!isEmpty(assignedTo) && (
          <div className="flex items-center gap-1.5 text-xs text-foreground">
            <User className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
            <span><span className="text-muted-foreground">Assigned:</span> {assignedTo}</span>
          </div>
        )}

        {/* Trip window */}
        {hasWindow && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-foreground font-medium">{isEmpty(tripStart) ? "—" : tripStart}</span>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <span className="text-foreground font-medium">{isEmpty(tripEnd) ? "—" : tripEnd}</span>
          </div>
        )}

        {/* Pickup / drop off */}
        {!isEmpty(pickupLocation) && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ArrowUpFromLine className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
            <span className="break-words"><span className="font-medium text-foreground">Pick Up:</span> {pickupLocation}</span>
          </div>
        )}
        {!isEmpty(dropoffLocation) && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ArrowDownToLine className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-600" />
            <span className="break-words"><span className="font-medium text-foreground">Drop Off:</span> {dropoffLocation}</span>
          </div>
        )}

        {/* Details grid — everything else, label over value, wraps responsively */}
        {shownDetails.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 pt-1 mt-1 border-t border-border/60">
            {shownDetails.map((d) => (
              <div key={d.label} className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 leading-tight">{d.label}</div>
                <div className="text-xs text-foreground break-words">{d.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Remarks */}
        {!isEmpty(notes) && (
          <div className="text-xs text-muted-foreground italic pt-0.5 break-words">{notes}</div>
        )}
      </div>
    </div>
  );
}
