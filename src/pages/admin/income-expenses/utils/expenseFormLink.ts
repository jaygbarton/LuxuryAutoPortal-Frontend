/**
 * Builds the deep-link to the Income & Expense Receipt form on the central
 * Forms page (/admin/forms), pre-targeted at a specific category and field.
 *
 * This is how a newly-added I&E sub-category gets its "form link": the sub-
 * category already shows up in the expense form's field dropdown (the dropdown
 * is built from the same `car_subcategory_metadata` rows), so opening the form
 * with the category + field pre-selected lands the user straight on the right
 * sub-category. Submissions then file back into that sub-category's I&E cells
 * via the existing (category, field, carId, year, month) matching.
 *
 * The Forms page reads `section`, `category`, and `field` from the query string
 * (see forms.tsx) and forwards category/field into <ExpenseFormSubmission /> as
 * its initialCategory / initialField props.
 */

/** Forms-page section id that contains the Income & Expense Receipt form. */
export const EXPENSE_FORM_SECTION_ID = "employee-forms";

export type ExpenseFormCategory = "income" | "directDelivery" | "cogs" | "reimbursedBills";

/**
 * The expense form identifies dynamic sub-categories by a `db_<metadataId>`
 * field value (see getFormSubcategoryOptions on the backend). The I&E table
 * keys the same sub-category as `subcategory-<metadataId>`. This converts the
 * table key to the form field value so a link points at the right dropdown row.
 */
export function dynamicFieldValue(metadataId: number): string {
  return `db_${metadataId}`;
}

/** Absolute path (no origin) to the pre-filled expense form. */
export function buildExpenseFormPath(category: ExpenseFormCategory, field?: string): string {
  const params = new URLSearchParams({ section: EXPENSE_FORM_SECTION_ID, category });
  if (field) params.set("field", field);
  return `/admin/forms?${params.toString()}`;
}

/** Full shareable URL (with origin) to the pre-filled expense form. */
export function buildExpenseFormUrl(category: ExpenseFormCategory, field?: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${buildExpenseFormPath(category, field)}`;
}
