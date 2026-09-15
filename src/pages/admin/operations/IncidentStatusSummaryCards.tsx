/**
 * Shared New/Charged the Guest/Paid/Disputed summary card row used by the
 * operations incident tabs (ticket violation, towing & impound, ...).
 */

import { SummaryCard } from "@/components/admin/dashboard/SummaryCard";

export function IncidentStatusSummaryCards({ statuses }: { statuses: string[] }) {
  const newCount = statuses.filter((s) => s === "new").length;
  const chargedCount = statuses.filter((s) => s === "charged_guest").length;
  const paidCount = statuses.filter((s) => s === "paid").length;
  const disputedCount = statuses.filter((s) => s === "disputed").length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <SummaryCard label="New" value={String(newCount)} variant="dark" />
      <SummaryCard label="Charged the Guest" value={String(chargedCount)} variant="gold" />
      <SummaryCard label="Paid" value={String(paidCount)} variant="white" />
      <SummaryCard label="Disputed" value={String(disputedCount)} variant="white" />
    </div>
  );
}
