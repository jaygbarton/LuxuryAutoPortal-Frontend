/**
 * REIMBURSE AND NON-REIMBURSE BILLS is split into two sub-headings (Cathy,
 * 2026-11-26): "GLA Expenses" (every standard row and most added rows) and
 * "Co-Host Expenses". An added row goes under Co-Host Expenses when its name
 * says Co-Host, e.g. "Expenses Co-Host: Violation Ticket Not Reimbursed".
 */
export const GLA_EXPENSES_HEADING = "GLA Expenses";
export const CO_HOST_EXPENSES_HEADING = "Co-Host Expenses";

export function isCoHostExpenseName(name: string | null | undefined): boolean {
  return /\bco[\s-]?host\b/i.test(name ?? "");
}
