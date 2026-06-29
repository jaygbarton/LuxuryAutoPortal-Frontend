import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { DashboardRecordCard } from "@/components/admin/dashboard";
import { CarPhotoCell } from "@/components/admin/dashboard/CarPhotoCell";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePersistentPageSize } from "@/hooks/use-persistent-page-size";
import { StatusBadge } from "./StatusBadge";
import { InspectionModal } from "./InspectionModal";
import { CarIssueTypesCell } from "./CarIssueTypesCell";
import { FuelReturnedCell } from "./FuelReturnedCell";
import { GasLevelCells } from "./GasLevelCells";
import { useToast } from "@/hooks/use-toast";
import {
  Edit,
  Trash2,
  Wrench,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  History,
  Plus,
  RotateCcw,
} from "lucide-react";
import type { Inspection, TuroTrip } from "./types";
import { TaskAssignmentModal } from "./TaskAssignmentModal";
import { EmployeeSelectCombobox } from "./EmployeeSelectCombobox";

// Status dropdown values that filter the joined Turo *trip* status (client-side)
// rather than the inspection status (server-side). Booked / Ended / Returned.
const TRIP_STATUSES = new Set(["booked", "ended", "returned"]);

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        weekday: "short",
        month: "short",
        day: "numeric",
      }) +
      ", " +
      d.toLocaleTimeString("en-US", {
        timeZone: "America/Denver",
        hour: "numeric",
        minute: "2-digit",
      })
    );
  } catch {
    return dateStr;
  }
};

const formatCurrency = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
};

const calculateDaysRented = (
  tripStart: string | null,
  tripEnd: string | null,
): number | null => {
  if (!tripStart || !tripEnd) return null;
  try {
    const start = new Date(tripStart).getTime();
    const end = new Date(tripEnd).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const hours = (end - start) / (1000 * 60 * 60);
    return Math.max(1, Math.ceil(hours / 24));
  } catch {
    return null;
  }
};

export function TuroInspectionTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<Record<string, any>>({});
  // Single date RANGE filter (mirrors the Trips Overview tab): show inspections
  // whose trip's Trip Start OR Trip End falls within [rangeFrom, rangeTo]. A
  // single day = set both to the same date. Leave both blank to disable.
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(
    "operations.turoMessages",
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(
    null,
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingInspection, setDeletingInspection] =
    useState<Inspection | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyInspection, setHistoryInspection] = useState<Inspection | null>(
    null,
  );

  // ── Inline edit state for Miles Included / Trip Start Odometer /
  // Trip Ends Odometer. Mirrors the same affordance on the Trips Overview
  // tab and on /admin/turo-trips — admins can edit the value in whichever
  // tab they happen to have open. Keyed by trip.id (NOT inspection id)
  // because the backend PATCH endpoints address the underlying trip.
  const [odoEdits, setOdoEdits] = useState<
    Record<number, { start?: string; end?: string }>
  >({});
  const [milesEdits, setMilesEdits] = useState<Record<number, string>>({});
  const [savingOdoRow, setSavingOdoRow] = useState<number | null>(null);
  const [savingMilesRow, setSavingMilesRow] = useState<number | null>(null);

  // ── Inline CAR Name / VIN # editing for vehicle-swap trips. On a swap the
  // reservation # is reused but the car changes, so the auto-filled name/VIN is
  // wrong and must be corrected by hand — same affordance as the Trips Overview
  // tab. CAR Name is keyed by INSPECTION id (the cell shows insp.car_name, and a
  // manual inspection may have no trip); VIN is keyed by trip id (it lives on
  // the trip). undefined = no pending edit; '' = cleared.
  const [carNameEdits, setCarNameEdits] = useState<Record<number, string>>({});
  const [vinEdits, setVinEdits] = useState<Record<number, string>>({});
  const [savingCarName, setSavingCarName] = useState<number | null>(null);
  const [savingVin, setSavingVin] = useState<number | null>(null);

  // Save a corrected CAR Name. Writes to BOTH the inspection (so this tab's cell
  // updates — it renders insp.car_name) and, when the inspection is linked to a
  // trip, the trip's car_name (so Trips Overview and every trip-derived view
  // agree). For a manual inspection with no trip, only the inspection is updated.
  const saveCarName = async (insp: Inspection) => {
    const edited = carNameEdits[insp.id];
    if (edited === undefined) return;
    const trimmed = edited.trim();
    if (trimmed === (insp.car_name ?? "").trim()) {
      setCarNameEdits((prev) => {
        const next = { ...prev };
        delete next[insp.id];
        return next;
      });
      return;
    }
    setSavingCarName(insp.id);
    try {
      const requests: Promise<Response>[] = [
        fetch(buildApiUrl(`/api/operations/inspections/${insp.id}`), {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ car_name: trimmed === "" ? null : trimmed }),
        }),
      ];
      if (insp.turo_trip_id != null) {
        requests.push(
          fetch(buildApiUrl(`/api/turo-trips/${insp.turo_trip_id}/car-info`), {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ carName: trimmed === "" ? null : trimmed }),
          }),
        );
      }
      const results = await Promise.all(requests);
      if (results.some((r) => !r.ok)) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setCarNameEdits((prev) => {
        const next = { ...prev };
        delete next[insp.id];
        return next;
      });
      toast({ title: "CAR Name saved", description: `Reservation #${insp.reservation_id ?? ""}` });
    } catch {
      toast({ title: "Failed to save CAR Name", variant: "destructive" });
    } finally {
      setSavingCarName(null);
    }
  };

  // Save a corrected VIN #. VIN lives on the trip, so this requires a linked
  // trip; the cell is read-only ("--") for trip-less manual inspections.
  const saveVin = async (insp: Inspection) => {
    const tripId = insp.turo_trip_id;
    if (tripId == null) return;
    const edited = vinEdits[tripId];
    if (edited === undefined) return;
    const trimmed = edited.trim();
    setSavingVin(tripId);
    try {
      const res = await fetch(buildApiUrl(`/api/turo-trips/${tripId}/car-info`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vinNumber: trimmed === "" ? null : trimmed }),
      });
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setVinEdits((prev) => {
        const next = { ...prev };
        delete next[tripId];
        return next;
      });
      toast({ title: "VIN # saved", description: `Reservation #${insp.reservation_id ?? ""}` });
    } catch {
      toast({ title: "Failed to save VIN #", variant: "destructive" });
    } finally {
      setSavingVin(null);
    }
  };

  const saveRowOdometers = async (trip: TuroTrip) => {
    const edit = odoEdits[trip.id];
    if (!edit) return;
    const startVal =
      edit.start !== undefined
        ? edit.start
        : String(trip.tripStartOdometer ?? "");
    const endVal =
      edit.end !== undefined ? edit.end : String(trip.tripEndOdometer ?? "");
    setSavingOdoRow(trip.id);
    try {
      const res = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/odometers`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripStartOdometer: startVal !== "" ? parseInt(startVal, 10) : null,
            tripEndOdometer: endVal !== "" ? parseInt(endVal, 10) : null,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setOdoEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({
        title: "Odometer saved",
        description: `Reservation #${trip.reservationId}`,
      });
    } catch {
      toast({ title: "Failed to save odometer", variant: "destructive" });
    } finally {
      setSavingOdoRow(null);
    }
  };

  // In-flight gas-level saves, keyed by tripId. GasLevelCells auto-saves on
  // dropdown change; it registers that save promise here so flushRowEdits can
  // await it before a tab-move. Without this, a fast move click races the gas
  // PATCH and the trip leaves with a blank gas level on the destination tab.
  const gasInFlight = useRef<Map<number, Promise<void>>>(new Map());
  const registerGasPending = (tripId: number, promise: Promise<void>) => {
    gasInFlight.current.set(tripId, promise);
    // Clear once settled so the map doesn't grow unbounded.
    promise.finally(() => {
      if (gasInFlight.current.get(tripId) === promise) {
        gasInFlight.current.delete(tripId);
      }
    });
  };

  // Flush any unsaved / in-flight inline edits for a row BEFORE a tab-move
  // (Maintenance / No Car Issues / Car Inspections) fires. The odometer & miles
  // fields are manual-Save inputs held in local state, and gas auto-saves async;
  // a fast click on a move button would otherwise let the row leave this tab
  // before those values reach the server, so they'd show blank on the
  // destination until the next refresh. Awaiting all of them guarantees the
  // data is persisted first. Returns once every pending write has settled.
  const flushRowEdits = async (tripId: number | null | undefined) => {
    if (tripId == null) return;
    const trip = tripsById.get(tripId);
    if (!trip) return;
    const pending: Promise<void>[] = [];
    if (odoEdits[tripId] !== undefined) pending.push(saveRowOdometers(trip));
    if (milesEdits[tripId] !== undefined) pending.push(saveRowMiles(trip));
    const gas = gasInFlight.current.get(tripId);
    if (gas) pending.push(gas);
    if (pending.length) await Promise.all(pending);
  };

  const saveRowMiles = async (trip: TuroTrip) => {
    const edited = milesEdits[trip.id];
    if (edited === undefined) return;
    setSavingMilesRow(trip.id);
    try {
      // /locations endpoint also writes milesIncluded — reuse it rather than
      // building a new endpoint. Send the existing pickup/return values so
      // they aren't wiped.
      const res = await fetch(
        buildApiUrl(`/api/turo-trips/${trip.id}/locations`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupLocation: trip.pickupLocation ?? "",
            returnLocation: trip.returnLocation ?? "",
            milesIncluded: edited.trim(),
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      setMilesEdits((prev) => {
        const next = { ...prev };
        delete next[trip.id];
        return next;
      });
      toast({
        title: "Miles included saved",
        description: `Reservation #${trip.reservationId}`,
      });
    } catch {
      toast({
        title: "Failed to save miles included",
        variant: "destructive",
      });
    } finally {
      setSavingMilesRow(null);
    }
  };

  // Auto-sync ended Turo trips into inspection stubs on first load
  useEffect(() => {
    fetch(buildApiUrl("/api/operations/inspections/auto-sync-ended-trips"), {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.json())
      .then((body) => {
        if (body?.created > 0) {
          queryClient.invalidateQueries({
            queryKey: ["/api/operations/inspections"],
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useQuery<{ data: Inspection[]; total: number }>({
    queryKey: ["/api/operations/inspections", "turo_return", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ source: "turo_return", limit: "2000" });
      // New / In Progress / Completed filter the *inspection* status server-side.
      // Booked / Ended / Returned are *trip* statuses on the joined trip and are
      // applied client-side below, so here they behave like "all".
      if (filterStatus !== "all" && !TRIP_STATUSES.has(filterStatus)) {
        params.append("status", filterStatus);
      } else {
        // no_issues rows have been resolved — they live in No Car Issues tab
        params.append("excludeStatus", "no_issues");
      }
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections?${params}`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch inspections");
      return response.json();
    },
  });

  const { data: maintenanceData } = useQuery<{ data: { inspection_id: number | null }[] }>({
    queryKey: ["/api/operations/maintenance", "all"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/operations/maintenance?limit=500"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch maintenance");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });
  const maintenanceInspectionIds = new Set(
    (maintenanceData?.data ?? []).map(m => m.inspection_id).filter((id): id is number => id != null)
  );

  // Fetch trips that overlap the active date filter window so the client-side
  // join is accurate. When no date filter is set, fetch a large page to cover
  // the full fleet. Keyed on the date filters so a filter change refreshes it.
  const { data: tripsData } = useQuery<{ data: TuroTrip[] }>({
    queryKey: ["/api/turo-trips", "turo-messages-join", rangeFrom, rangeTo],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "2000" });
      // ONE date RANGE → fetch trips whose Trip Start OR Trip End falls in
      // [rangeFrom, rangeTo]. The range is applied to BOTH trip_start
      // (startDate/endDate) and trip_end (tripEndFrom/tripEndOn), then OR-ed via
      // startOrEnd (matches the client filter below and the Trips Overview tab).
      // A single day = rangeFrom == rangeTo.
      if (rangeFrom || rangeTo) {
        if (rangeFrom) { params.set("startDate", rangeFrom); params.set("tripEndFrom", rangeFrom); }
        if (rangeTo) { params.set("endDate", rangeTo); params.set("tripEndOn", rangeTo); }
        params.set("startOrEnd", "true");
      }
      const res = await fetch(buildApiUrl(`/api/turo-trips?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
  });
  const tripsById = new Map((tripsData?.data || []).map((t) => [t.id, t]));

  const inspections = data?.data || [];

  // Convert a UTC ISO string to a YYYY-MM-DD date in Mountain Time so date
  // comparisons match what the admin sees in the Trip Start / Trip Ends columns.
  const toMtDate = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(iso));
    } catch { return null; }
  };

  const filteredInspections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inspections.filter((insp) => {
      // Rows moved to Maintenance or No Car Issues belong in those tabs
      if (maintenanceInspectionIds.has(insp.id)) return false;
      if (insp.status === "no_issues") return false;

      const trip = insp.turo_trip_id != null ? tripsById.get(insp.turo_trip_id) : undefined;

      // Default ("all") shows only ended trips. Explicit filter overrides.
      const tripStatus = (trip?.status ?? "").toLowerCase();
      if (filterStatus === "all") {
        if (tripStatus !== "ended") return false;
      } else if (TRIP_STATUSES.has(filterStatus)) {
        if (tripStatus !== filterStatus) return false;
      }

      if (q) {
        const hay = [
          insp.car_name, insp.reservation_id, insp.assigned_to, insp.status,
          insp.source, insp.notes, insp.inspection_date, insp.due_date,
          insp.car_issue_types?.join(" "),
          // Joined-trip reservation # is shown when insp.reservation_id is null,
          // so it must be searchable too (insp.reservation_id alone misses it).
          trip?.reservationId,
          trip?.plateNumber, trip?.pickupLocation, trip?.deliveryLocation,
          trip?.returnLocation, trip?.extras, trip?.milesIncluded,
          trip?.totalDistance, trip?.status, trip?.tripStart, trip?.tripEnd,
          trip?.earnings != null ? String(trip.earnings) : null,
          trip?.tripStartOdometer != null ? String(trip.tripStartOdometer) : null,
          trip?.tripEndOdometer != null ? String(trip.tripEndOdometer) : null,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // Date filters compare YYYY-MM-DD strings in Mountain Time so they match
      // the displayed Trip Start / Trip Ends values exactly. Filter ONLY on the
      // joined trip's dates — the same values the Trip Start / Trip Ends columns
      // render — never on insp.inspection_date. The inspection date can land on
      // a different calendar day than the trip (it's when the return was logged,
      // not the trip window), so falling back to it made a row match a date
      // filter while displaying a different Trip Start/Ends than Trips Overview
      // shows for that same filter. A row with no joined trip simply can't
      // satisfy a trip-date filter, which mirrors the trip-only Trips Overview.
      // ONE date RANGE: show trips whose Trip Start OR Trip End falls within
      // [rangeFrom, rangeTo]. A single day = rangeFrom == rangeTo.
      if (!q && (rangeFrom || rangeTo)) {
        const startDate = toMtDate(trip?.tripStart);
        const endDate = toMtDate(trip?.tripEnd);
        const inRange = (day: string | null) =>
          day != null && (!rangeFrom || day >= rangeFrom) && (!rangeTo || day <= rangeTo);
        if (!inRange(startDate) && !inRange(endDate)) return false;
      }

      return true;
    });
  }, [inspections, maintenanceInspectionIds, tripsById, search, rangeFrom, rangeTo, filterStatus]);

  useEffect(() => {
    setPage(1);
  }, [search, rangeFrom, rangeTo, filterStatus, pageSize]);

  const pagedInspections = useMemo(
    () => filteredInspections.slice((page - 1) * pageSize, page * pageSize),
    [filteredInspections, page, pageSize],
  );

  const hasActiveFilters =
    filterStatus !== "all" ||
    search !== "" ||
    rangeFrom !== "" ||
    rangeTo !== "";

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      toast({ title: "Success", description: "Inspection status updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Inline edit for the joined Turo *trip* status (Booked/Ended/Returned/
  // Cancelled) — lets staff mark a vehicle Returned after it comes back.
  const tripStatusUpdateMutation = useMutation({
    mutationFn: async ({ tripId, status }: { tripId: number; status: string }) => {
      const response = await fetch(
        buildApiUrl(`/api/turo-trips/${tripId}/status`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) throw new Error("Failed to update trip status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      toast({ title: "Success", description: "Trip status updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Inline assignee edit for the Turo Messages stage. Independent from the
  // Car Issues and Maintenance stage assignments.
  const assigneeUpdateMutation = useMutation({
    mutationFn: async ({
      id,
      assigned_to,
      assigned_to_id,
    }: {
      id: number;
      assigned_to: string | null;
      assigned_to_id: number | null;
    }) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ assigned_to, assigned_to_id }),
        },
      );
      if (!response.ok) throw new Error("Failed to update assignee");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      toast({ title: "Assigned employee updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveToInspectionsMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ source: "manual" }),
        },
      );
      if (!response.ok) {
        // Surface the real server reason — the move path itself is sound, so a
        // failure here is transient (DB connection drop) or auth. Show what the
        // server actually said instead of a generic string so it's diagnosable.
        let detail = `${response.status} ${response.statusText}`;
        try {
          const body = await response.json();
          if (body?.message || body?.error) detail = body.message || body.error;
        } catch {
          /* non-JSON response (e.g. HTML error page) — keep the status line */
        }
        throw new Error(`Failed to move to Car Inspections: ${detail}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      toast({ title: "Success", description: "Moved to Car Inspections" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveToMaintenanceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}/move-to-maintenance`),
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Failed to move to maintenance");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/maintenance"],
      });
      toast({ title: "Success", description: "Moved to Maintenance" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveToNoIssuesMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: "no_issues" }),
        },
      );
      if (!response.ok) throw new Error("Failed to move to No Car Issues");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      toast({ title: "Success", description: "Moved to No Car Issues" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}`),
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      toast({ title: "Success", description: "Inspection deleted" });
      setDeleteModalOpen(false);
      setDeletingInspection(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ── Deleted / Restore ──────────────────────────────────────────────────────
  // Deleting a Turo Message is a soft-delete (dismissed_at). This dialog lists
  // those hidden records (scoped to turo_return) so the user can bring one back.
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const { data: dismissedData, isLoading: dismissedLoading } = useQuery<{
    data: Inspection[];
  }>({
    queryKey: ["/api/operations/inspections/dismissed", "turo_return"],
    queryFn: async () => {
      const response = await fetch(
        buildApiUrl("/api/operations/inspections/dismissed?source=turo_return"),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch deleted records");
      return response.json();
    },
    enabled: restoreModalOpen,
  });
  const dismissedInspections = dismissedData?.data || [];

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        buildApiUrl(`/api/operations/inspections/${id}/restore`),
        { method: "POST", credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to restore");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/operations/inspections/dismissed"],
      });
      toast({ title: "Restored", description: "Trip is back in Turo Messages" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <SectionHeader
          title="Turo Messages"
          subtitle="Completed trips auto-appear here for post-return inspection"
          variant="plain"
          className="mb-0"
        />
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => setRestoreModalOpen(true)}
            className="border-border text-foreground hover:bg-card"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Deleted
          </Button>
          <Button
            onClick={() => { setTaskPrefill({}); setTaskModalOpen(true); }}
            className="bg-primary text-primary-foreground hover:bg-primary/80"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end gap-3 mb-4">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px]">
              <label className="text-muted-foreground text-xs">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Car, reservation, location, assignee..."
                className="bg-card border-border text-foreground h-9 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-card border-border text-foreground w-full lg:w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Trip Start/End From</label>
              <Input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                title="Show inspections whose Trip Start OR Trip End is on/after this day"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">To</label>
              <Input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                title="Show inspections whose Trip Start OR Trip End is on/before this day"
                className="bg-card border-border text-foreground h-9 w-full lg:w-[150px]"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilterStatus("all");
                  setSearch("");
                  setRangeFrom("");
                  setRangeTo("");
                }}
                className="text-red-700 hover:text-red-700 hover:bg-red-900/20 h-9 sm:col-span-2 lg:col-span-1 w-full lg:w-auto"
              >
                Clear Filters
              </Button>
            )}
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            {filteredInspections.length !== (data?.total ?? filteredInspections.length)
              ? `Showing ${filteredInspections.length} of ${data?.total ?? inspections.length}`
              : `Total: ${data?.total ?? filteredInspections.length}`}
          </div>

          <div className="flex flex-col gap-3">
                {isLoading ? (
                  <p className="text-center py-12 text-muted-foreground">Loading inspections...</p>
                ) : filteredInspections.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground">No Turo return inspections found</p>
                ) : (
                  pagedInspections.map((insp) => {
                    const trip =
                      insp.turo_trip_id != null
                        ? tripsById.get(insp.turo_trip_id)
                        : undefined;
                    const pickupLocation = trip?.pickupLocation || trip?.deliveryLocation || null;
                    const dropOffLocation = trip?.returnLocation ?? trip?.deliveryLocation ?? null;
                    const daysRented = trip ? calculateDaysRented(trip.tripStart, trip.tripEnd) : null;
                    const earnings = trip
                      ? (trip.status?.toLowerCase() === "cancelled"
                          ? trip.cancelledEarnings
                          : trip.earnings)
                      : null;

                    const carNameEl = (() => {
                      const editing = carNameEdits[insp.id] !== undefined;
                      const current = insp.car_name ?? "";
                      const value = editing ? carNameEdits[insp.id] : current;
                      return (
                        <div className="flex items-center gap-1">
                          <Input value={value} placeholder="Car name"
                            title="Enter the car name exactly as it appears on the Turo listing"
                            className="h-7 w-[160px] text-sm"
                            onChange={(e) => setCarNameEdits((prev) => ({ ...prev, [insp.id]: e.target.value }))}
                            onBlur={() => { if (carNameEdits[insp.id] === undefined) return; saveCarName(insp); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") setCarNameEdits((prev) => { const next = { ...prev }; delete next[insp.id]; return next; });
                            }} />
                          {savingCarName === insp.id && <span className="text-xs text-muted-foreground">…</span>}
                        </div>
                      );
                    })();

                    const vinEl = insp.turo_trip_id == null ? "--" : (() => {
                      const tripId = insp.turo_trip_id;
                      const current = trip?.vinNumber ?? "";
                      const value = vinEdits[tripId] !== undefined ? vinEdits[tripId] : current;
                      return (
                        <div className="flex items-center gap-1">
                          <Input value={value} placeholder="--" className="h-7 w-[150px] text-sm font-mono"
                            onChange={(e) => setVinEdits((prev) => ({ ...prev, [tripId]: e.target.value }))}
                            onBlur={() => {
                              if (vinEdits[tripId] === undefined) return;
                              if (vinEdits[tripId].trim() === current.trim()) { setVinEdits((prev) => { const next = { ...prev }; delete next[tripId]; return next; }); return; }
                              saveVin(insp);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") setVinEdits((prev) => { const next = { ...prev }; delete next[tripId]; return next; });
                            }} />
                          {savingVin === tripId && <span className="text-xs text-muted-foreground">…</span>}
                        </div>
                      );
                    })();

                    const startOdoEl = trip ? (() => {
                      const edit = odoEdits[trip.id];
                      const startStr = edit?.start !== undefined ? edit.start : trip.tripStartOdometer != null ? String(trip.tripStartOdometer) : "";
                      return <Input type="number" value={startStr} onChange={(e) => setOdoEdits((prev) => ({ ...prev, [trip.id]: { ...prev[trip.id], start: e.target.value } }))} placeholder="--" className="h-7 w-[100px] text-sm" />;
                    })() : "--";

                    const endOdoEl = trip ? (() => {
                      const edit = odoEdits[trip.id];
                      const endStr = edit?.end !== undefined ? edit.end : trip.tripEndOdometer != null ? String(trip.tripEndOdometer) : "";
                      const dirty = edit !== undefined;
                      return (
                        <div className="flex items-center gap-1">
                          <Input type="number" value={endStr} onChange={(e) => setOdoEdits((prev) => ({ ...prev, [trip.id]: { ...prev[trip.id], end: e.target.value } }))} placeholder="--" className="h-7 w-[100px] text-sm" />
                          {dirty && <Button variant="default" size="sm" className="h-7 px-2" onClick={() => saveRowOdometers(trip)} disabled={savingOdoRow === trip.id}>{savingOdoRow === trip.id ? "…" : "Save"}</Button>}
                        </div>
                      );
                    })() : "--";

                    const totalMiles = trip && trip.tripStartOdometer != null && trip.tripEndOdometer != null && trip.tripEndOdometer >= trip.tripStartOdometer
                      ? (trip.tripEndOdometer - trip.tripStartOdometer).toLocaleString() : "--";

                    const tripStatusEl = trip ? (
                      <Select value={(trip.status || "").toLowerCase()} onValueChange={(v) => tripStatusUpdateMutation.mutate({ tripId: trip.id, status: v })}>
                        <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0"><StatusBadge status={trip.status} /></SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="booked">Booked</SelectItem>
                          <SelectItem value="ended">Ended</SelectItem>
                          <SelectItem value="returned">Returned</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : "--";

                    const assigneeEl = (
                      <EmployeeSelectCombobox value={insp.assigned_to || ""}
                        onChange={(v) => { if (!v) assigneeUpdateMutation.mutate({ id: insp.id, assigned_to: null, assigned_to_id: null }); }}
                        onSelectEmployee={(emp) => {
                          if (emp) {
                            const fullName = [emp.employee_first_name, emp.employee_last_name].filter(Boolean).join(" ").trim() || emp.employee_email || `Employee #${emp.employee_aid}`;
                            assigneeUpdateMutation.mutate({ id: insp.id, assigned_to: fullName, assigned_to_id: emp.employee_aid });
                          }
                        }}
                        placeholder="Assign..." />
                    );

                    const inspStatusEl = (
                      <Select value={insp.status} onValueChange={(v) => statusUpdateMutation.mutate({ id: insp.id, status: v })}>
                        <SelectTrigger className="bg-transparent border-0 p-0 h-auto w-auto shadow-none focus:ring-0"><StatusBadge status={insp.status} /></SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    );

                    const actions = (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingInspection(insp); setModalOpen(true); }} className="text-muted-foreground hover:text-primary h-7 px-2" title="Edit"><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setHistoryInspection(insp); setHistoryModalOpen(true); }} className="text-muted-foreground hover:text-blue-400 h-7 px-2" title="History"><History className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => statusUpdateMutation.mutate({ id: insp.id, status: "completed" })} className="text-muted-foreground hover:text-green-500 h-7 px-2" title="Mark Complete"><CheckCircle className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={async () => { await flushRowEdits(insp.turo_trip_id); moveToInspectionsMutation.mutate(insp.id); }} className="text-muted-foreground hover:text-primary h-7 px-2" title="Move to Car Inspections"><ClipboardList className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={async () => { await flushRowEdits(insp.turo_trip_id); moveToMaintenanceMutation.mutate(insp.id); }} className="text-muted-foreground hover:text-blue-400 h-7 px-2" title="Move to Maintenance"><Wrench className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={async () => { await flushRowEdits(insp.turo_trip_id); moveToNoIssuesMutation.mutate(insp.id); }} className="text-muted-foreground hover:text-emerald-400 h-7 px-2" title="Move to No Car Issues"><CheckCircle2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setDeletingInspection(insp); setDeleteModalOpen(true); }} className="text-muted-foreground hover:text-red-700 h-7 px-2" title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    );

                    return (
                      <DashboardRecordCard
                        key={insp.id}
                        accentBg="bg-yellow-500"
                        accentBorder="border-yellow-300"
                        typeLabel="Turo / Inspection"
                        reservationId={insp.reservation_id || trip?.reservationId}
                        carName={insp.car_name}
                        plate={trip?.plateNumber}
                        tripStart={trip ? formatDate(trip.tripStart) : null}
                        tripEnd={trip ? formatDate(trip.tripEnd) : null}
                        pickupLocation={pickupLocation}
                        dropoffLocation={dropOffLocation}
                        media={<CarPhotoCell carPhoto={insp.car_photo} carName={insp.car_name} />}
                        details={[
                          { label: "Car Name Edit", value: carNameEl },
                          { label: "VIN #", value: vinEl },
                          { label: "Days Rented", value: daysRented ?? "--" },
                          { label: "Extras", value: trip?.extras || "--" },
                          { label: "Miles Included", value: trip?.milesIncluded || trip?.totalDistance || "--" },
                          { label: "Trip Start Odo", value: startOdoEl },
                          { label: "Trip End Odo", value: endOdoEl },
                          { label: "Total Miles", value: totalMiles },
                          { label: "Earnings", value: earnings != null ? formatCurrency(earnings) : "--" },
                          { label: "Trip Status", value: tripStatusEl },
                          { label: "Assigned To", value: assigneeEl },
                          { label: "Gas Level", value: trip ? <GasLevelCells tripId={insp.turo_trip_id} start={trip.gasLevelTripStart ?? insp.gas_level_trip_start} end={trip.gasLevelTripEnd ?? insp.gas_level_trip_end} registerPending={registerGasPending} onSaved={() => { queryClient.invalidateQueries({ queryKey: ["/api/turo-trips"] }); queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] }); }} /> : "--" },
                          { label: "Fuel Returned", value: <FuelReturnedCell level={insp.fuel_level_returned} /> },
                          { label: "Car Issues Type", value: <CarIssueTypesCell types={insp.car_issue_types} /> },
                          { label: "Inspection Status", value: inspStatusEl },
                        ]}
                        statusControl={actions}
                      />
                    );
                  }))
                }
          </div>
        <TablePagination
          totalItems={filteredInspections.length}
          itemsPerPage={pageSize}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setPageSize}
          isLoading={isLoading}
        />
        </div>
      </div>

      <InspectionModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingInspection(null);
        }}
        inspection={editingInspection}
      />

      {restoreModalOpen && (
        <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Deleted Turo Messages
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Restore a deleted trip to bring it back into Turo Messages.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-auto">
              {dismissedLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Loading deleted records...
                </p>
              ) : dismissedInspections.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No deleted Turo Messages to restore.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {dismissedInspections.map((insp) => (
                    <div
                      key={insp.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-foreground truncate">
                          {insp.car_name || "—"}
                          {insp.reservation_id ? (
                            <span className="text-muted-foreground font-mono text-xs ml-2">
                              #{insp.reservation_id}
                            </span>
                          ) : null}
                        </div>
                        {(insp as any).dismissed_at && (
                          <div className="text-xs text-muted-foreground">
                            Deleted {formatDate((insp as any).dismissed_at)}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={restoreMutation.isPending}
                        onClick={() => restoreMutation.mutate(insp.id)}
                        className="border-primary text-primary hover:bg-primary/10 shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Restore
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end mt-2">
              <Button
                variant="outline"
                onClick={() => setRestoreModalOpen(false)}
                className="bg-card text-foreground border-border"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {deleteModalOpen && deletingInspection && (
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Delete Inspection
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Are you sure you want to delete this inspection for{" "}
                {deletingInspection.car_name}?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setDeleteModalOpen(false)}
                className="bg-card text-foreground border-border"
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteMutation.mutate(deletingInspection.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-500/20 text-red-700 hover:bg-red-500/30"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {historyModalOpen && historyInspection && (
        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Edit History
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">
                  {formatDate(historyInspection.created_at)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground">
                  {formatDate(historyInspection.updated_at)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Current Status</span>
                <StatusBadge status={historyInspection.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="text-foreground">
                  {historyInspection.assigned_to}
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <TaskAssignmentModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        prefill={taskPrefill}
      />
    </div>
  );
}
