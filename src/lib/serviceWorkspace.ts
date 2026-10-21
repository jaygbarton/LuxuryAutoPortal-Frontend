import type { CarServiceDue } from '@/pages/admin/operations/types';
export interface ServiceItem {
  id: string; kind: string; label: string; lastServiced: string | null;
  lastServicedSource?: "maintenance" | "record" | "legacy"; maintenanceId?: number; milesUntilNext?: number | null; odometerAtService?: number | null; nextServiceOdometer?: number | null; milesRemaining?: number | null; mileageWarning?: string | null; mileageOverdue?: boolean; mileageDueNow?: boolean;
  dueDate: string | null; daysUntil: number | null;
  status: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'no_data' | 'as_needed' | 'not_applicable';
}
export interface ServiceMileage { miles: number | null; source: 'bouncie' | 'turo_return' | 'turo_start' | null; observedAt: string | null; state: 'recent' | 'last_known' | 'conflict' | 'unavailable'; warning: string | null; }
export interface ServiceCar extends CarServiceDue { currentMileage?: ServiceMileage; services: ServiceItem[]; nextService: ServiceItem | null; }
export interface ServiceWorkspace { today: string; generatedAt: string; cars: ServiceCar[]; canOpenCarFiles?: boolean; rules: { kind: string; label: string; interval: number | null }[]; }
export interface ServiceHistory { sourceRecordIds?: string[]; maintenanceId?: number; reportCount?: number; reportTripCount?: number; id: string; carId: number; kind: string; label: string; date: string | null; dateBasis: string; status: string; amount: number | null; files: string[]; notes: string | null; year?: number; month?: number; }
export function serviceLabel(service: ServiceItem) {
  if (service.mileageOverdue) return `Overdue · ${Math.abs(service.milesRemaining!).toLocaleString()} miles`;
  if (service.mileageDueNow && service.status !== 'overdue') return 'Due now · mileage';
  if (service.status === 'overdue') return `Overdue · ${Math.abs(service.daysUntil!)} days`;
  if (service.status === 'due_today') return 'Due today';
  if (service.daysUntil === null && service.milesRemaining != null) return `${service.milesRemaining.toLocaleString()} miles to next service`;
  if (service.daysUntil !== null) return `Due in ${service.daysUntil} days`;
  return { no_data: 'No Data', as_needed: 'As needed', not_applicable: 'Not applicable (EV)' }[service.status as 'no_data' | 'as_needed' | 'not_applicable'] || service.status;
}
export function serviceDate(date: string | null) {
  if (!date) return 'No Data';
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}
export function safeServiceFile(url: string) { return /^https:\/\//i.test(url) || /^\/(?!\/)/.test(url); }

export function compareServiceUrgency(a: ServiceItem, b: ServiceItem) {
  const rank = (s: ServiceItem) => ({ overdue: 0, due_today: 1, due_soon: 2, upcoming: 3, as_needed: 4, no_data: 5, not_applicable: 6 })[s.status];
  return rank(a)-rank(b) || (a.daysUntil ?? Infinity)-(b.daysUntil ?? Infinity) || (a.milesRemaining ?? Infinity)-(b.milesRemaining ?? Infinity) || Number(!a.lastServiced)-Number(!b.lastServiced) || a.label.localeCompare(b.label);
}
