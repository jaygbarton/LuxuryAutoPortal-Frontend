import type { Dispatch, SetStateAction } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface PaymentsPaginationFooterProps {
  total: number;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  totalPages: number;
  /** Rows actually requested (SHOW_ALL limit when showAll is on). */
  effectivePageSize: number;
  pageSize: number;
  setPageSize: (n: number) => void;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  showAllLimit: number;
  isLoading: boolean;
}

/** Pagination footer shared by the Client Payments and Co-Host Payments pages. */
export function PaymentsPaginationFooter({
  total,
  page,
  setPage,
  totalPages,
  effectivePageSize,
  pageSize,
  setPageSize,
  showAll,
  setShowAll,
  showAllLimit,
  isLoading,
}: PaymentsPaginationFooterProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-border bg-card">
      <div className="flex items-center gap-4">
        <div className="text-xs text-muted-foreground">
          {total > 0 ? (
            showAll ? (
              <>
                Showing all{" "}
                <span className="font-semibold text-foreground">{total}</span>{" "}
                payment{total === 1 ? "" : "s"}
                {total >= showAllLimit && (
                  <span className="text-yellow-600"> (capped at {showAllLimit} — narrow filters to see more)</span>
                )}
              </>
            ) : (
              <>
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {(page - 1) * effectivePageSize + 1}
                </span>
                {"–"}
                <span className="font-semibold text-foreground">
                  {Math.min(page * effectivePageSize, total)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-foreground">{total}</span>{" "}
                payment{total === 1 ? "" : "s"}
              </>
            )
          ) : (
            <>No payments to display</>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          Show all (current filters)
        </label>
      </div>
      {!showAll && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Rows</Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(parseInt(v, 10))}
            >
              <SelectTrigger className="bg-background border-border text-foreground w-[72px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {[10, 30, 50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-3 bg-background border-border text-foreground hover:bg-muted disabled:opacity-40"
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap px-2">
              Page <span className="font-semibold text-foreground">{page}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-3 bg-background border-border text-foreground hover:bg-muted disabled:opacity-40"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
