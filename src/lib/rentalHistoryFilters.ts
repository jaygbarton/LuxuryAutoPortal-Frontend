export const RENTAL_HISTORY_STATUSES = ["booked", "ended", "cancelled"] as const;

export type RentalHistoryStatus = (typeof RENTAL_HISTORY_STATUSES)[number];

export function buildRentalHistorySearchParams({
  plate,
  vin,
  statuses,
}: {
  plate?: string | null;
  vin?: string | null;
  statuses: readonly RentalHistoryStatus[];
}): URLSearchParams {
  const params = new URLSearchParams({ limit: "200", offset: "0" });
  if (plate) params.set("plate", plate);
  if (vin) params.set("vin", vin);
  if (statuses.length > 0) params.set("status", statuses.join(","));
  return params;
}
