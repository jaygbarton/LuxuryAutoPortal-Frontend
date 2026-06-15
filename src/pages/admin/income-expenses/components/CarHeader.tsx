import React from "react";
import { ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

interface CarHeaderProps {
  car: any;
  onboarding: any;
  onNavigateToClient?: (clientId: number) => void;
}

export default function CarHeader({ car, onboarding, onNavigateToClient }: CarHeaderProps) {
  const [, navigate] = useLocation();
  const coHost = car?.coHost as { id: number; firstName: string; lastName: string; email: string; turoProfileUrl: string | null } | null | undefined;

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${coHost ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-3`}>
        {/* Car Information */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Car Information</h3>
          <div className="space-y-1">
            <div>
              <span className="text-muted-foreground text-xs">Car Name: </span>
              <span className="text-foreground text-xs">
                {car?.makeModel || `${car?.year || ""} ${car?.vin || ""}`.trim()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">VIN #: </span>
              <span className="text-foreground font-mono text-xs">{car?.vin || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">License: </span>
              <span className="text-foreground text-xs">{car?.licensePlate || "N/A"}</span>
            </div>
          </div>
        </div>

        {/* Owner Information */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Owner Information</h3>
          <div className="space-y-1">
            <div>
              <span className="text-muted-foreground text-xs">Name: </span>
              {car?.clientId && onNavigateToClient ? (
                <button
                  onClick={() => onNavigateToClient(car.clientId)}
                  className="text-[#B8860B] hover:text-[#9A7209] hover:underline transition-colors text-xs cursor-pointer font-semibold"
                >
                  {car?.owner 
                    ? `${car.owner.firstName} ${car.owner.lastName}` 
                    : car?.ownerFirstName && car?.ownerLastName
                    ? `${car.ownerFirstName} ${car.ownerLastName}`
                    : "N/A"}
                </button>
              ) : (
                <span className="text-[#B8860B] text-xs font-semibold">
                  {car?.owner 
                    ? `${car.owner.firstName} ${car.owner.lastName}` 
                    : car?.ownerFirstName && car?.ownerLastName
                    ? `${car.ownerFirstName} ${car.ownerLastName}`
                    : "N/A"}
                </span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Contact #: </span>
              <span className="text-foreground text-xs">
                {car?.owner?.phone || car?.ownerPhone || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Email: </span>
              <span className="text-foreground text-xs break-all">
                {car?.owner?.email || car?.ownerEmail || "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Car Specifications */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Car Specifications</h3>
          <div className="space-y-1">
            <div>
              <span className="text-muted-foreground text-xs">Fuel/Gas: </span>
              <span className="text-foreground text-xs">
                {onboarding?.fuelType || car?.fuelType || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Tire Size: </span>
              <span className="text-foreground text-xs">
                {onboarding?.tireSize || car?.tireSize || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Oil Type: </span>
              <span className="text-foreground text-xs">
                {onboarding?.oilType || car?.oilType || "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Turo Links */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Turo Links</h3>
          <div className="space-y-1">
            {car?.turoLink && (
              <div>
                <a
                  href={car.turoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline text-xs flex items-center gap-1"
                >
                  Turo Link: View Car
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {car?.adminTuroLink && (
              <div>
                <a
                  href={car.adminTuroLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline text-xs flex items-center gap-1"
                >
                  Admin Turo Link
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {!car?.turoLink && !car?.adminTuroLink && (
              <span className="text-muted-foreground text-xs">No Turo links available</span>
            )}
          </div>
        </div>

        {/* Co-Host Information — only shown when this car is co-hosted */}
        {coHost && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Co-Host</h3>
            <div className="space-y-1">
              <div>
                <span className="text-muted-foreground text-xs">Name: </span>
                <button
                  onClick={() => navigate("/admin/co-hosts")}
                  className="text-[#B8860B] hover:text-[#9A7209] hover:underline transition-colors text-xs cursor-pointer font-semibold"
                >
                  {coHost.firstName} {coHost.lastName}
                </button>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Email: </span>
                <span className="text-foreground text-xs break-all">{coHost.email}</span>
              </div>
              {coHost.turoProfileUrl && (
                <div>
                  <a
                    href={coHost.turoProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline text-xs flex items-center gap-1"
                  >
                    Turo Profile
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
