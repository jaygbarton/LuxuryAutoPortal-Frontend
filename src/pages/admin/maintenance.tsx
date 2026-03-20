import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ExternalLink, Plus, Search, Folder } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";

const formatCurrency = (value: number): string => {
  return `$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function MaintenancePage() {
  const [, params] = useRoute("/admin/cars/:id/maintenance");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : null;

  const [selectedType, setSelectedType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("none");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Get user data to check role
  const { data: userData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const response = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
        if (!response.ok) return { user: undefined };
        return response.json();
      } catch (error) {
        return { user: undefined };
      }
    },
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

  // Maintenance records (currently empty)
  const maintenanceRecords: any[] = [];

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">Car Maintenance</h1>
              {car && (
                <p className="text-sm text-muted-foreground mt-1">
                  Car: {car.makeModel || "Unknown Car"}
                </p>
              )}
            </div>
            {!isClient && (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
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
          
          {/* Filtering and Search Section */}
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-2 block">Select a Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="oil-change">Oil Change</SelectItem>
                    <SelectItem value="tire-rotation">Tire Rotation</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-2 block">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-2 block">Date to Filter</Label>
                <div className="flex items-center gap-2">
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="this-month">This Month</SelectItem>
                      <SelectItem value="last-month">Last Month</SelectItem>
                      <SelectItem value="this-year">This Year</SelectItem>
                      <SelectItem value="last-year">Last Year</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">≡ {maintenanceRecords.length}</span>
                </div>
              </div>
              
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-2 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Q Search here.."
                    className="bg-card border-border text-foreground pl-10 focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Maintenance Records Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="border-collapse w-full" style={{ minWidth: '1000px' }}>
                <thead className="bg-card">
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">#</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Maintenance Type</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Oil Miles</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Schedule Date</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Date Completed</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Price</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Folder className="w-12 h-12 text-gray-600" />
                          <span className="text-muted-foreground text-sm">No data</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    maintenanceRecords.map((record, index) => (
                      <tr
                        key={index}
                        className="border-b border-border transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{record.type}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{record.status}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground text-right">{record.oilMiles?.toLocaleString() || "N/A"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{record.scheduleDate || "N/A"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{record.dateCompleted || "N/A"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground text-right">{formatCurrency(record.price || 0)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{record.remarks || "N/A"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

