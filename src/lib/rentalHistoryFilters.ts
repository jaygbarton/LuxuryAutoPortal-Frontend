export const RENTAL_HISTORY_STATUSES = ["booked", "cancelled", "ended", "returned"] as const;

export type RentalHistoryStatus = "all" | (typeof RENTAL_HISTORY_STATUSES)[number];

export function buildRentalHistorySearchParams({
  plate,
  vin,
  status,
}: {
  plate?: string | null;
  vin?: string | null;
  status: RentalHistoryStatus;
}): URLSearchParams {
  const params = new URLSearchParams({ limit: "200", offset: "0" });
  if (plate) params.set("plate", plate);
  if (vin) params.set("vin", vin);
  if (status !== "all") params.set("status", status);
  return params;
}
