import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildApiUrl } from "@/lib/queryClient";
import { ChevronDown, XCircle } from "lucide-react";

interface GuestTrip {
  id: number;
  reservationId: string;
  guestName: string | null;
  phoneNumber: string | null;
  status: "booked" | "cancelled" | "ended" | "returned";
  tripStart: string | null;
  tripEnd: string | null;
  carName: string | null;
  pickupLocation: string | null;
  returnLocation: string | null;
  deliveryLocation: string | null;
}

const STATUS_OPTIONS = ["booked", "ended", "returned", "cancelled"] as const;

export default function GuestDatabasePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [sortBy, setSortBy] = useState<"tripStart" | "tripEnd">("tripStart");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: GuestTrip[];
    total: number;
  }>({
    queryKey: [
      "/api/marketing/guest-database",
      statusFilters,
      debouncedSearchQuery,
      currentPage,
      itemsPerPage,
      rangeFrom,
      rangeTo,
      sortBy,
      sortDir,
    ],
    queryFn: async () => {
      const offset = (currentPage - 1) * itemsPerPage;
      let url = buildApiUrl(
        `/api/marketing/guest-database?limit=${itemsPerPage}&offset=${offset}`,
      );
      if (statusFilters.length > 0) {
        url += `&status=${statusFilters.join(",")}`;
      }
      if (debouncedSearchQuery) {
        url += `&q=${encodeURIComponent(debouncedSearchQuery)}`;
      }
      if (rangeFrom || rangeTo) {
        if (rangeFrom) {
          url += `&startDate=${encodeURIComponent(rangeFrom)}&tripEndFrom=${encodeURIComponent(rangeFrom)}`;
        }
        if (rangeTo) {
          url += `&endDate=${encodeURIComponent(rangeTo)}&tripEndOn=${encodeURIComponent(rangeTo)}`;
        }
        url += `&startOrEnd=true`;
      }
      url += `&sortBy=${sortBy}&sortDir=${sortDir}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch guest database");
      return response.json();
    },
  });

  const guests = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / itemsPerPage);

  const MT_DATETIME_FMT = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const formatMt = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return MT_DATETIME_FMT.format(d);
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "booked":
        return <Badge className="bg-green-500">Booked</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "ended":
        return <Badge className="bg-blue-500">Ended</Badge>;
      case "returned":
        return <Badge className="bg-purple-500">Returned</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const toggleSort = (col: "tripStart" | "tripEnd") => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };
  const sortArrow = (col: "tripStart" | "tripEnd") =>
    sortBy === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const hasFilters =
    searchQuery || statusFilters.length > 0 || rangeFrom || rangeTo;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground leading-tight">
            Guest Database
          </h1>
          <p className="text-muted-foreground mt-1">
            Turo guest and reservation history — one row per trip
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Guests</CardTitle>
            <CardDescription>
              Search and filter Turo reservations by guest, phone, or status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="relative flex-1">
                <Input
                  placeholder="Search reservation ID, guest name, or phone…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 w-full"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-[180px] justify-between font-normal"
                  >
                    <span>
                      {statusFilters.length === 0
                        ? "All Status"
                        : statusFilters.length <= 2
                          ? statusFilters
                              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                              .join(" + ")
                          : `${statusFilters.length} selected`}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[180px]">
                  {STATUS_OPTIONS.map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={statusFilters.includes(status)}
                      onCheckedChange={(checked) => {
                        setStatusFilters((prev) =>
                          checked
                            ? [...prev, status]
                            : prev.filter((s) => s !== status),
                        );
                        setCurrentPage(1);
                      }}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {hasFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilters([]);
                    setRangeFrom("");
                    setRangeTo("");
                    setCurrentPage(1);
                  }}
                  className="whitespace-nowrap w-full sm:w-auto"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">
                  Trip Start/End From:
                </label>
                <Input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => {
                    setRangeFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-[145px]"
                  aria-label="Trip Start/End from"
                />
                <label className="text-sm font-medium whitespace-nowrap ml-2">
                  To:
                </label>
                <Input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => {
                    setRangeTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-[145px]"
                  aria-label="Trip Start/End to"
                />
              </div>
            </div>

            {debouncedSearchQuery && (
              <div className="mb-4 p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Found{" "}
                  <span className="font-semibold text-foreground">{total}</span>{" "}
                  result{total !== 1 ? "s" : ""} for{" "}
                  <span className="font-semibold text-foreground">
                    "{debouncedSearchQuery}"
                  </span>
                </p>
              </div>
            )}

            <div className="rounded-md border [&>div]:max-h-[calc(100vh-280px)] [&>div]:overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="sticky top-0 md:left-0 z-30 bg-muted whitespace-nowrap font-semibold">
                      Reservation ID
                    </TableHead>
                    <TableHead
                      className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold cursor-pointer select-none hover:bg-muted/70"
                      onClick={() => toggleSort("tripStart")}
                      title="Sort by trip start"
                    >
                      Trip Details{sortArrow("tripStart")}
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Trip Status
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Renter Name
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Phone Number
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : guests.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-12 text-muted-foreground"
                      >
                        No guests found
                        {hasFilters ? " matching the current filters" : ""}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    guests.map((guest) => (
                      <TableRow key={guest.id} className="hover:bg-muted/50">
                        <TableCell className="md:sticky md:left-0 md:z-10 bg-background font-mono text-sm">
                          {guest.reservationId}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">
                            {guest.carName || "—"}
                          </div>
                          <div className="text-muted-foreground">
                            {formatMt(guest.tripStart) || "—"}
                            {" → "}
                            {formatMt(guest.tripEnd) || "—"}
                          </div>
                          {(guest.pickupLocation || guest.returnLocation) && (
                            <div className="text-xs text-muted-foreground">
                              {guest.pickupLocation || "—"}
                              {" → "}
                              {guest.returnLocation ||
                                guest.deliveryLocation ||
                                "—"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(guest.status)}</TableCell>
                        <TableCell>{guest.guestName || "—"}</TableCell>
                        <TableCell>{guest.phoneNumber || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium">
                    {(currentPage - 1) * itemsPerPage + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, total)}
                  </span>{" "}
                  of <span className="font-medium">{total}</span> guests
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
