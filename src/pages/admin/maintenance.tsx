import React, { useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ExternalLink, Search, Folder } from "lucide-react";
import { authMeQueryFn, buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      timeZone: "America/Denver", month: "short", day: "numeric", year: "numeric",
    });
  } catch { return d; }
}

function PhotoThumb({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  const proxied = getProxiedImageUrl(urls[0]);
  const src = proxied.includes("/api/gcs-image-proxy")
    ? proxied + (proxied.includes("?") ? "&" : "?") + "size=128"
    : proxied;
  return (
    <div className="relative inline-block">
      <img src={src} alt="photo" className="h-10 w-16 object-cover rounded" />
      {urls.length > 1 && (
        <span className="absolute -top-1 -right-1 rounded-full bg-black px-1.5 text-[10px] font-bold leading-4 text-white">
          {urls.length}
        </span>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  new: "New", in_progress: "In Progress", completed: "Completed", delivered: "Delivered",
};

export default function MaintenancePage() {
  const [, params] = useRoute("/admin/cars/:id/maintenance");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : null;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Get user data to check role
  const { data: userData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    retry: false,
  });

  const user = userData?.user;
  const isClient = user?.isClient === true;

  const { data, isLoading, error } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/cars", carId],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const response = await fetch(buildApiUrl(`/api/cars/${carId}`), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch car");
      return response.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const { data: maintData, isLoading: maintLoading } = useQuery<{
    success: boolean;
    data: any[];
    total: number;
  }>({
    queryKey: ["/api/operations/maintenance", carId],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const response = await fetch(
        buildApiUrl(`/api/operations/maintenance?carId=${carId}&limit=200`),
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch maintenance");
      return response.json();
    },
    enabled: !!carId,
    staleTime: 1000 * 60 * 2,
  });

  const car = data?.data;

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
          return { success: true, data: null };
        }
        throw new Error("Failed to fetch onboarding data");
      }
      return response.json();
    },
    enabled: !!car?.vin,
    retry: false,
  });

  const onboarding = onboardingData?.data;

  const allRecords: any[] = maintData?.data ?? [];

  // NOTE: This hook MUST run on every render — keep it above the early returns
  // below. Placing it after the `isLoading`/`error` guards changed the number of
  // hooks between renders and crashed the page with React error #310.
  const maintenanceRecords = useMemo(() => {
    let f = allRecords;
    if (statusFilter !== "all") f = f.filter((r) => r.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter((r) =>
        [r.task_description, r.assigned_to, r.repair_shop, r.notes, r.car_name]
          .some((v) => v && String(v).toLowerCase().includes(q))
      );
    }
    return f;
  }, [allRecords, statusFilter, searchQuery]);

  if (isLoading) {
    return (
      <AdminLayout>
        <CarDetailSkeleton />
      </AdminLayout>
    );
  }

  if (error || !car) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-red-700">Failed to load car details</p>
          <button
            onClick={() => isClient ? setLocation("/dashboard") : setLocation(`/admin/view-car/${carId}`)}
            className="mt-4 text-blue-700 hover:underline"
          >
            ← Back to View Car
          </button>
        </div>
      </AdminLayout>
    );
  }

  const carName = car.makeModel || `${car.year || ""} ${car.vin}`.trim();
  const ownerName = car.owner
    ? `${car.owner.firstName} ${car.owner.lastName}`
    : "N/A";
  const ownerContact = car.owner?.phone || "N/A";
  const ownerEmail = car.owner?.email || "N/A";
  const fuelType = onboarding?.fuelType || car.fuelType || "N/A";
  const tireSize = onboarding?.tireSize || car.tireSize || "N/A";
  const oilType = onboarding?.oilType || car.oilType || "N/A";

  return (
    <AdminLayout>
      <div className="flex flex-col w-full overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => isClient ? setLocation("/dashboard") : setLocation(`/admin/view-car/${carId}`)}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to View Car</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Car Maintenance</h1>
            {car && (
              <p className="text-sm text-muted-foreground mt-1">
                Car: {car.makeModel || "Unknown Car"}
              </p>
            )}
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Car Information */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Car Information</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">Car Name:</span>
                  <p className="text-sm text-muted-foreground">{carName}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">VIN #:</span>
                  <p className="text-sm text-muted-foreground">{car.vin || "N/A"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">License:</span>
                  <p className="text-sm text-muted-foreground">{car.licensePlate || "N/A"}</p>
                </div>
              </div>
            </div>

            {/* Owner Information */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Owner Information</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">Name:</span>
                  {car?.clientId ? (
                    <button
                      onClick={() => setLocation(`/admin/clients/${car.clientId}`)}
                      className="text-[#B8860B] hover:text-[#9A7209] hover:underline transition-colors text-sm cursor-pointer font-semibold"
                    >
                      {ownerName}
                    </button>
                  ) : (
                    <p className="text-sm text-[#B8860B] font-semibold">{ownerName}</p>
                  )}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Contact #:</span>
                  <p className="text-sm text-muted-foreground">{ownerContact}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Email:</span>
                  <p className="text-sm text-muted-foreground">{ownerEmail}</p>
                </div>
              </div>
            </div>

            {/* Car Specifications & Turo Links */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Car Specifications</h3>
              <div className="space-y-2 mb-4">
                <div>
                  <span className="text-xs text-muted-foreground">Fuel/Gas:</span>
                  <p className="text-sm text-muted-foreground">{fuelType}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Tire Size:</span>
                  <p className="text-sm text-muted-foreground">{tireSize}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Oil Type:</span>
                  <p className="text-sm text-muted-foreground">{oilType}</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Turo Links</h3>
                <div className="space-y-2">
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
                  {!car.turoLink && !car.adminTuroLink && (
                    <span className="text-muted-foreground text-sm">No Turo links available</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Maintenance Section */}
        <div className="mb-6">
          <h1 className="text-3xl font-serif text-primary italic mb-6">Maintenance</h1>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div className="flex-1 min-w-[160px] max-w-xs">
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-card border-border text-foreground focus:border-primary text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Description, assigned to, repair shop…"
                  className="bg-card border-border text-foreground pl-10 focus:border-primary text-sm"
                />
              </div>
            </div>

            <span className="text-sm text-muted-foreground self-end pb-2">
              Total: {maintenanceRecords.length}
            </span>
          </div>

          {/* Maintenance Records Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="border-collapse w-full text-sm" style={{ minWidth: "900px" }}>
                <thead className="bg-muted/40">
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Task Description</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned To</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scheduled Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Repair Shop</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Photos</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Notes</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {maintLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                        Loading…
                      </td>
                    </tr>
                  ) : maintenanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Folder className="w-12 h-12 text-gray-400" />
                          <span className="text-muted-foreground text-sm">No data</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    maintenanceRecords.map((record, index) => (
                      <tr key={record.id ?? index} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-3 text-foreground max-w-[220px] whitespace-pre-wrap break-words">
                          {record.task_description || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {record.assigned_to || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatDate(record.scheduled_date)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatDate(record.due_date)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {record.repair_shop || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <PhotoThumb urls={Array.isArray(record.photos) ? record.photos : []} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] whitespace-pre-wrap break-words">
                          {record.notes || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            record.status === "completed" || record.status === "delivered"
                              ? "bg-green-100 text-green-700"
                              : record.status === "in_progress"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {STATUS_LABELS[record.status] ?? record.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}

