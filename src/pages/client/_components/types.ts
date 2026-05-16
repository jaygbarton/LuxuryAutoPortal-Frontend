export interface ClientCar {
  id: number;
  vin: string | null;
  makeModel: string;
  make: string | null;
  model: string | null;
  licensePlate: string | null;
  year: number | null;
  mileage: number;
  status: string;
  exteriorColor: string | null;
  interiorColor: string | null;
  tireSize: string | null;
  oilType: string | null;
  lastOilChange: string | null;
  fuelType: string | null;
  registrationExpiration: string | null;
  photo?: string | null;
  manufacturerWebsite?: string | null;
  manufacturerUsername?: string | null;
  turoPassword?: string | null;
}

export interface ClientProfile {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  cars: ClientCar[];
  onboarding?: {
    firstNameOwner?: string;
    lastNameOwner?: string;
    emailOwner?: string;
    phoneOwner?: string;
    manufacturerUrl?: string;
  } | null;
  bankingInfo?: {
    bankName?: string | null;
    accountNumber?: string | null;
  } | null;
}

export interface Payment {
  payments_aid: number;
  payments_car_id: number;
  payments_year_month: string;
  payments_amount: number;
  payments_amount_payout: number;
  payments_amount_balance: number;
  payments_reference_number: string;
  payments_invoice_id: string;
  payments_invoice_date: string | null;
  payments_attachment: string | null;
  payments_remarks: string | null;
  payment_status_name: string;
  payment_status_color: string;
  car_make_model: string;
  car_make_name: string;
  car_plate_number: string;
  car_vin_number: string;
  car_year: number;
}

export interface TuroTrip {
  id: number;
  tripStart: string;
  tripEnd: string;
  earnings: number;
  cancelledEarnings: number;
  status: "booked" | "cancelled" | "completed";
  totalDistance: string | null;
  carName: string | null;
}

export interface QuickLink {
  id: number;
  category: string;
  title: string;
  url: string;
  visibleToClients: boolean;
}

export interface TotalsData {
  income?: { totalProfit?: number };
  carManagementSplit?: number;
  expenses?: { totalOperatingExpenses?: number };
  payments?: { total?: number };
  history?: { daysRented?: number };
}

export interface MaintenanceRecord {
  type?: string;
  maintenanceType?: string;
  dateCompleted?: string;
  date_completed?: string;
  status?: string;
  price?: number;
  remarks?: string;
}

export interface NadaDepreciation {
  nadaDepreciationAid: number;
  nadaDepreciationDate: string;
  nadaDepreciationAmount: number;
  nadaDepreciationCarId: number;
}

export interface MonthlyTripRow {
  month: string;
  shortMonth: string;
  monthKey: string;
  income: number;
  expenses: number;
  profit: number;
  days: number;
  trips: number;
  avgPerTrip: number;
}

export interface MonthlyDaysTripsRow {
  month: string;
  shortMonth: string;
  days: number;
  trips: number;
  avgPerTrip: number;
  income: number;
}

export interface YearTotals {
  income: number;
  expenses: number;
  profit: number;
  days: number;
  trips: number;
}

export interface YearTotalsTrips {
  days: number;
  trips: number;
  income: number;
}
