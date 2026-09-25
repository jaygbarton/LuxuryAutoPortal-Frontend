import { useEffect, useState } from "react";
import type { CarActivityFilter } from "./PaymentFilterBar";

/** Backend cap for one /api/payments/search page ("Show all"). */
export const SHOW_ALL_LIMIT = 2000;

/**
 * Filter, sort and pagination state shared by the Client Payments and Co-Host
 * Payments pages. `filterBarProps` spreads into <PaymentFilterBar>,
 * `paginationProps` into <PaymentsPaginationFooter>, and `searchBody` into the
 * /api/payments/search request.
 */
export function usePaymentListState() {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [startMonth, setStartMonth] = useState<string>("");
  const [endMonth, setEndMonth] = useState<string>("");
  const [carFilter, setCarFilter] = useState<string>("");
  const [carActivityFilter, setCarActivityFilter] = useState<CarActivityFilter>("active");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const [showAll, setShowAll] = useState(false);
  const effectivePageSize = showAll ? SHOW_ALL_LIMIT : pageSize;

  const hasFilters =
    !!filterStatus ||
    !!startMonth ||
    !!endMonth ||
    !!carFilter ||
    carActivityFilter !== "active";

  const clearFilters = () => {
    setFilterStatus("");
    setStartMonth("");
    setEndMonth("");
    setCarFilter("");
    setCarActivityFilter("active");
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [filterStatus, startMonth, endMonth, carFilter, carActivityFilter, pageSize, showAll]);

  return {
    sortOrder,
    setSortOrder,
    page,
    setPage,
    effectivePageSize,
    /** Stable pieces for a TanStack queryKey. */
    queryKeyParts: [filterStatus, startMonth, endMonth, carFilter, carActivityFilter, page, effectivePageSize, sortOrder] as const,
    searchBody: {
      status: filterStatus || undefined,
      startDate: startMonth || undefined,
      endDate: endMonth || undefined,
      carId: carFilter || undefined,
      carActiveStatus: carActivityFilter,
      page,
      limit: effectivePageSize,
      sortOrder,
    },
    filterBarProps: {
      filterStatus,
      onFilterStatusChange: setFilterStatus,
      startMonth,
      onStartMonthChange: setStartMonth,
      endMonth,
      onEndMonthChange: setEndMonth,
      carActivityFilter,
      onCarActivityFilterChange: setCarActivityFilter,
      carFilter,
      onCarFilterChange: setCarFilter,
      hasFilters,
      onClear: clearFilters,
    },
    paginationProps: {
      page,
      setPage,
      effectivePageSize,
      pageSize,
      setPageSize,
      showAll,
      setShowAll,
      showAllLimit: SHOW_ALL_LIMIT,
    },
  };
}
