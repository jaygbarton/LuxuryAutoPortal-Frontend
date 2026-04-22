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

export default function EditableCell({
  value,
  month,
  category,
  field,
  isEditable,
  isInteger = false,
  isPercentage = false,
}: EditableCellProps) {
  const { setEditingCell, editingCell } = useIncomeExpense();

  const isCurrentlyEditing =
    editingCell?.category === category &&
    editingCell?.field === field &&
    editingCell?.month === month;

  const handleClick = () => {
    if (!isEditable) return;
    setEditingCell({ category, field, month, value });
  };

  const displayValue = isPercentage 
    ? `${value.toFixed(0)}%` 
    : isInteger 
    ? value.toString() 
    : `$${value.toFixed(2)}`;

  if (!isEditable) {
    return (
      <span className={cn("text-xs text-right block", value === 0 && "text-gray-600")}>
        {displayValue}
      </span>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={cn(
        "cursor-pointer hover:bg-muted px-2 py-1 rounded block text-xs text-right transition-colors",
        value === 0 && "text-gray-600",
        isCurrentlyEditing && "bg-muted ring-1 ring-[#D3BC8D]"
      )}
    >
      {displayValue}
    </span>
  );
}
