/**
 * Canonical list of commission types, in display order (alphabetical A-Z).
 *
 * This is the same set of rows shown in the employee's My Info → Commissions
 * matrix and the dashboard Commissions sections. Keep this as the single
 * source of truth so the Add/Edit Commission dropdown stays in sync with the
 * matrix.
 */
export const COMMISSION_TYPES = [
  "Annual Inspections",
  "Bouncie",
  "Car Management Split",
  "Car Registrations",
  "Car Swap",
  "Electric - Reimbursed",
  "Exit Parking Ticket",
  "Gas - Reimbursed",
  "Insurance",
  "Invoice",
  "Last Minute Commissions",
  "Late Return",
  "Maintenance",
  "Miles Charges",
  "New Car - Onboard",
  "Parking Airport",
  "Relist Car",
  "Ski Rack's",
  "Turo Claims",
  "Turo Negative Review Removal",
  "Turo Positive Reviews",
  "Uber & Lyft",
  "Uber - Reimbursed",
  "Uber Ride",
  "Zero Parking Fee",
] as const;

export type CommissionType = (typeof COMMISSION_TYPES)[number];
