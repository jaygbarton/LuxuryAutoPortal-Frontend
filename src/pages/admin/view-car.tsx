import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ArrowLeft, ChevronRight, ChevronLeft, ExternalLink, Pencil, X, Check, ChevronDown, FileText, Eye, Download } from "lucide-react";
import { authMeQueryFn, buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { CarDetailSkeleton } from "@/components/ui/skeletons";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface CarDetail {
  id: number;
  vin: string;
  makeModel: string;
  licensePlate?: string;
  year?: number;
  mileage: number;
  status: "ACTIVE" | "INACTIVE";
  clientId?: number | null;
  owner?: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone?: string | null;
  } | null;
  ownerNameOverride?: string | null;
  ownerContactOverride?: string | null;
  ownerEmailOverride?: string | null;
  turoLink?: string | null;
  adminTuroLink?: string | null;
  turoVehicleIds?: string[] | null;
  fuelType?: string | null;
  tireSize?: string | null;
  oilType?: string | null;
  photos?: string[];
}

interface MenuItem {
  label: string;
  path: string;
  external?: boolean;
}

export default function ViewCarPage() {
  const [, params] = useRoute("/admin/view-car/:id");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : null;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [photoIndex, setPhotoIndex] = useState(0);
  const [editingOwner, setEditingOwner] = useState(false);
  const [ownerForm, setOwnerForm] = useState<{ name: string; contact: string; email: string; clientId: number | null }>({ name: "", contact: "", email: "", clientId: null });
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [downloadingStatement, setDownloadingStatement] = useState(false);
  const [statementDialogOpen, setStatementDialogOpen] = useState(false);
  const [statementFromYear, setStatementFromYear] = useState<string>("");
  const [statementToYear, setStatementToYear] = useState<string>("");
  // Blob URL of the generated PDF while it's being previewed in-app. Kept in
  // state (not a popup window) because browsers block window.open on an async
  // fetch — the click gesture has expired by the time the PDF is ready.
  const [statementPreviewUrl, setStatementPreviewUrl] = useState<string | null>(null);
  const [statementAction, setStatementAction] = useState<"view" | "download" | null>(null);
  // Mirrors statementPreviewUrl so the unmount cleanup below can revoke the
  // live blob without taking a dependency on state — this hook has to sit
  // above the isLoading/error early returns to run on every render.
  const statementPreviewUrlRef = useRef<string | null>(null);
  statementPreviewUrlRef.current = statementPreviewUrl;

  // Don't leak the blob if the page unmounts with a preview still open.
  useEffect(() => () => {
    if (statementPreviewUrlRef.current) URL.revokeObjectURL(statementPreviewUrlRef.current);
  }, []);

  // Get user data to check role
  const { data: userData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    retry: false,
  });

  const user = userData?.user;
  const isClient = user?.isClient === true;
  const isAdmin = user?.isAdmin === true;

  const { data, isLoading, error } = useQuery<{
    success: boolean;
    data: CarDetail;
  }>({
    queryKey: ["/api/cars", carId],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const url = buildApiUrl(`/api/cars/${carId}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch car");
      return response.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const car = data?.data;

  // Years this car actually has statement activity in — populates the
  // Statement of Account year / date-range picker. Fetched only when the
  // dialog is open so the ordinary page load isn't slowed by it.
  const { data: statementYearsData } = useQuery<{ success: boolean; years: number[] }>({
    queryKey: ["/api/cars", carId, "statement-of-account/years"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/cars/${carId}/statement-of-account/years`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load statement years");
      return res.json();
    },
    enabled: !!carId && isAdmin && statementDialogOpen,
    retry: false,
  });
  const statementYears = statementYearsData?.years ?? [];

  // Fetch onboarding data for additional car info
  const { data: onboardingData } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/onboarding/vin", car?.vin, "onboarding"],
    queryFn: async () => {
      if (!car?.vin) throw new Error("No VIN");
      const url = buildApiUrl(`/api/onboarding/vin/${encodeURIComponent(car.vin)}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, data: null };
        }
        throw new Error("Failed to fetch onboarding");
      }
      return response.json();
    },
    enabled: !!car?.vin,
    retry: false,
  });

  const onboarding = onboardingData?.success ? onboardingData?.data : null;

  const { data: clientsData } = useQuery<{ data: any[]; success?: boolean }>({
    queryKey: ["/api/clients", "picker"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/clients?limit=500&page=1"), { credentials: "include" });
      if (!res.ok) return { data: [] };
      const json = await res.json();
      // Handle both { data: [...] } and plain array responses
      if (Array.isArray(json)) return { data: json };
      if (Array.isArray(json.data)) return json;
      return { data: [] };
    },
    enabled: !isClient,
    staleTime: 1000 * 60 * 5,
  });
  const allClients = clientsData?.data ?? [];
  const filteredClients = ownerForm.name.trim()
    ? allClients.filter(c => {
        const full = `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase();
        const email = (c.email ?? "").toLowerCase();
        const q = ownerForm.name.trim().toLowerCase();
        return full.includes(q) || email.includes(q);
      })
    : allClients;

  // Filter menu items based on user role
  const allMenuItems: MenuItem[] = [
    { label: "Car Detail", path: `/admin/cars/${carId}` },
    { label: "Earnings", path: `/admin/cars/${carId}/earnings` },
    { label: "Income and Expense", path: `/admin/cars/${carId}/income-expense` },
    { label: "NADA Depreciation Schedule", path: `/admin/cars/${carId}/depreciation` },
    { label: "Totals", path: `/admin/cars/${carId}/totals` },
    { label: "Records and Files", path: `/admin/cars/${carId}/records` },
    { label: "Maintenance", path: `/admin/cars/${carId}/maintenance` },
    { label: "Payment history", path: `/admin/cars/${carId}/payments` },
  ];

  // Hide "Income and Expense" and Maintenance for clients.
  const menuItems = isClient
    ? allMenuItems.filter(
        (item) => item.label !== "Income and Expense" && item.label !== "Maintenance",
      )
    : allMenuItems;

  const handleMenuItemClick = (item: MenuItem) => {
    if (item.external) {
      window.open(item.path, "_blank");
    } else {
      setLocation(item.path);
    }
  };

  const updateOwnerMutation = useMutation({
    mutationFn: async (values: { name: string; contact: string; email: string; clientId: number | null }) => {
      const formData = new FormData();
      if (values.clientId != null) {
        // Linked client: write clientId so the car is owned by that client; clear text overrides.
        formData.append("clientId", String(values.clientId));
        formData.append("ownerNameOverride", "");
        formData.append("ownerContactOverride", "");
        formData.append("ownerEmailOverride", "");
      } else {
        // Free-typed owner: store overrides only.
        formData.append("ownerNameOverride", values.name);
        formData.append("ownerContactOverride", values.contact);
        formData.append("ownerEmailOverride", values.email);
      }
      const res = await fetch(buildApiUrl(`/api/cars/${carId}`), {
        method: "PATCH",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to save owner info");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cars", carId] });
      setEditingOwner(false);
      toast({ title: "Owner info saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <CarDetailSkeleton />
      </AdminLayout>
    );
  }

  if (error || !car) {
    if (isClient) {
      setLocation("/dashboard");
      return null;
    }
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-red-700">Failed to load car details</p>
          <button onClick={() => setLocation("/cars")} className="mt-4 text-blue-700 hover:underline">
            ← Back to Cars
          </button>
        </div>
      </AdminLayout>
    );
  }

  // car.makeModel never includes the year (backend CONCATs make+specs only,
  // and that field also round-trips through the editable car-detail form, so
  // fixing it there would risk baking a duplicate year into car_specs on
  // save). Append year here for DISPLAY only.
  const carName = car.makeModel
    ? car.year ? `${car.makeModel} ${car.year}` : car.makeModel
    : `${car.year || ""} ${car.vin}`.trim();
  const hasLinkedOwner = !!car.owner && !!(car.owner.firstName || car.owner.lastName);
  const linkedOwnerName = hasLinkedOwner
    ? `${car.owner!.firstName} ${car.owner!.lastName}`.trim()
    : null;
  const ownerName = linkedOwnerName || car.ownerNameOverride || "N/A";
  const ownerContact = hasLinkedOwner
    ? (car.owner!.phone || "N/A")
    : (car.ownerContactOverride || "N/A");
  const ownerEmail = hasLinkedOwner
    ? (car.owner!.email || "N/A")
    : (car.ownerEmailOverride || "N/A");
  // Show pencil whenever the resolved name is missing/invalid, even if a client is linked
  const ownerNameInvalid = !linkedOwnerName && !car.ownerNameOverride;
  const fuelType = onboarding?.fuelType || car.fuelType || "N/A";
  const tireSize = onboarding?.tireSize || car.tireSize || "N/A";
  const oilType = onboarding?.oilType || car.oilType || "N/A";

  // Statement of Account PDF (admin only) — the export lives here because this
  // is the car page the Cars list actually links to; /admin/cars/:id is not
  // reachable from normal navigation.
  const buildStatementUrl = (disposition: "inline" | "attachment") => {
    const qs = new URLSearchParams();
    if (statementFromYear) qs.set("fromYear", statementFromYear);
    if (statementToYear) qs.set("toYear", statementToYear);
    qs.set("disposition", disposition);
    return buildApiUrl(`/api/cars/${carId}/statement-of-account?${qs.toString()}`);
  };

  const statementFileName = () => {
    const rangeLabel = statementFromYear || statementToYear
      ? ` (${statementFromYear || "start"} - ${statementToYear || "latest"})`
      : "";
    return `Statement of Account - ${carName || carId}${rangeLabel}.pdf`;
  };

  const handleStatement = async (mode: "view" | "download") => {
    if (!carId) return;
    setStatementAction(mode);
    setDownloadingStatement(true);
    try {
      const res = await fetch(buildStatementUrl(mode === "view" ? "inline" : "attachment"), {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to generate statement");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (mode === "view") {
        // Swap in the new preview, releasing whatever was showing before.
        setStatementPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setStatementDialogOpen(false);
        return;
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = statementFileName();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatementDialogOpen(false);
    } catch (err: any) {
      toast({
        title: mode === "view" ? "Preview failed" : "Download failed",
        description: err?.message ?? "Could not generate the statement of account.",
        variant: "destructive",
      });
    } finally {
      setDownloadingStatement(false);
      setStatementAction(null);
    }
  };

  const closeStatementPreview = () => {
    setStatementPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  return (
    <AdminLayout>
      <div className="flex flex-col min-h-full overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => setLocation("/cars")}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Cars</span>
          </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h1 className="text-2xl font-bold text-primary">View Car</h1>
              {car && (
                <p className="text-sm text-muted-foreground mt-1">
                  Car: {carName || "Unknown Car"}
                </p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={() => setStatementDialogOpen(true)}
                disabled={downloadingStatement}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none shrink-0"
              >
                <FileText className="w-4 h-4" />
                {downloadingStatement ? "Generating..." : "Statement of Account"}
              </button>
            )}
          </div>
        </div>

        {/* Statement of Account — year / date-range picker. Defaults to every
            year the car has activity in; the admin can narrow it to one year
            or a span (e.g. 2024-2026) before downloading. */}
        <Dialog open={statementDialogOpen} onOpenChange={setStatementDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Statement of Account</DialogTitle>
              <DialogDescription>
                Choose the period to include. Leave both blank to download all years.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">From year</label>
                <select
                  value={statementFromYear}
                  onChange={(e) => setStatementFromYear(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Earliest</option>
                  {statementYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">To year</label>
                <select
                  value={statementToYear}
                  onChange={(e) => setStatementToYear(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Latest</option>
                  {statementYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {statementYears.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Recorded activity: {statementYears[0]}
                {statementYears.length > 1 ? ` - ${statementYears[statementYears.length - 1]}` : ""}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <button
                type="button"
                onClick={() => { setStatementFromYear(""); setStatementToYear(""); }}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                All years
              </button>
              <button
                type="button"
                onClick={() => handleStatement("view")}
                disabled={downloadingStatement}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
              >
                <Eye className="w-4 h-4" />
                {downloadingStatement && statementAction === "view" ? "Generating..." : "View"}
              </button>
              <button
                type="button"
                onClick={() => handleStatement("download")}
                disabled={downloadingStatement}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Download className="w-4 h-4" />
                {downloadingStatement && statementAction === "download" ? "Generating..." : "Download"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* In-app PDF preview — the statement rendered in an iframe so it can be
            read without saving a file first. The blob is served inline, so the
            browser's own PDF viewer (with its print/save controls) handles it. */}
        <Dialog
          open={!!statementPreviewUrl}
          onOpenChange={(open) => { if (!open) closeStatementPreview(); }}
        >
          <DialogContent className="max-w-[96vw] w-[96vw] h-[94vh] max-h-[94vh] flex flex-col p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
              <DialogTitle className="text-base">
                Statement of Account{statementFromYear || statementToYear
                  ? ` — ${statementFromYear || "start"} to ${statementToYear || "latest"}`
                  : ""}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Preview of the generated Statement of Account PDF.
              </DialogDescription>
            </DialogHeader>

            {statementPreviewUrl && (
              <iframe
                src={statementPreviewUrl}
                title="Statement of Account"
                className="flex-1 w-full border-0 bg-muted"
              />
            )}

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border shrink-0">
              <button
                type="button"
                onClick={() => { closeStatementPreview(); setStatementDialogOpen(true); }}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Change period
              </button>
              <button
                type="button"
                onClick={() => handleStatement("download")}
                disabled={downloadingStatement}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Download className="w-4 h-4" />
                {downloadingStatement ? "Generating..." : "Download"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Car and Owner Information Header + photos on the right */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div
            className={cn(
              "grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-stretch",
              car.photos && car.photos.length > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4",
            )}
          >
            {/* Car Information */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Car Information</h3>
              <div className="space-y-1.5 sm:space-y-2">
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Car Name: </span>
                  <span className="text-foreground text-xs sm:text-sm break-words">{carName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">VIN #: </span>
                  <span className="text-foreground font-mono text-xs sm:text-sm break-all">{car.vin}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">License: </span>
                  <span className="text-foreground text-xs sm:text-sm">{car.licensePlate || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Owner Information */}
            <div>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">Owner Information</h3>
                {ownerNameInvalid && !isClient && !editingOwner && (
                  <button
                    onClick={() => {
                      setOwnerForm({
                        name: car.ownerNameOverride || "",
                        contact: car.ownerContactOverride || "",
                        email: car.ownerEmailOverride || "",
                        clientId: null,
                      });
                      setEditingOwner(true);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit owner info"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              {editingOwner && ownerNameInvalid ? (
                <div className="space-y-2">
                  <div ref={clientDropdownRef} className="relative">
                    <label className="text-muted-foreground text-xs">Name</label>
                    <div className="relative mt-0.5">
                      <input
                        type="text"
                        value={ownerForm.name}
                        onChange={e => {
                          setOwnerForm(f => ({ ...f, name: e.target.value, clientId: null }));
                          setClientDropdownOpen(true);
                        }}
                        onFocus={() => setClientDropdownOpen(true)}
                        className="w-full px-2 py-1 pr-6 text-xs border border-border rounded bg-background text-foreground"
                        placeholder="Search or type owner name"
                      />
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                    </div>
                    {clientDropdownOpen && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded shadow-lg max-h-40 overflow-y-auto">
                        {filteredClients.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">No clients found</div>
                        ) : (
                          filteredClients.slice(0, 20).map((c, idx) => {
                            const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || (c.email ?? "Unnamed");
                            return (
                              <button
                                key={c.id ?? `client-${idx}-${c.email ?? name}`}
                                type="button"
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent text-foreground"
                                onMouseDown={e => {
                                  e.preventDefault();
                                  setOwnerForm({
                                    name,
                                    contact: c.phone ?? "",
                                    email: c.email ?? "",
                                    clientId: typeof c.id === "number" ? c.id : null,
                                  });
                                  setClientDropdownOpen(false);
                                }}
                              >
                                <span className="font-medium">{name}</span>
                                {c.email && (
                                  <span className="text-muted-foreground ml-1">— {c.email}</span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-muted-foreground text-xs">Contact #</label>
                    <input
                      type="text"
                      value={ownerForm.contact}
                      onChange={e => setOwnerForm(f => ({ ...f, contact: e.target.value }))}
                      className="w-full mt-0.5 px-2 py-1 text-xs border border-border rounded bg-background text-foreground"
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground text-xs">Email</label>
                    <input
                      type="email"
                      value={ownerForm.email}
                      onChange={e => setOwnerForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full mt-0.5 px-2 py-1 text-xs border border-border rounded bg-background text-foreground"
                      placeholder="Email address"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => updateOwnerMutation.mutate(ownerForm)}
                      disabled={updateOwnerMutation.isPending}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingOwner(false); setClientDropdownOpen(false); }}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded hover:bg-accent"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  <div>
                    <span className="text-muted-foreground text-xs sm:text-sm">Name: </span>
                    {car?.clientId ? (
                      <button
                        onClick={() => setLocation(`/admin/clients/${car.clientId}`)}
                        className="text-[#B8860B] hover:text-[#9A7209] hover:underline transition-colors text-xs sm:text-sm break-words cursor-pointer font-semibold"
                      >
                        {ownerName}
                      </button>
                    ) : (
                      <span className="text-[#B8860B] text-xs sm:text-sm break-words font-semibold">{ownerName}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs sm:text-sm">Contact #: </span>
                    <span className="text-foreground text-xs sm:text-sm">{ownerContact}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs sm:text-sm">Email: </span>
                    <span className="text-foreground text-xs sm:text-sm break-all">{ownerEmail}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Car Specifications */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Car Specifications</h3>
              <div className="space-y-1.5 sm:space-y-2">
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Fuel/Gas: </span>
                  <span className="text-foreground text-xs sm:text-sm">{fuelType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Tire Size: </span>
                  <span className="text-foreground text-xs sm:text-sm">{tireSize}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Oil Type: </span>
                  <span className="text-foreground text-xs sm:text-sm">{oilType}</span>
                </div>
              </div>
            </div>

            {/* Turo Links */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Turo Links</h3>
              <div className="space-y-1.5 sm:space-y-2">
                {car.turoLink && (
                  <div>
                    <a
                      href={car.turoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline text-sm flex items-center gap-1"
                    >
                      Turo Link: View Car
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {car.adminTuroLink && (
                  <div>
                    <a
                      href={car.adminTuroLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline text-sm flex items-center gap-1"
                    >
                      Admin Turo Link: View Car
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {car.turoVehicleIds && car.turoVehicleIds.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Turo Vehicle IDs: </span>
                    <span className="text-foreground text-sm font-mono">{car.turoVehicleIds.join(", ")}</span>
                  </div>
                )}
                {!car.turoLink && !car.adminTuroLink && (!car.turoVehicleIds || car.turoVehicleIds.length === 0) && (
                  <span className="text-muted-foreground text-sm">No Turo links available</span>
                )}
              </div>
            </div>

            {car.photos && car.photos.length > 0 && (
              <div className="flex h-full min-h-[220px] flex-col sm:col-span-2 lg:col-span-1">
                <h3 className="mb-2 text-xs font-medium text-muted-foreground sm:mb-3 sm:text-sm">Car Photos</h3>
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-background">
                  {car.photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "absolute inset-0 transition-opacity duration-500",
                        idx === photoIndex ? "opacity-100 z-10" : "opacity-0 z-0",
                      )}
                    >
                      <img
                        src={getProxiedImageUrl(photo)}
                        alt={`Car photo ${idx + 1}`}
                        className="h-full w-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
                      />
                    </div>
                  ))}
                  {car.photos.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPhotoIndex((i) => (i - 1 + car.photos!.length) % car.photos!.length)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-foreground hover:bg-background"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
                        {photoIndex + 1} / {car.photos.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPhotoIndex((i) => (i + 1) % car.photos!.length)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-foreground hover:bg-background"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                {car.photos.length > 1 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                    {car.photos.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPhotoIndex(i)}
                        style={{
                          width: 8, height: 8, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer",
                          backgroundColor: i === photoIndex ? "#d3bc8d" : "#444",
                        }}
                        aria-label={`Photo ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Menu Items List */}
        <div className="bg-card border border-border rounded-lg overflow-auto flex-shrink-0">
          <div className="divide-y divide-border">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={() => handleMenuItemClick(item)}
                className={cn(
                  "w-full px-4 sm:px-6 py-3 sm:py-4 text-left flex items-center justify-between",
                  "hover:bg-card transition-colors",
                  "text-foreground group"
                )}
              >
                <span className="text-xs sm:text-sm break-words pr-2">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <AdminPageLinks />
    </AdminLayout>
  );
}

