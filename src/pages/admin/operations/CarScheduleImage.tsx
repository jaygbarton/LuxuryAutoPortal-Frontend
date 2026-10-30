import type { ReactNode } from "react";
import { VehiclePhoto } from "@/components/shared/VehiclePhoto";

export function CarScheduleImage({
  carPhoto,
  carName,
  className = "",
  size = 360,
  hideBelowMd = true,
  fit = "cover",
  fallback,
}: {
  carPhoto: string | null | undefined;
  carName?: string | null;
  className?: string;
  size?: number;
  hideBelowMd?: boolean;
  fit?: "cover" | "contain";
  fallback?: ReactNode;
}) {
  return <VehiclePhoto carPhoto={carPhoto} carName={carName} size={size} fit={fit} fallback={fallback}
    className={`${hideBelowMd ? "hidden md:block" : ""} ${className}`} />;
}
