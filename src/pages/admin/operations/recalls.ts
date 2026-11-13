/**
 * Operations → Recall: vehicle safety recalls.
 *
 * Rows come from Turo "unlisted due to a safety recall" emails (from Nov 12,
 * 2026) and from manual entry. A recall is an overlay on the car: the car keeps
 * its Active/Inactive fleet status for payments and totals, and shows a RECALL
 * badge while a recall is open (status "new").
 */
import { api } from "@/lib/api";

export type RecallStatus = "new" | "repair_completed";

export interface Recall {
  id: number;
  carId: number | null;
  turoVehicleId: string | null;
  vehicleLabel: string | null;
  status: RecallStatus;
  assignedTo: string | null;
  assignedToId: number | null;
  scheduledRepairDate: string | null;
  repairCompletedDate: string | null;
  notes: string | null;
  source: "email" | "manual";
  emailReceivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  carName: string | null;
  carPhoto: string | null;
  vin: string | null;
  plate: string | null;
  carStatus: string | null;
}

export interface RecallInput {
  carId?: number | null;
  vehicleLabel?: string | null;
  vin?: string | null;
  plate?: string | null;
  status?: RecallStatus;
  assignedTo?: string | null;
  assignedToId?: number | null;
  scheduledRepairDate?: string | null;
  repairCompletedDate?: string | null;
  notes?: string | null;
  /** From a car's Status dropdown: re-use the car's open recall instead of adding another. */
  reuseOpen?: boolean;
}

export const RECALLS_PATH = "/api/operations/recalls";

export const RECALL_STATUS_OPTIONS: { value: RecallStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "repair_completed", label: "Repair Completed" },
];

export const recallStatusLabel = (status: string) =>
  RECALL_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;

export async function fetchRecalls(filters: { status?: RecallStatus; carId?: number } = {}): Promise<Recall[]> {
  const body = await api.get<{ data: Recall[] }>(RECALLS_PATH, {
    query: { status: filters.status, carId: filters.carId },
    fallbackMessage: "Failed to load recalls",
  });
  return body.data ?? [];
}

export const createRecall = (input: RecallInput) =>
  api.post<{ data: Recall; created: boolean }>(RECALLS_PATH, input, { fallbackMessage: "Failed to add recall" });

export const updateRecall = (id: number, input: RecallInput) =>
  api.put<{ data: Recall }>(`${RECALLS_PATH}/${id}`, input, { fallbackMessage: "Failed to update recall" });

export const deleteRecall = (id: number) =>
  api.delete(`${RECALLS_PATH}/${id}`, { fallbackMessage: "Failed to delete recall" });

/** A stored YYYY-MM-DD as MM/DD/YYYY, without letting a timezone shift the day. */
export function formatRecallDay(key: string | null | undefined): string {
  if (!key || !/^\d{4}-\d{2}-\d{2}/.test(key)) return "--";
  const [y, m, d] = key.slice(0, 10).split("-");
  return `${m}/${d}/${y}`;
}

/** Whole days a recall has been open, counted from the Turo email (or entry). */
export function daysOpen(recall: Pick<Recall, "emailReceivedAt" | "createdAt">, now = Date.now()): number {
  const since = Date.parse(recall.emailReceivedAt ?? recall.createdAt);
  return Number.isFinite(since) ? Math.max(0, Math.floor((now - since) / 86_400_000)) : 0;
}

export const recallVehicleName = (r: Pick<Recall, "carName" | "vehicleLabel">) => r.carName || r.vehicleLabel || "Unknown vehicle";
