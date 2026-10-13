import { addUtcDays, dayKeyToUtcDate, utcDateToDayKey } from "@/lib/mt-datetime";

export const MAINTENANCE_APPOINTMENTS_API = "/api/maintenance-appointments";
export interface MaintenanceAppointment {
  maintenanceId: number;
  carId: number;
  startAt: string;
  endAt: string;
  timezone: string;
  destination: string;
  version: number;
  status: "confirmed" | "cancelled";
  confirmedBy: number;
  confirmedAt: string;
  cancelledAt: string | null;
}
export interface MaintenanceAppointmentDetails {
  task: { id: number; carId: number | null; carName: string; status: string; repairShop: string | null };
  appointment: MaintenanceAppointment | null;
  version: number;
}
export interface MaintenanceAppointmentAvailability {
  status: "clear" | "conflict" | "unknown";
  complete: boolean;
  canSchedule: boolean;
  conflicts: { bookingKey: string; title: string; start: string | null; end: string | null }[];
  warnings: string[];
  checkedAt: string;
}
export interface MaintenanceAppointmentAvailabilityResponse {
  availability: MaintenanceAppointmentAvailability;
  version: number;
  carId: number;
}

/** Add calendar days to a wall-time input, preserving the pickup clock time across DST. */
export function maintenanceReturnAfterDays(start: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) || !Number.isInteger(days) || days < 1 || days > 366) return null;
  const date = dayKeyToUtcDate(start.slice(0, 10));
  if (!Number.isFinite(date.getTime()) || utcDateToDayKey(date) !== start.slice(0, 10)) return null;
  return `${utcDateToDayKey(addUtcDays(date, days))}${start.slice(10)}`;
}
