export interface TuroTrip {
  id: number;
  reservation_id: string;
  car_name: string;
  guest_name: string;
  trip_start: string;
  start_location: string;
  trip_end: string;
  return_location: string;
  status: string;
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
  status: "new" | "in_progress" | "completed";
  inspection_date: string | null;
  notes: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRecord {
  id: number;
  inspection_id: number | null;
  car_name: string;
  task_description: string;
  assigned_to: string;
  scheduled_date: string | null;
  status: "new" | "in_progress" | "completed";
  notes: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export type TaskType = "cleaning" | "delivery" | "pickup";
export type TaskStatus = "new" | "in_progress" | "completed" | "delivered";
export type InspectionStatus = "new" | "in_progress" | "completed";
export type MaintenanceStatus = "new" | "in_progress" | "completed";
