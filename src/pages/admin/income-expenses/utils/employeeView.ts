/**
 * Employee-restricted view of the Income & Expenses table.
 *
 * Per the client spec ("EMPLOYEE USER ONLY — ADMIN ACCESS WILL SEE THE FULL
 * ACCESS"), a logged-in EMPLOYEE (non-admin) sees only three sections, each
 * trimmed to a fixed whitelist of rows. Admins (and admins impersonating an
 * employee? no — see useIsEmployeeView) see the full table unchanged.
 *
 * Used by IncomeExpenseTable's CategorySection (hide non-listed sections) and
 * CategoryRow (hide non-listed rows), plus the dynamic-subcategory filter.
 */
import { useQuery } from "@tanstack/react-query";
import { authMeQueryFn } from "@/lib/queryClient";

/** Strip everything but [a-z0-9] and lowercase, so "Labor - Delivery",
 *  "Labor Delivery" and "labor/delivery" all compare equal. Mirrors the
 *  normalization in standardCategoryNames.ts. */
export function normalizeLabel(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Section titles (CategorySection `title` prop) an employee may see. */
export const EMPLOYEE_ALLOWED_SECTION_TITLES = [
  "OPERATING EXPENSE (Direct Delivery)",
  "OPERATING EXPENSE (COGS - Per Vehicle)",
  "REIMBURSE AND NON-REIMBURSE BILLS",
];

/** Row labels an employee may see, across all allowed sections. Matching is by
 *  normalized label so spacing/punctuation differences still resolve. */
export const EMPLOYEE_ALLOWED_ROW_LABELS = [
  // OPERATING EXPENSE (Direct Delivery)
  "Labor - Delivery",
  "Parking - Airport",
  "Parking - Lot",
  "Uber/Lyft/Lime",
  // OPERATING EXPENSE (COGS - Per Vehicle)
  "Auto Body Shop / Wreck",
  "Alignment",
  "Battery",
  "Brakes",
  "Car Seats",
  "Emissions",
  "GPS System",
  "Keys & Fob",
  "Windshield",
  "Towing / Impound Fees",
  "Tires",
  "Oil/Lube",
  "Parts",
  "Ski Racks",
  "Tickets & Tolls",
  "Mechanic",
  "License & Registration",
  // REIMBURSE AND NON-REIMBURSE BILLS
  "Gas - Reimbursed",
  "Gas - Not Reimbursed",
  "Gas - Service Run",
  "Parking Airport",
  // These two render with a "(added)" suffix in the fixed reimbursed-bills rows
  // (see IncomeExpenseTable). Both the plain and "(added)" labels are allowed so
  // the whitelist matches regardless of which label the table uses.
  "Uber/Lyft/Lime - Not Reimbursed",
  "Uber/Lyft/Lime - Reimbursed",
  "Uber/Lyft/Lime - Not Reimbursed (added)",
  "Uber/Lyft/Lime - Reimbursed (added)",
];

const ALLOWED_SECTION_SET = new Set(
  EMPLOYEE_ALLOWED_SECTION_TITLES.map(normalizeLabel),
);
const ALLOWED_ROW_SET = new Set(
  EMPLOYEE_ALLOWED_ROW_LABELS.map(normalizeLabel),
);

export function isSectionAllowedForEmployee(title: string): boolean {
  return ALLOWED_SECTION_SET.has(normalizeLabel(title));
}

export function isRowAllowedForEmployee(label: string): boolean {
  return ALLOWED_ROW_SET.has(normalizeLabel(label));
}

interface AuthMe {
  user?: {
    isAdmin?: boolean;
    isEmployee?: boolean;
    impersonatorIsAdmin?: boolean;
  };
}

/**
 * True when the current user should see the restricted employee view: an
 * employee who is NOT an admin. Reads the same cached /api/auth/me populated by
 * AuthGuard/RequireRole, so it doesn't trigger an extra request. Returns false
 * while role data is still loading (so the full table never flashes a partially
 * filtered state — it renders full until we know the user is an employee, which
 * is the safe default since employees can't reach this page without the role).
 *
 * Admins impersonating an employee (impersonatorIsAdmin=true) bypass the filter
 * so they always see the full table regardless of the impersonated role.
 */
export function useIsEmployeeView(): boolean {
  const { data } = useQuery<AuthMe>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    retry: false,
    staleTime: 1000 * 30,
  });
  const user = data?.user;
  if (!user) return false;
  if (user.impersonatorIsAdmin) return false;
  return user.isAdmin !== true && user.isEmployee === true;
}
