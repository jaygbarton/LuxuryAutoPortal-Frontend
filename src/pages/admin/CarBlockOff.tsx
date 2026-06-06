import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { CalendarOff, Car, Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CarOption {
  id: number;
  makeModel: string;
  licensePlate: string | null;
  plateNumber?: string | null;
  year: number | null;
  vin: string | null;
  owner?: { firstName: string; lastName: string } | null;
  ownerNameOverride?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
}

interface CarBlockOff {
  id: number;
  car_id: number | null;
  car_name: string;
  plate_number: string | null;
  owner_name: string;
  owner_user_id: number | null;
  reason: "personal_use" | "maintenance" | "others";
  reason_other: string | null;
  pickup_date: string;
  pickup_location: string;
  pickup_submitted_at: string | null;
  dropoff_date: string | null;
  dropoff_location: string | null;
  dropoff_submitted_at: string | null;
  assigned_to: string | null;
  status: "new" | "car_not_available" | "block_off_started" | "blocked_off_ended";
  notes: string | null;
  created_at: string;
}

interface SubmissionsResponse {
  success: boolean;
  data: CarBlockOff[];
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-gray-100 text-gray-700 border-gray-200" },
  car_not_available: { label: "Car Not Available", className: "bg-red-100 text-red-700 border-red-200" },
  block_off_started: { label: "Block Off Started", className: "bg-amber-100 text-amber-700 border-amber-200" },
  blocked_off_ended: { label: "Blocked Off Ended", className: "bg-green-100 text-green-700 border-green-200" },
};

const REASON_LABELS: Record<string, string> = {
  personal_use: "Personal Use",
  maintenance: "Maintenance",
  others: "Others",
};

function statusBadge(status: string) {
  const m = STATUS_META[status] ?? { label: status, className: "bg-gray-100 text-gray-700 border-gray-200" };
  return <Badge variant="outline" className={`text-xs ${m.className}`}>{m.label}</Badge>;
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  try {
    // DB stores datetime-local value as-is (Mountain time) — parse without UTC conversion
    const normalized = String(v).replace(" ", "T").replace(/Z$/, "");
    const d = new Date(normalized);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
}

// ── Car selector ──────────────────────────────────────────────────────────────

function CarSelect({ value, onChange, isAdmin: _isAdmin }: { value: string; onChange: (v: string, car: CarOption | null) => void; isAdmin: boolean }) {
  const { data } = useQuery<{ success: boolean; data: CarOption[] }>({
    queryKey: ["/api/car-block-off/my-cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/car-block-off/my-cars"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const cars = data?.data ?? [];

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const car = cars.find((c) => String(c.id) === v) ?? null;
        onChange(v, car);
      }}
    >
      <SelectTrigger className="bg-card border-border text-foreground">
        <SelectValue placeholder="Select a car..." />
      </SelectTrigger>
      <SelectContent className="bg-card border-border text-foreground">
        {cars.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {c.makeModel} {c.year ? `(${c.year})` : ""}
            {c.vin ? ` — VIN: ${c.vin}` : ""}
            {(c.licensePlate ?? c.plateNumber) ? ` — ${c.licensePlate ?? c.plateNumber}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Existing block-off lookup for drop-off form ───────────────────────────────

function BlockOffSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useQuery<SubmissionsResponse>({
    queryKey: ["/api/car-block-off/submissions", "dropoff-picker"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/car-block-off/submissions?limit=100"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch block-offs");
      return res.json();
    },
  });

  const records = (data?.data ?? []).filter((r) => r.status !== "blocked_off_ended");

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-card border-border text-foreground">
        <SelectValue placeholder="Select a car block-off..." />
      </SelectTrigger>
      <SelectContent className="bg-card border-border text-foreground">
        {records.length === 0 && (
          <SelectItem value="_none" disabled>No active block-offs found</SelectItem>
        )}
        {records.map((r) => (
          <SelectItem key={r.id} value={String(r.id)}>
            {r.car_name} — {r.owner_name} (picked up {fmtDateTime(r.pickup_date)})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CarBlockOffPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Toggle between Start (pickup) and End (drop-off)
  const [mode, setMode] = useState<"start" | "end">("start");

  // Pickup form state
  const [carIdStr, setCarIdStr] = useState("");
  const [carName, setCarName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [reason, setReason] = useState<"personal_use" | "maintenance" | "others">("personal_use");
  const [reasonOther, setReasonOther] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Drop-off form state
  const [blockOffId, setBlockOffId] = useState("");
  const [dropoffDate, setDropoffDate] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");

  // Table state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Pre-fill owner name from session
  const { data: meData } = useQuery<{ user?: { firstName?: string; lastName?: string; isAdmin?: boolean } }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      if (!res.ok) return null as any;
      return res.json();
    },
    retry: false,
  });

  const isAdmin = Boolean(meData?.user?.isAdmin);

  useEffect(() => {
    if (!isAdmin && meData?.user) {
      const name = `${meData.user.firstName ?? ""} ${meData.user.lastName ?? ""}`.trim();
      if (name) setOwnerName(name);
    }
  }, [meData, isAdmin]);

  // Submissions list query
  const { data: submissionsData, isLoading } = useQuery<SubmissionsResponse>({
    queryKey: ["/api/car-block-off/submissions", search, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(buildApiUrl(`/api/car-block-off/submissions?${params}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
    staleTime: 30_000,
  });

  const submissions = submissionsData?.data ?? [];
  const total = submissionsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Pickup submission mutation
  const submitPickup = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/car-block-off/submit-pickup"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: carIdStr ? Number(carIdStr) : null,
          carName,
          plateNumber: plateNumber || null,
          ownerName,
          reason,
          reasonOther: reason === "others" ? reasonOther : null,
          pickupDate,
          pickupLocation,
          notes: notes || null,
        }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || "Failed to submit");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Submitted", description: "Car block-off pick-up request submitted." });
      queryClient.invalidateQueries({ queryKey: ["/api/car-block-off/submissions"] });
      setCarIdStr(""); setCarName(""); setPlateNumber(""); setReason("personal_use");
      setReasonOther(""); setPickupDate(""); setPickupLocation(""); setNotes("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Drop-off submission mutation
  const submitDropoff = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl(`/api/car-block-off/submit-dropoff/${blockOffId}`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropoffDate, dropoffLocation }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || "Failed to submit");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Submitted", description: "Car block-off drop-off recorded." });
      queryClient.invalidateQueries({ queryKey: ["/api/car-block-off/submissions"] });
      setBlockOffId(""); setDropoffDate(""); setDropoffLocation("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/car-block-off/submissions/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || "Failed to delete");
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Record deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/car-block-off/submissions"] });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setDeleteId(null);
    },
  });

  const handlePickupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!carName || !ownerName || !reason || !pickupDate || !pickupLocation) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    submitPickup.mutate();
  };

  const handleDropoffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockOffId || blockOffId === "_none" || !dropoffDate || !dropoffLocation) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    submitDropoff.mutate();
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarOff className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-primary">Car Block Off Form</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Submit a car block-off request when the car owner needs the vehicle for personal use, maintenance, or other reasons.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => setMode("start")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              mode === "start"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Car className="w-4 h-4 inline mr-2" />
            Car Block Off Start — Car Owner Pick Up
          </button>
          <button
            type="button"
            onClick={() => setMode("end")}
            className={`px-6 py-3 text-sm font-medium transition-colors border-l border-border ${
              mode === "end"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <CalendarOff className="w-4 h-4 inline mr-2" />
            Car Block Off End — Car Owner Drop Off
          </button>
        </div>

        {/* Pickup Form */}
        {mode === "start" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-lg">Car Block Off Start – Car Owner Pick Up</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePickupSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Car *</Label>
                    <CarSelect
                      isAdmin={isAdmin}
                      value={carIdStr}
                      onChange={(v, car) => {
                        setCarIdStr(v);
                        if (car) {
                          setCarName(`${car.makeModel}${car.year ? ` (${car.year})` : ""}`);
                          setPlateNumber(car.licensePlate ?? car.plateNumber ?? "");
                          const ownerFromCar = car.owner
                            ? `${car.owner.firstName} ${car.owner.lastName}`.trim()
                            : car.ownerFirstName
                            ? `${car.ownerFirstName} ${car.ownerLastName ?? ""}`.trim()
                            : (car.ownerNameOverride ?? "");
                          if (ownerFromCar) setOwnerName(ownerFromCar);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Car Owner Name *</Label>
                    <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                      className="bg-card border-border text-foreground" placeholder="Full name" />
                  </div>
                </div>

                {carIdStr && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-sm">Car Name</Label>
                      <Input value={carName} onChange={(e) => setCarName(e.target.value)}
                        className="bg-card border-border text-foreground" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">Plate #</Label>
                      <Input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)}
                        className="bg-card border-border text-foreground" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Pick Up Date & Time *</Label>
                    <Input type="datetime-local" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}
                      className="bg-card border-border text-foreground" />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Pick Up Location *</Label>
                    <Input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)}
                      className="bg-card border-border text-foreground" placeholder="Address or description" />
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground text-sm">Reason *</Label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {(["personal_use", "maintenance", "others"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReason(r)}
                        className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                          reason === r
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {REASON_LABELS[r]}
                      </button>
                    ))}
                  </div>
                  {reason === "others" && (
                    <Input
                      value={reasonOther}
                      onChange={(e) => setReasonOther(e.target.value)}
                      className="bg-card border-border text-foreground mt-2"
                      placeholder="Please describe..."
                    />
                  )}
                </div>

                <div>
                  <Label className="text-muted-foreground text-sm">Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    className="bg-card border-border text-foreground" rows={3} placeholder="Optional notes..." />
                </div>

                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/80"
                  disabled={submitPickup.isPending}>
                  {submitPickup.isPending ? "Submitting..." : "Submit Car Block Off Start"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Drop-off Form */}
        {mode === "end" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-lg">Car Block Off End – Car Owner Drop Off</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDropoffSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Select Active Block-Off *</Label>
                    <BlockOffSelect value={blockOffId} onChange={setBlockOffId} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-1">
                    <div>
                      <Label className="text-muted-foreground text-sm">Drop Off Date & Time *</Label>
                      <Input type="datetime-local" value={dropoffDate} onChange={(e) => setDropoffDate(e.target.value)}
                        className="bg-card border-border text-foreground" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">Drop Off Location *</Label>
                      <Input value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)}
                        className="bg-card border-border text-foreground" placeholder="Address or description" />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/80"
                  disabled={submitDropoff.isPending}>
                  {submitDropoff.isPending ? "Submitting..." : "Submit Car Block Off End"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Submissions Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-foreground">Submissions</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search car, owner, location..."
                  className="pl-9 bg-card border-border text-foreground w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="bg-card border-border text-foreground w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="car_not_available">Car Not Available</SelectItem>
                  <SelectItem value="block_off_started">Block Off Started</SelectItem>
                  <SelectItem value="blocked_off_ended">Blocked Off Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Car", "Owner", "Reason", "Pick Up Date", "Pick Up Location", "Drop Off Date", "Drop Off Location", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : submissions.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No submissions found.</td></tr>
                ) : submissions.map((s) => (
                  <tr key={s.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-medium text-foreground">{s.car_name}</div>
                      {s.plate_number && <div className="text-xs text-muted-foreground">{s.plate_number}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">{s.owner_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                      {REASON_LABELS[s.reason] ?? s.reason}
                      {s.reason === "others" && s.reason_other && (
                        <div className="text-xs text-muted-foreground">{s.reason_other}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground text-xs">{fmtDateTime(s.pickup_date)}</td>
                    <td className="px-3 py-2 text-foreground">{s.pickup_location}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground text-xs">{s.dropoff_date ? fmtDateTime(s.dropoff_date) : "—"}</td>
                    <td className="px-3 py-2 text-foreground">{s.dropoff_location ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{statusBadge(s.status)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteId(s.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-foreground px-2">Page {page} of {totalPages}</span>
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this block-off record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}
