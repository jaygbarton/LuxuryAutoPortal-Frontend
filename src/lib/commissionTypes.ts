/**
 * Canonical list of commission types, in display order.
 *
 * This is the same set of rows shown in the employee's My Info → Commissions
 * matrix and the dashboard Commissions sections. Keep this as the single
 * source of truth so the Add/Edit Commission dropdown stays in sync with the
 * matrix.
 */
export const COMMISSION_TYPES = [
  "Parking Airport",
  "Uber & Lyft",
  "Electric - Reimbursed",
  "Gas - Reimbursed",
  "Uber - Reimbursed",
  "Ski Rack's",
  "New Car 1%",
  "New Car - Onboard",
  "Relist Car",
  "Annual Inspections",
  "Insurance",
  "Car Registrations",
  "Car Swap",
  "Zero Parking Fee",
  "Invoice",
  "Bouncie",
  "Maintenance",
  "Exit Parking Ticket",
  "Last Minute Commissions",
] as const;

export type CommissionType = (typeof COMMISSION_TYPES)[number];
