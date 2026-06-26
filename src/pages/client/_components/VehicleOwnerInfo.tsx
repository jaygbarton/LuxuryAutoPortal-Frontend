import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarPlus, Video, ExternalLink } from "lucide-react";
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
    <Card className="border-0 shadow-none bg-card h-full">
      <CardContent className="p-5 h-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Vehicle Details */}
          <div>
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
            <div className="space-y-1.5 text-sm">
              <p><span className="font-bold text-foreground">Name</span> :{ownerName || "—"}</p>
              <p><span className="font-bold text-foreground">Mobile Number</span> :{ownerPhone || "—"}</p>
              <p><span className="font-bold text-foreground">Email</span> :{ownerEmail || "—"}</p>

              <div className="pt-1">
                <span className="font-bold text-foreground">Manufacturer URL</span>
                {": "}
                {(manufacturerUrl || activeCar?.manufacturerWebsite) ? (
                  <a
                    href={manufacturerUrl || activeCar?.manufacturerWebsite || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline hover:text-[#d3bc8d]"
                  >
                    {(manufacturerUrl || activeCar?.manufacturerWebsite || "").replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span>—</span>
                )}
              </div>

              <p><span className="font-bold text-foreground">Username</span>: {activeCar?.manufacturerUsername || "—"}</p>
              <p><span className="font-bold text-foreground">Password</span>: {activeCar?.turoPassword || "—"}</p>

              <div className="pt-1">
                <span className="font-bold text-foreground">Turo Link</span>
                {" :"}
                {turoViewLink ? (
                  <a href={turoViewLink} target="_blank" rel="noopener noreferrer"
                    className="text-foreground underline hover:text-[#d3bc8d] ml-1">
                    View Car
                  </a>
                ) : (
                  <span className="ml-1">—</span>
                )}
              </div>

              {/* Clear, labeled action buttons (replacing the previous bare
                  icons that didn't read as clickable). Same destinations. */}
              <div className="flex flex-wrap gap-2 pt-2">
                <a href="https://app.goldenluxuryauto.com/admin/car-block-off" target="_blank" rel="noopener noreferrer">
                  <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 transition-colors">
                    <CalendarPlus className="w-3.5 h-3.5" />
                    Book Your Car
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </button>
                </a>
                <a href="https://rent.goldenluxuryauto.com/lyc-client-check-in" target="_blank" rel="noopener noreferrer">
                  <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary hover:text-[#d3bc8d] transition-colors">
                    <Video className="w-3.5 h-3.5" />
                    Schedule a Zoom Call
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
