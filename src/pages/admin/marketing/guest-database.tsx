import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, XCircle } from "lucide-react";

type ContactStatus = "new" | "in_progress" | "contacted" | "dnc";

interface GuestTrip {
  id: number;
  reservationId: string;
  guestName: string | null;
  phoneNumber: string | null;
  status: "booked" | "cancelled" | "ended" | "returned";
  contactStatus: ContactStatus;
  tripStart: string | null;
  tripEnd: string | null;
  carName: string | null;
  pickupLocation: string | null;
  returnLocation: string | null;
  deliveryLocation: string | null;
}

const STATUS_OPTIONS = ["booked", "ended", "returned", "cancelled"] as const;

const CONTACT_STATUS_OPTIONS = [
  "new",
  "in_progress",
  "contacted",
  "dnc",
] as const;

const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  contacted: "Contacted",
  dnc: "DNC",
};

const CONTACT_STATUS_BADGE_CLASS: Record<ContactStatus, string> = {
  new: "bg-slate-500",
  in_progress: "bg-amber-500",
  contacted: "bg-green-600",
  dnc: "bg-red-600",
};

export default function GuestDatabasePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [contactStatusFilters, setContactStatusFilters] = useState<string[]>(
    [],
  );
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [sortBy, setSortBy] = useState<"tripStart" | "tripEnd">("tripStart");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      contactStatusFilters,
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
      if (contactStatusFilters.length > 0) {
        url += `&contactStatus=${contactStatusFilters.join(",")}`;
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

  const updateContactStatusMutation = useMutation({
    mutationFn: async ({
      id,
      contactStatus,
    }: {
      id: number;
      contactStatus: ContactStatus;
    }) => {
      const response = await fetch(
        buildApiUrl(`/api/marketing/guest-database/${id}/contact-status`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactStatus }),
        },
      );
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Failed to update contact status" }));
        throw new Error(error.message || "Failed to update contact status");
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueriesData(
        { queryKey: ["/api/marketing/guest-database"] },
        (
          old: { data?: GuestTrip[]; total?: number; success?: boolean } | undefined,
        ) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((g) =>
              g.id === variables.id
                ? { ...g, contactStatus: variables.contactStatus }
                : g,
            ),
          };
        },
      );
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hasFilters =
    searchQuery ||
    statusFilters.length > 0 ||
    contactStatusFilters.length > 0 ||
    rangeFrom ||
    rangeTo;

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-[180px] justify-between font-normal"
                  >
                    <span>
                      {contactStatusFilters.length === 0
                        ? "All Contact Status"
                        : contactStatusFilters.length <= 2
                          ? contactStatusFilters
                              .map(
                                (s) =>
                                  CONTACT_STATUS_LABELS[s as ContactStatus],
                              )
                              .join(" + ")
                          : `${contactStatusFilters.length} selected`}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[180px]">
                  {CONTACT_STATUS_OPTIONS.map((cs) => (
                    <DropdownMenuCheckboxItem
                      key={cs}
                      checked={contactStatusFilters.includes(cs)}
                      onCheckedChange={(checked) => {
                        setContactStatusFilters((prev) =>
                          checked
                            ? [...prev, cs]
                            : prev.filter((s) => s !== cs),
                        );
                        setCurrentPage(1);
                      }}
                    >
                      {CONTACT_STATUS_LABELS[cs]}
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
                    setContactStatusFilters([]);
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
                    <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap font-semibold">
                      Contact Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : guests.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
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
                        <TableCell>
                          <Select
                            value={guest.contactStatus || "new"}
                            onValueChange={(value) =>
                              updateContactStatusMutation.mutate({
                                id: guest.id,
                                contactStatus: value as ContactStatus,
                              })
                            }
                          >
                            <SelectTrigger className="w-[140px] h-8 border-none bg-transparent p-0 focus:ring-0">
                              <SelectValue asChild>
                                <Badge
                                  className={
                                    CONTACT_STATUS_BADGE_CLASS[
                                      guest.contactStatus || "new"
                                    ]
                                  }
                                >
                                  {
                                    CONTACT_STATUS_LABELS[
                                      guest.contactStatus || "new"
                                    ]
                                  }
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {CONTACT_STATUS_OPTIONS.map((cs) => (
                                <SelectItem key={cs} value={cs}>
                                  {CONTACT_STATUS_LABELS[cs]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
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
