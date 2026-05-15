/**
 * Helpers for detecting whether a custom (dynamic) subcategory name collides
 * with one of the fixed/standard rows that the Income & Expenses table
 * already renders in each of its four "add-subcategory" sections.
 *
 * Used to:
 *   1. Validate new subcategory names in the "Add Subcategory" modal so
 *      users can't accidentally recreate a row that already exists.
 *   2. Power the "Clean Up Duplicates" button next to each section's
 *      Add Subcategory button — it finds every dynamic subcategory whose
 *      normalized name matches a standard row and deletes them.
 *
 * Comparison is case-insensitive and ignores all non-alphanumeric characters,
 * so "Labor - Cleaning", "Labor Cleaning", "labor-cleaning", "Labor/Cleaning"
 * all normalize to the same string and are considered the same name.
 */

/** Strip everything but [a-z0-9] and lowercase. */
export function normalizeName(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The human-readable labels rendered by the fixed CategoryRow components in
 * each of the four "add-subcategory" sections. Kept in sync with the
 * `fieldNames` maps in the matching ModalEdit*.tsx files.
 */
export const STANDARD_CATEGORY_NAMES: Record<string, string[]> = {
  directDelivery: [
    "Labor - Cleaning",
    "Labor - Delivery",
    "Parking - Airport",
    "Parking - Lot",
    "Uber/Lyft/Lime",
  ],
  cogs: [
    "Auto Body Shop / Wreck",
    "Alignment",
    "Battery",
    "Brakes",
    "Car Payment",
    "Car Insurance",
    "Car Seats",
    "Cleaning Supplies / Tools",
    "Emissions",
    "GPS System",
    "Keys & Fob",
    "Labor - Detailing",
    "License & Registration",
    "Mechanic",
    "Oil/Lube",
    "Parts",
    "Ski Racks",
    "Tickets & Tolls",
    "Tired Air Station",
    "Tires",
    "Towing / Impound Fees",
    "Uber/Lyft/Lime",
    "Windshield",
    "Wipers",
  ],
  parkingFeeLabor: ["GLA Parking Fee", "Labor - Cleaning"],
  reimbursedBills: [
    "Electric - Reimbursed",
    "Electric - Not Reimbursed",
    "Gas - Reimbursed",
    "Gas - Not Reimbursed",
    "Gas - Service Run",
    "Parking Airport",
    "Uber/Lyft/Lime - Not Reimbursed",
    "Uber/Lyft/Lime - Reimbursed",
  ],
};

/**
 * Return the canonical standard label if `name` (normalized) matches one of
 * the fixed rows in `categoryType`. Returns null otherwise.
 */
export function findStandardCategoryMatch(
  categoryType: string,
  name: string,
): string | null {
  const list = STANDARD_CATEGORY_NAMES[categoryType] || [];
  const target = normalizeName(name);
  if (!target) return null;
  return list.find((std) => normalizeName(std) === target) || null;
}
