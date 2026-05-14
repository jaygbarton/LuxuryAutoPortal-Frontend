export interface TuroTrip {
  id: number;
  reservationId: string;
  dateBooked: string;
  carName: string | null;
  carLink: string | null;
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
  task_type: "cleaning" | "delivery" | "pickup";
  assigned_to: string;
  scheduled_date: string | null;
  scheduled_location: string | null;
  due_date: string | null;
  status: "new" | "in_progress" | "completed" | "delivered";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

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
  created_at: string;
  updated_at: string;
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
}

export type TaskType = "cleaning" | "delivery" | "pickup";
export type TaskStatus = "new" | "in_progress" | "completed" | "delivered";
export type InspectionStatus = "new" | "in_progress" | "completed" | "no_issues";
export type MaintenanceStatus = "new" | "in_progress" | "completed" | "damage_reported" | "in_review" | "in_repair" | "charged_customer";
