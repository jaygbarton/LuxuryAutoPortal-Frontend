export interface TuroTrip {
  id: number;
  reservationId: string;
  dateBooked: string;
  carName: string | null;
  carLink: string | null;
  plateNumber: string | null;
  vinNumber: string | null;
  guestName: string | null;
  guestLink: string | null;
  phoneNumber: string | null;
  tripStart: string;
  tripEnd: string;
  earnings: number;
  cancelledEarnings: number;
  status: string;
  calendarEventId: string | null;
  deliveryLocation: string | null;
  pickupLocation: string | null;
  returnLocation: string | null;
  totalDistance: string | null;
  extras: string | null;
  milesIncluded: string | null;
  milesDriven: string | null;
  tripStartOdometer: number | null;
  tripEndOdometer: number | null;
  gasLevelTripStart: string | null;
  gasLevelTripEnd: string | null;
  emailSubject: string | null;
  emailReceivedAt: string | null;
  cancellationReason: string | null;
}

export interface OperationTask {
  id: number;
  turo_trip_id: number | null;
  reservation_id: string | null;
  car_name: string;
  guest_name: string | null;
  task_type: "cleaning" | "delivery" | "pickup" | "refuel";
  assigned_to: string;
  assigned_to_id: number | null;
  scheduled_date: string | null;
  scheduled_location: string | null;
  due_date: string | null;
  status: "new" | "in_progress" | "completed" | "delivered";
  notes: string | null;
  // Trip gas levels joined from turo_trips so this tab can show/edit them.
  gas_level_trip_start?: string | null;
  gas_level_trip_end?: string | null;
  created_at: string;
  updated_at: string;
}

export type FuelLevelReturned =
  | "unknown"
  | "empty"
  | "quarter"
  | "half"
  | "three_quarters"
  | "full";

/** Fixed car-issue categories selectable during inspection. The inspector can
 *  also add a free-text value via the "Others" box in the modal, so the stored
 *  car_issue_types array may contain strings outside this list. */
export const CAR_ISSUE_TYPES = [
  "Mechanic",
  "Electric",
  "Accident",
  "Brakes",
  "Engine Light",
  "Windshield",
  "Battery",
  "Oil Change",
  "Tires",
  "Gas Not full / Same Level",
] as const;

export interface Inspection {
  id: number;
  turo_trip_id: number | null;
  reservation_id: string | null;
  car_name: string;
  source: "turo_return" | "manual" | string;
  assigned_to: string;
  status: "new" | "in_progress" | "completed" | "no_issues";
  inspection_date: string | null;
  due_date: string | null;
  moved_to_maintenance: boolean;
  notes: string | null;
  photos: string[];
  /** Inspector's reading of the fuel gauge when the car came back. Anything
   *  other than 'full' fires an admin notification so the team can charge
   *  for an incidentals reimbursement on Turo. */
  fuel_level_returned?: FuelLevelReturned;
  /** Categorized car issues found during inspection. Includes the fixed
   *  CAR_ISSUE_TYPES plus any free-text "Others" values the inspector typed. */
  car_issue_types?: string[] | null;
  /** Trip gas levels joined from turo_trips (via turo_trip_id). Editable in the
   *  Car Issues / Turo Messages / No Car Issues tabs; writes back to the trip. */
  gas_level_trip_start?: string | null;
  gas_level_trip_end?: string | null;
  car_photo?: string | null;
  created_at: string;
  updated_at: string;
}

export type ClaimStatus =
  | "estimate_requested"
  | "estimate_sent_to_turo"
  | "resolved"
  | "not_resolved";

export interface Claim {
  id: number;
  reservationId: string | null;
  claimId: string | null;
  damageReport: string | null;
  shopName: string | null;
  deadline: string | null;
  description: string | null;
  status: ClaimStatus;
  assignedTo: string | null;
  assignedToId: number | null;
  emailReceivedAt: string | null;
  source: "email" | "manual";
  createdAt: string;
  updatedAt: string;
  // Derived (joined from turo_trips) — null until a matching trip syncs
  tripStart: string | null;
  tripEnd: string | null;
  guestName: string | null;
  carName: string | null;
  vin: string | null;
  plate: string | null;
}

export interface MaintenanceRecord {
  id: number;
  inspection_id: number | null;
  /** Foreign key to the car. Preferred over car_name for new rows. */
  car_id: number | null;
  car_name: string;
  task_description: string;
  assigned_to: string;
  assigned_to_id: number | null;
  scheduled_date: string | null;
  due_date: string | null;
  status: string;
  notes: string | null;
  photos: string[];
  repair_shop: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined from the car table on read. Null on legacy rows without car_id.
  car_make: string | null;
  car_model: string | null;
  car_year: number | null;
  car_plate: string | null;
  car_vin: string | null;
  // Trip context joined on the backend via inspection_id → inspections →
  // turo_trips. Null when there's no linked inspection/trip (manual rows).
  trip_id?: number | null;
  trip_reservation_id?: string | null;
  trip_start?: string | null;
  trip_end?: string | null;
  trip_pickup_location?: string | null;
  trip_delivery_location?: string | null;
  trip_return_location?: string | null;
  trip_extras?: string | null;
  trip_miles_included?: number | null;
  trip_total_distance?: number | null;
  trip_start_odometer?: number | null;
  trip_end_odometer?: number | null;
  trip_earnings?: string | number | null;
  trip_cancelled_earnings?: string | number | null;
  trip_status?: string | null;
  trip_plate_number?: string | null;
  // Inspection findings joined on read so the Maintenance tab can show the
  // same Fuel Returned / Car Issues Type columns as the other tabs.
  inspection_fuel_level_returned?: FuelLevelReturned | null;
  inspection_car_issue_types?: string[] | null;
  /** Trip gas levels joined through inspection_id → inspections → turo_trips.
   *  Editable in the Maintenance tab; writes back to the trip. */
  gas_level_trip_start?: string | null;
  gas_level_trip_end?: string | null;
  /** Car-owner approval workflow (set when status becomes "Maintenance Reported"). */
  owner_approval_status?: "not_sent" | "email_sent" | "approved" | "declined" | "auto_approved" | null;
  owner_decline_reason?: string | null;
  owner_wants_pickup?: 0 | 1 | boolean | null;
  owner_responded_at?: string | null;
}

export type TaskType = "cleaning" | "delivery" | "pickup" | "refuel" | "mechanic" | "windshield" | "license_plate" | "airport";
export type TaskStatus = "new" | "in_progress" | "completed" | "delivered";
export type InspectionStatus =
  | "new"
  | "in_progress"
  | "completed"
  | "no_issues";
export type MaintenanceStatus =
  | "new"
  | "in_progress"
  | "completed"
  | "damage_reported"
  | "in_review"
  | "in_repair"
  | "charged_customer";
