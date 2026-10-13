export const DIRECT_BOOKING_PREVIEW_API = "/api/developer/direct-booking-preview";
export interface PreviewVehicle {
  carId: number;
  name: string;
  year: number | null;
  make: string | null;
  specs: string | null;
  photo: string | null;
  city: string | null;
  state: string | null;
  baseDailyRate: number | null;
  isListed: boolean;
}
export interface PreviewVehicleDetails extends PreviewVehicle {
  description: string | null;
  guidelines: string | null;
  features: string[];
  faq: { question: string; answer: string }[];
  locations: { id: number; name: string; fee: string | null }[];
  extras: { id: number; type: string; description: string | null; price: number | null }[];
}
export interface PreviewAvailability {
  status: "clear" | "conflict" | "unknown";
  complete: boolean;
  canConfirm: false;
  conflicts: { eventId: string; bookingKey: string; title: string; source: string; start: string | null; end: string | null }[];
  issues: { code: string; message: string }[];
  checkedAt: string;
}
export type PreviewDraftStatus = "draft" | "ready_for_review" | "cancelled";
export interface PreviewDraft {
  id: string;
  bookingKey: string;
  carId: number;
  startAt: string;
  endAt: string;
  timezone: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  status: PreviewDraftStatus;
  isPreview: true;
  version: number;
  quote: { currency: "USD"; baseDailyRate: number | null; estimatedTotal: null; requiresReview: true; reason: string };
  availability: PreviewAvailability;
  createdAt: string;
  updatedAt: string;
}
export interface PreviewDraftInput {
  carId: number;
  startAt: string;
  endAt: string;
  timezone: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  status: PreviewDraftStatus;
}
