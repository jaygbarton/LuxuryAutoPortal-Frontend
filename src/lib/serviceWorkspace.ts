import type { CarServiceDue } from '@/pages/admin/operations/types';
export interface ServiceItem {
  id: string; kind: string; label: string; lastServiced: string | null;
  lastServicedSource?: "maintenance"; maintenanceId?: number;
  dueDate: string | null; daysUntil: number | null;
  status: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'no_data' | 'as_needed' | 'not_applicable';
}
export interface ServiceCar extends CarServiceDue { services: ServiceItem[]; nextService: ServiceItem | null; }
export interface ServiceWorkspace { today: string; generatedAt: string; cars: ServiceCar[]; rules: { kind: string; label: string; interval: number | null }[]; }
export interface ServiceHistory { id: string; carId: number; kind: string; label: string; date: string | null; dateBasis: string; status: string; amount: number | null; files: string[]; notes: string | null; year?: number; month?: number; }
export function serviceLabel(service: ServiceItem) {
  if (service.status === 'overdue') return `Overdue · ${Math.abs(service.daysUntil!)} days`;
  if (service.status === 'due_today') return 'Due today';
  if (service.daysUntil !== null) return `Due in ${service.daysUntil} days`;
  return { no_data: 'No Data', as_needed: 'As needed', not_applicable: 'Not applicable (EV)' }[service.status as 'no_data' | 'as_needed' | 'not_applicable'] || service.status;
}
export function serviceDate(date: string | null) {
  if (!date) return 'No Data';
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}
export function safeServiceFile(url: string) { return /^https:\/\//i.test(url) || /^\/(?!\/)/.test(url); }
