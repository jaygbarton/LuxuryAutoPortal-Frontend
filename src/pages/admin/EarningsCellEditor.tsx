/**
 * Bridges the Earnings page to the same full cell editor used on the Income &
 * Expenses page. Staff (admin / co-host) clicking an Earnings value cell opens
 * the real editor modal (amount + form breakdown + remarks + receipt images +
 * upload), instead of the view-only image gallery. Clients never reach this —
 * the Earnings page keeps its read-only viewer for them.
 *
 * The I&E edit modals are driven by IncomeExpenseContext (they read
 * `editingCell` and call `updateCell`/`saveChanges`), so they must live INSIDE
 * an IncomeExpenseProvider. This component mounts that provider + every editor
 * modal, and hands the provider's `setEditingCell` back to the Earnings page via
 * `onReady` so a cell click can open the matching modal.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IncomeExpenseProvider, useIncomeExpense } from "./income-expenses/context/IncomeExpenseContext";
import type { EditingCell } from "./income-expenses/types";
import ModalEditIncomeExpense from "./income-expenses/modals/ModalEditIncomeExpense";
import ModalEditDirectDelivery from "./income-expenses/modals/ModalEditDirectDelivery";
import ModalEditCOGS from "./income-expenses/modals/ModalEditCOGS";
import ModalEditParkingFeeLabor from "./income-expenses/modals/ModalEditParkingFeeLabor";
import ModalEditReimbursedBills from "./income-expenses/modals/ModalEditReimbursedBills";
import ModalEditDynamicSubcategory from "./income-expenses/modals/ModalEditDynamicSubcategory";

export type OpenCellEditor = (cell: EditingCell) => void;

function Bridge({
  onReady,
  carId,
  year,
}: {
  onReady: (open: OpenCellEditor) => void;
  carId: number;
  year: string;
}) {
  const { setEditingCell, editingCell } = useIncomeExpense();
  const queryClient = useQueryClient();
  useEffect(() => {
    onReady((cell: EditingCell) => setEditingCell(cell));
  }, [onReady, setEditingCell]);

  // When the editor closes (editingCell set → null), refresh the Earnings page's
  // receipt-presence map so a newly-uploaded receipt's icon shows without a full
  // reload. (useImageUpload doesn't invalidate React Query itself.) The amount
  // refresh is already covered: saveChanges invalidates ["/api/income-expense",
  // carId, year], which is the same key the Earnings table reads.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (editingCell) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      queryClient.invalidateQueries({
        queryKey: ["/api/income-expense/images/summary", carId, year],
      });
    }
  }, [editingCell, queryClient, carId, year]);

  return (
    <>
      <ModalEditIncomeExpense />
      <ModalEditDirectDelivery />
      <ModalEditCOGS />
      <ModalEditParkingFeeLabor />
      <ModalEditReimbursedBills />
      <ModalEditDynamicSubcategory />
    </>
  );
}

export default function EarningsCellEditor({
  carId,
  year,
  onReady,
}: {
  carId: number;
  year: string;
  onReady: (open: OpenCellEditor) => void;
}) {
  return (
    // key forces a fresh provider (and re-fetch) when the car or year changes,
    // matching how the I&E page mounts it — avoids stale cross-car/year state.
    <IncomeExpenseProvider key={`${carId}-${year}`} carId={carId} year={year}>
      <Bridge onReady={onReady} carId={carId} year={year} />
    </IncomeExpenseProvider>
  );
}
