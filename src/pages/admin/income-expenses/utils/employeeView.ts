/**
 * Employee view of the Income & Expenses table.
 *
 * NOTE (per Cathy, 2026-07): employees now see ALL categories/rows, same as the
 * full table — the earlier "employee sees only 3 sections" restriction was
 * removed. `isSectionAllowedForEmployee` / `isRowAllowedForEmployee` therefore
 * always return true (kept as no-op hooks so callers don't have to change and
 * so the restriction can be re-narrowed later by editing the whitelist sets).
 * `useIsEmployeeView` is still used to keep the table read-only for employees.
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

// Employees now see every section/row (restriction removed per Cathy). The
// whitelist sets above are retained only so the old behavior can be restored by
// switching these back to the membership checks.
void ALLOWED_SECTION_SET;
void ALLOWED_ROW_SET;

export function isSectionAllowedForEmployee(_title: string): boolean {
  return true;
}

export function isRowAllowedForEmployee(_label: string): boolean {
  return true;
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
