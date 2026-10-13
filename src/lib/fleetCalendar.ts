export const FLEET_CALENDAR_SOURCES = ["turo", "owner_rental", "block_off", "maintenance", "direct_booking"] as const;
export type FleetCalendarSource = typeof FLEET_CALENDAR_SOURCES[number];

export interface FleetCalendarCar {
  carId: number;
  carName: string;
  plateNumber: string | null;
  carStatus: string | null;
}

export interface FleetCalendarEvent {
  id: string;
  bookingKey: string;
  source: FleetCalendarSource;
  sourceId: number;
  carId: number | null;
  carName: string;
  plateNumber: string | null;
  title: string;
  start: string | null;
  end: string | null;
  status: string;
  blocksAvailability: boolean;
  cancelled: boolean;
  timeStatus: "confirmed" | "open_ended" | "missing";
  reservationId?: string | null;
  notes?: string | null;
  detailUrl?: string | null;
  googleClassification?: "blocked" | "unclassified" | "ignored";
}

export interface FleetCalendarResponse {
  success?: boolean;
  role: "admin" | "employee";
  timezone: string;
  from: string;
  to: string;
  generatedAt: string;
  cars: FleetCalendarCar[];
  events: FleetCalendarEvent[];
  warnings: string[];
  complete: boolean;
  availabilityComplete: boolean;
  sync?: { status: string; lastSuccessAt: string | null; pending: number; failed: number; configured?: boolean; lastError?: string | null };
}

export const FLEET_SOURCE_LABELS: Record<FleetCalendarSource, string> = {
  turo: "Turo trips",
  owner_rental: "Owner rentals",
  block_off: "Blocked off",
  maintenance: "Maintenance",
  direct_booking: "Direct rentals",
};

export function isCancelledCalendarEvent(event: FleetCalendarEvent): boolean {
  return event.cancelled === true || /^(?:cancelled|canceled)$/i.test(event.status);
}

/** Cancelled history never makes a vehicle look occupied. */
export function eventBlocksAvailability(event: FleetCalendarEvent): boolean {
  return event.blocksAvailability && !isCancelledCalendarEvent(event);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Reject malformed feeds rather than silently hiding unsupported records. */
export function normalizeFleetCalendarResponse(value: unknown): FleetCalendarResponse {
  if (!isRecord(value) || value.success === false || !Array.isArray(value.cars) || !Array.isArray(value.events)) {
    throw new Error("The calendar response is incomplete. Please retry.");
  }
  const cars = value.cars.map((car) => {
    if (!isRecord(car) || !Number.isSafeInteger(car.carId) || typeof car.carName !== "string") {
      throw new Error("The calendar returned an invalid vehicle. Please retry.");
    }
    return {
      ...car,
      plateNumber: car.plateNumber ?? car.plate ?? null,
      carStatus: car.carStatus ?? car.status ?? null,
    };
  });
  const events = value.events.map((event) => {
    if (!isRecord(event) || typeof event.source !== "string" || !FLEET_CALENDAR_SOURCES.includes(event.source as FleetCalendarSource)) {
      throw new Error("The calendar returned an unsupported event source. No records have been hidden; please retry.");
    }
    if (typeof event.id !== "string" || typeof event.bookingKey !== "string" ||
        typeof event.title !== "string" || typeof event.carName !== "string" ||
        typeof event.status !== "string" || typeof event.cancelled !== "boolean" ||
        typeof event.blocksAvailability !== "boolean" ||
        !(event.carId === null || Number.isSafeInteger(event.carId)) ||
        !(event.start === null || typeof event.start === "string") ||
        !(event.end === null || typeof event.end === "string")) {
      throw new Error("The calendar returned an incomplete event. Please retry.");
    }
    return { ...event, plateNumber: event.plateNumber ?? event.plate ?? null };
  });
  const rawSync = isRecord(value.sync) ? value.sync : null;
  const counts = rawSync && isRecord(rawSync.counts) ? rawSync.counts : {};
  const pending = Number(rawSync?.pending ?? counts.pending ?? 0);
  const failed = Number(rawSync?.failed ?? counts.error ?? 0);
  const lastSuccess = rawSync?.lastSuccessAt ?? rawSync?.lastSuccess;
  const sync = rawSync ? {
    status: typeof rawSync.status === "string" ? rawSync.status : rawSync.lastError || failed > 0 ? "needs_attention" : pending > 0 ? "pending" : lastSuccess ? "synced" : "not_started",
    lastSuccessAt: typeof lastSuccess === "string" ? lastSuccess : null,
    pending, failed,
    configured: typeof rawSync.configured === "boolean" ? rawSync.configured : undefined,
    lastError: typeof rawSync.lastError === "string" ? rawSync.lastError : null,
  } : undefined;
  return { ...value, cars, events, sync } as unknown as FleetCalendarResponse;
}
