import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Download, FileText } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";

const formatCurrency = (value: number): string => {
  return `$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PurchaseDetailsPage() {
  const [, params] = useRoute("/admin/cars/:id/purchase");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : null;

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
            onClick={() => setLocation(`/admin/view-car/${carId}`)}
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

  // Purchase Documents data
  const purchaseDocuments = [
    { label: "Trade Inn or Cash Down Payment", value: 0 },
    { label: "Purchase Price", value: 0 },
    { label: "Dealer Doc Fee", value: 0 },
    { label: "Sales Tax", value: 0 },
    { label: "License and Registration", value: 0 },
    { label: "Age Based/Property Asses", value: 0 },
    { label: "State Inspection/Emissions", value: 0 },
    { label: "State Waste Tire Recycle", value: 0 },
    { label: "Temporary Permit", value: 0 },
    { label: "Document Prep", value: 0 },
  ];

  const totalPurchasePrice = purchaseDocuments.reduce((sum, doc) => sum + doc.value, 0);

  return (
    <AdminLayout>
      <div className="flex flex-col w-full overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => setLocation(`/admin/view-car/${carId}`)}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to View Car</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Purchase Details</h1>
            {car && (
              <p className="text-sm text-muted-foreground mt-1">
                Car: {car.makeModel || "Unknown Car"}
              </p>
            )}
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1">
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
                    <p className="text-sm text-[#B8860B] font-semibold">{ownerName}</p>
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

              {/* Car Specifications */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Car Specifications</h3>
                <div className="space-y-2">
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
              </div>

              {/* Turo Links */}
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
            {/* Export All Button */}
            <div className="ml-4">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                <Download className="w-4 h-4 mr-2" />
                Export All
              </Button>
            </div>
          </div>
        </div>

        {/* Purchase Details Section */}
        <div className="mb-6">
          <h1 className="text-3xl font-serif text-primary italic mb-6">Purchase Details</h1>
          
          {/* Purchase Documents Section */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-primary">Purchase Documents</h2>
              <div className="flex gap-2">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button className="bg-card text-foreground hover:bg-muted border border-border">
                  <FileText className="w-4 h-4 mr-2" />
                  Log
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-3">
                {purchaseDocuments.map((doc, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-2 border-b border-border last:border-b-0"
                  >
                    <span className="text-sm text-muted-foreground">
                      {index + 1}. {doc.label}
                    </span>
                    <span className="text-sm text-muted-foreground font-medium">
                      {formatCurrency(doc.value)}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Total Purchase Price */}
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-muted-foreground">Purchase Price</span>
                  <span className="text-lg font-semibold text-primary">
                    {formatCurrency(totalPurchasePrice)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase Financed Section */}
          <div className="bg-card border border-border rounded-lg overflow-hidden mt-6">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-primary">Purchase Financed</h2>
              <div className="flex gap-2">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button className="bg-card text-foreground hover:bg-muted border border-border">
                  <FileText className="w-4 h-4 mr-2" />
                  Log
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-card px-4 py-2 mb-4">
                <span className="text-sm font-semibold text-muted-foreground"># Purchase Financed</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">1. Auto Loan Amount</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">2. Months Financed</span>
                  <span className="text-sm text-muted-foreground font-medium">0</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">3. Monthly Payment</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">4. Financed Percentage %</span>
                  <span className="text-sm text-muted-foreground font-medium">0%</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">5. First Payment Date</span>
                  <span className="text-sm text-muted-foreground font-medium">--</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">6. Frequency of Payment</span>
                  <span className="text-sm text-muted-foreground font-medium">--</span>
                </div>
              </div>
              
              {/* Current Amount Owed */}
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-muted-foreground">Current Amount Owed</span>
                  <span className="text-lg font-semibold text-primary">
                    {formatCurrency(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Car Value Section */}
          <div className="bg-card border border-border rounded-lg overflow-hidden mt-6">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-primary">Total Car Value</h2>
              <div className="flex gap-2">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button className="bg-card text-foreground hover:bg-muted border border-border">
                  <FileText className="w-4 h-4 mr-2" />
                  Log
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-card px-4 py-2 mb-4">
                <span className="text-sm font-semibold text-muted-foreground"># Total Car Value</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">1. Purchase Price</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">2. Interest Paid</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">3. Principal Paid</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">4. Total Car Payment</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">5. NADA Clean Trade</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">6. Amount Owed</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
              </div>
              
              {/* Total Car Profit */}
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-muted-foreground">Total Car Profit</span>
                  <span className="text-lg font-semibold text-primary">
                    {formatCurrency(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Car Rental Value Section */}
          <div className="bg-card border border-border rounded-lg overflow-hidden mt-6">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-primary">Total Car Rental Value</h2>
              <div className="flex gap-2">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/80">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-card px-4 py-2 mb-4">
                <span className="text-sm font-semibold text-muted-foreground"># Total Car Rental Value</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Car Rental Income</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Car Management Exp</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Car Misc Exp</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Car Expenses</span>
                  <span className="text-sm text-muted-foreground font-medium">{formatCurrency(0)}</span>
                </div>
              </div>
              
              {/* Totals Car Rental Profit */}
              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-muted-foreground">Totals Car Rental Profit</span>
                  <span className="text-lg font-semibold text-primary">
                    {formatCurrency(0)}
                  </span>
                </div>
              </div>
              
              {/* Total Car & Rental Profit */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-muted-foreground">Total Car & Rental Profit</span>
                  <span className="text-lg font-semibold text-primary">
                    {formatCurrency(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}

