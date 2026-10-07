import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ItemsPerPage = 5 | 10 | 20 | 50;

interface TablePaginationProps {
  totalItems: number;
  itemsPerPage: ItemsPerPage;
  currentPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (limit: ItemsPerPage) => void;
  isLoading?: boolean;
}

export function TablePagination({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onItemsPerPageChange,
  isLoading = false,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // Show up to 7 page numbers

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the start
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push("ellipsis");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  const handlePageChange = (page: number) => {
    // Validate page number
    const validPage = Math.max(1, Math.min(page, totalPages));
    if (validPage >= 1 && validPage <= totalPages && validPage !== currentPage && !isLoading) {
      onPageChange(validPage);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-3 bg-card border-t border-border sm:px-6 sm:py-4">
      {/* Left: Rows per page + Info */}
      <div className="flex items-center gap-4">
        {/* One page-size control keeps the record list footer compact. */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground sm:text-sm">Rows<span className="hidden sm:inline"> per page</span></span>
          <Select value={String(itemsPerPage)} disabled={isLoading} onValueChange={(value) => onItemsPerPageChange(Number(value) as ItemsPerPage)}>
            <SelectTrigger className="w-[72px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
            <SelectContent>
              {([5, 10, 20, 50] as ItemsPerPage[]).map((limit) => (
                <SelectItem key={limit} value={String(limit)}>{limit}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Info text */}
        <span className="hidden text-sm text-muted-foreground sm:inline">
          Showing <span className="text-foreground font-medium">{startItem}</span> to{" "}
          <span className="text-foreground font-medium">{endItem}</span> of{" "}
          <span className="text-foreground font-medium">{totalItems}</span>
        </span>
      </div>

      {/* Right: Page navigation */}
      <div className="flex items-center gap-2">
        {/* Mobile: Only show Prev/Next + current page */}
        <div className="flex items-center gap-1 sm:hidden">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "text-foreground hover:bg-[#D3BC8D]/20 hover:text-[#8B6914]"
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-10 text-center text-xs font-medium text-foreground">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "text-foreground hover:bg-[#D3BC8D]/20 hover:text-[#8B6914]"
            )}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop: Full pagination */}
        <div className="hidden sm:flex items-center gap-1">
          {/* First page */}
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || isLoading}
            className={cn(
              "p-2 rounded transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "text-foreground hover:bg-[#D3BC8D]/20 hover:text-[#8B6914]"
            )}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>

          {/* Previous page */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            className={cn(
              "p-2 rounded transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "text-foreground hover:bg-[#D3BC8D]/20 hover:text-[#8B6914]"
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Page numbers */}
          {pageNumbers.map((page, index) => {
            if (page === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-muted-foreground"
                >
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                disabled={isLoading}
                className={cn(
                  "min-w-[2.5rem] px-3 py-1.5 text-sm font-medium rounded transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  currentPage === pageNum
                    ? "bg-[#D3BC8D] text-[#1a1a1a] font-bold shadow-md"
                    : "bg-card text-foreground border border-border hover:bg-[#D3BC8D]/20 hover:border-[#D3BC8D]/50 hover:text-[#8B6914] font-medium"
                )}
                aria-label={`Page ${pageNum}`}
                aria-current={currentPage === pageNum ? "page" : undefined}
              >
                {pageNum}
              </button>
            );
          })}

          {/* Next page */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            className={cn(
              "p-2 rounded transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "text-foreground hover:bg-[#D3BC8D]/20 hover:text-[#8B6914]"
            )}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Last page */}
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages || isLoading}
            className={cn(
              "p-2 rounded transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "text-foreground hover:bg-[#D3BC8D]/20 hover:text-[#8B6914]"
            )}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <span className="w-full text-center text-xs text-muted-foreground sm:hidden" aria-live="polite">
        {startItem}–{endItem} of {totalItems} records
      </span>
    </div>
  );
}

