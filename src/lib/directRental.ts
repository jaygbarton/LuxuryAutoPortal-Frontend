/**
 * Direct rentals: shared types, API calls and date/money helpers for the
 * booking page, the secure checkout and the staff screen.
 *
 * Trip times are local wall-clock strings at the vehicle's location
 * ("YYYY-MM-DDTHH:MM"), never converted through the browser's own time zone.
 */
import { buildApiUrl } from "./queryClient";

export const BOOKING_PAGE = "/salt-lake-city/book";
export const RENTAL_OFFICE_PHONE = "801-346-1394";

export interface RentalVehicle {
  id: number; name: string; year: number | null; make: string | null; model: string | null; trim: string | null; color: string | null;
  seats: number | null; doors: number | null; fuelType: string | null; cityMpg: number | null; hwyMpg: number | null; city: string | null; state: string | null;
  photos: string[]; fromDailyCents: number; discounts: { minDays: number; percent: number; label: string }[]; minimumDays: number;
}
export interface SearchVehicle extends RentalVehicle {
  available: boolean | null; reason: string | null;
  trip: { days: number; tripTotalCents: number; averageDailyCents: number } | null;
}
export interface VehicleDetail extends RentalVehicle {
  description: string; guidelines: string; features: string[]; faq: { question: string; answer: string }[];
  locations: { id: number; name: string; feeCents: number; isHome: boolean }[];
  extras: { id: number; label: string; description: string; unitCents: number; perDay: boolean; maxQuantity: number }[];
}
export interface RentalRules {
  minimumDays: number; maxDays: number; advanceNoticeHours: number; turnaroundHours: number; minimumDriverAge: number;
  depositCents: number; includedMilesPerDay: number; excessMileCents: number; fees: { code: string; label: string; percent: number }[];
}
export interface CalendarDay { day: string; cents: number; status: "free" | "partial" | "full" | "past" }
export interface QuoteLine { code: string; label: string; amountCents: number; detail?: string }
export interface Quote {
  days: number; rentalCents: number; discountCents: number; lines: QuoteLine[]; feeCents: number;
  tripTotalCents: number; depositCents: number; dueNowCents: number; includedMiles: number; dayRates: { day: string; cents: number; portion: number }[];
}
export type CheckStatus = "not_started" | "pending" | "verified" | "needs_review" | "failed";
export type StepKey = "details" | "license" | "insurance" | "agreement" | "payment";
export interface CustomerDetails {
  firstName: string; lastName: string; email: string; phone: string; dateOfBirth: string; address: string; city: string; state: string; zip: string;
  licenseNumber: string; licenseState: string; licenseExpiry: string; employer: string; employerCity: string; employerState: string; employerPhone: string;
}
export interface BookingView {
  token: string; reference: string; status: "pending" | "requested" | "confirmed" | "active" | "completed" | "cancelled" | "expired"; holdExpiresAt: string | null; version: number;
  car: { id: number; name: string; year: number | null }; start: string; end: string; timezone: string; locationName: string;
  extras: { id: number; label: string; unitCents: number; perDay: boolean; quantity: number }[]; quote: Quote; customer: CustomerDetails;
  license: { status: CheckStatus; online: boolean; reason: string | null };
  insurance: { choice: "own" | "bonzah" | null; status: CheckStatus; company: string; policyNumber: string; agent: string; agentPhone: string; reasons: string[]; protectionLabel: string | null; protectionCents: number; policyNumberIssued: string | null };
  agreement: { signed: boolean; signedAt: string | null; signedName: string | null; changedSinceSigning: boolean };
  payment: { status: "unpaid" | "processing" | "paid" | "failed" | "refunded"; paidCents: number };
  providers: { payment: boolean; licence: boolean; insurance: boolean; rentalInsurance: boolean; testMode: boolean };
  rentalInsuranceOptions: { code: "cdw" | "rcli" | "sli" | "pai"; name: string; summary: string }[];
  steps: Record<StepKey, boolean> & { next: StepKey | "done" };
}
export interface AgreementField { key: string; label: string; multiline?: boolean; money?: boolean }
export interface AgreementSection { key: string; title: string; fields: AgreementField[] }
export interface AgreementView {
  reference: string; sections: AgreementSection[]; fields: Record<string, string>; terms: { title: string; paragraphs: string[] }[];
  signed: boolean; signedAt: string | null; signedName: string | null;
}

export class RentalApiError extends Error {
  constructor(message: string, public status: number, public field?: string) { super(message); }
}
/** Calls a direct-rental endpoint and returns its body, or throws the server's own message. */
export async function rentalApi<T>(path: string, method: "GET" | "POST" | "PUT" | "PATCH" = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), { method, credentials: "include", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new RentalApiError("We couldn't reach the server. Check your connection and try again.", 0); }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.success === false) throw new RentalApiError(data?.error || "Something went wrong. Please try again.", response.status, data?.field);
  return data as T;
}

export const money = (cents: number, digits: 0 | 2 = 2) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

const pad = (n: number) => String(n).padStart(2, "0");
export const toDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const fromDay = (day: string) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (day: string, n: number) => { const d = fromDay(day); d.setDate(d.getDate() + n); return toDay(d); };
export function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end && days.length < 800; d = addDays(d, 1)) days.push(d);
  return days;
}
/** "Tue, Dec 1" */
export const shortDay = (day: string) => fromDay(day.slice(0, 10)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
/** "10:00 AM" */
export const clock = (time: string) => { const [h, m] = time.split(":").map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`; };
/** "Tue, Dec 1 at 10:00 AM" from a wall-clock string. */
export const wallLabel = (wall: string) => `${shortDay(wall.slice(0, 10))} at ${clock(wall.slice(11, 16))}`;
/** Half-hour pick-up and return times through the day. */
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);

/** Whether a range of days can be picked: no fully committed day inside it. */
export function rangeIsOpen(start: string, end: string, byDay: Map<string, CalendarDay>): boolean {
  return daysBetween(start, end).every(day => { const info = byDay.get(day); return !info || (info.status !== "full" && info.status !== "past"); });
}

export const STEP_LABELS: Record<StepKey, string> = { details: "Your details", license: "Driver's license", insurance: "Insurance", agreement: "Rental agreement", payment: "Payment" };
export const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
