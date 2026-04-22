import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { ClientCar } from "./types";

interface VehicleOwnerInfoProps {
  activeCar?: ClientCar;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  manufacturerUrl: string | null;
  turoViewLink: string | null;
}

export function VehicleOwnerInfo({
  activeCar,
  ownerName,
  ownerPhone,
  ownerEmail,
  manufacturerUrl,
  turoViewLink,
}: VehicleOwnerInfoProps) {
  return (
    <Card className="border-border bg-card h-full">
      <CardContent className="p-5 h-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Vehicle Details */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">
              Vehicle Information
            </h3>
            {activeCar ? (
              <div className="text-sm space-y-3">
                <div className="space-y-1">
                  <p><span className="font-bold">Car Name</span> :{`${activeCar.year ?? ""} ${activeCar.makeModel}`.trim()}</p>
                  {activeCar.vin && <p><span className="font-bold">VIN #</span> :{activeCar.vin}</p>}
                  {activeCar.licensePlate && <p><span className="font-bold">License</span> :{activeCar.licensePlate}</p>}
                </div>
                <div className="space-y-1">
                  <p><span className="font-bold">Fuel/Gas</span> :{activeCar.fuelType || "No Data"}</p>
                  <p><span className="font-bold">Tire Size</span> :{activeCar.tireSize || "No Data"}</p>
                  <p><span className="font-bold">Oil Type</span> :{activeCar.oilType || "No Data"}</p>
                </div>
                <div className="space-y-1">
                  {activeCar.mileage != null && <p><span className="font-bold">Current Miles:</span> {activeCar.mileage.toLocaleString()}</p>}
                  {activeCar.lastOilChange && <p><span className="font-bold">Last Oil Change</span> : {activeCar.lastOilChange}</p>}
                  {activeCar.registrationExpiration && <p><span className="font-bold">Lic./Reg. Date</span>: {activeCar.registrationExpiration}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No vehicle on file.</p>
            )}
          </div>

          {/* Owner Details */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">
              Owner Information
            </h3>
            <div className="space-y-1.5 text-sm">
              {ownerName && <p><span className="font-bold text-foreground">Name</span> :{ownerName}</p>}
              {ownerPhone && <p><span className="font-bold text-foreground">Contact #</span> :{ownerPhone}</p>}
              {ownerEmail && <p><span className="font-bold text-foreground">Email</span> :{ownerEmail}</p>}

              {(manufacturerUrl || activeCar?.manufacturerWebsite) && (
                <div className="pt-1">
                  <span className="font-bold text-foreground">Manufacturer URL</span>
                  {": "}
                  <a
                    href={manufacturerUrl || activeCar?.manufacturerWebsite || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline hover:text-[#d3bc8d]"
                  >
                    {(manufacturerUrl || activeCar?.manufacturerWebsite || "").replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}

              {activeCar?.manufacturerUsername && (
                <p><span className="font-bold text-foreground">Username</span>: {activeCar.manufacturerUsername}</p>
              )}
              {activeCar?.turoPassword && (
                <p><span className="font-bold text-foreground">Password</span>: {activeCar.turoPassword}</p>
              )}

              {turoViewLink && (
                <div className="pt-1">
                  <span className="font-bold text-foreground">Turo Link</span>
                  {" :"}
                  <a href={turoViewLink} target="_blank" rel="noopener noreferrer"
                    className="text-foreground underline hover:text-[#d3bc8d] ml-1">
                    View Car
                  </a>
                </div>
              )}

              <div className="flex items-center gap-1 pt-0.5">
                <span className="font-bold text-foreground">Book Your Car</span>
                {" :"}
                <a href="https://turo.com" target="_blank" rel="noopener noreferrer"
                  className="ml-1 text-foreground hover:text-[#d3bc8d]" title="Book on Turo">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="3" height="3" rx="0.5" fill="currentColor"/>
                    <rect x="18" y="14" width="3" height="3" rx="0.5" fill="currentColor"/>
                    <rect x="14" y="18" width="3" height="3" rx="0.5" fill="currentColor"/>
                    <rect x="18" y="18" width="3" height="3" rx="0.5" fill="currentColor"/>
                  </svg>
                </a>
              </div>

              <div className="flex items-center gap-1 pt-0.5">
                <span className="font-bold text-foreground">Schedule a Zoom call</span>
                {" "}
                <a href="https://calendly.com/goldenluxuryauto" target="_blank" rel="noopener noreferrer"
                  className="text-foreground hover:text-[#d3bc8d]" title="Schedule a Zoom call">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/>
                    <circle cx="17" cy="7" r="4"/>
                    <path d="M15 7h4M17 5v4"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
