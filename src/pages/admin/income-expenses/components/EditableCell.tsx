import React from "react";
import { useIncomeExpense } from "../context/IncomeExpenseContext";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: number;
  month: number;
  category: string;
  field: string;
  isEditable: boolean;
  isInteger?: boolean;
  isPercentage?: boolean;
}

// The only I&E categories whose fields are also tracked by expense form
// submissions. Every other category (parkingFeeLabor, officeSupport, etc.)
// cannot receive a "form amount", so we skip the lookup entirely. This keeps
// split %/history/etc. cells untouched by form-amount math.
const FORM_AWARE_CATEGORIES = new Set([
  "income",
  "directDelivery",
  "cogs",
  "reimbursedBills",
]);

export default function EditableCell({
  value,
  month,
  category,
  field,
  isEditable,
  isInteger = false,
  isPercentage = false,
}: EditableCellProps) {
  const { setEditingCell, editingCell, getFormAmount } = useIncomeExpense();

  const isCurrentlyEditing =
    editingCell?.category === category &&
    editingCell?.field === field &&
    editingCell?.month === month;

  // Form-amount contribution for this cell (0 when the category is not
  // form-aware, when the cell is rendered in non-currency mode, or when there
  // are no approved submissions). Percentages and integer cells (days/trips)
  // are never augmented with form amounts.
  const formAmount =
    !isPercentage && !isInteger && FORM_AWARE_CATEGORIES.has(category)
      ? getFormAmount(category, field, month)
      : 0;
  const displayedTotal = value + formAmount;
  const hasFormContribution = formAmount > 0;

  const handleClick = () => {
    if (!isEditable) return;
    // IMPORTANT: we pass the manual (DB) value here, not displayedTotal. The
    // modal edits the manual amount; the form amount is sourced separately
    // from approved submissions and cannot be edited from the I&E page.
    setEditingCell({ category, field, month, value });
  };

  const displayValue = isPercentage
    ? `${value.toFixed(0)}%`
    : isInteger
    ? value.toString()
    : `$${displayedTotal.toFixed(2)}`;

  if (!isEditable) {
    return (
      <span
        className={cn(
          "text-xs text-right block",
          displayedTotal === 0 && "text-gray-600",
          hasFormContribution && "text-primary"
        )}
        title={hasFormContribution ? `Includes $${formAmount.toFixed(2)} from approved form submissions` : undefined}
      >
        {displayValue}
      </span>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={cn(
        "cursor-pointer hover:bg-muted px-2 py-1 rounded block text-xs text-right transition-colors",
        displayedTotal === 0 && "text-gray-600",
        hasFormContribution && "text-primary font-medium",
        isCurrentlyEditing && "bg-muted ring-1 ring-[#D3BC8D]"
      )}
      title={
        hasFormContribution
          ? `Manual $${value.toFixed(2)} + Form $${formAmount.toFixed(2)} = Total $${displayedTotal.toFixed(2)}`
          : undefined
      }
    >
      {displayValue}
    </span>
  );
}
