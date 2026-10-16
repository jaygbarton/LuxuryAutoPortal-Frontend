import { useMemo, useState, type ReactNode } from "react";
import { vehiclePhotoSources } from "@/lib/vehiclePhotos";
import { cn } from "@/lib/utils";

export type VehiclePhotoProps = {
  carPhoto: string | null | undefined;
  carName?: string | null;
  className?: string;
  size?: number;
  fit?: "cover" | "contain";
  fallback?: ReactNode;
};

export function VehiclePhoto(props: VehiclePhotoProps) {
  const sources = useMemo(() => vehiclePhotoSources(props.carPhoto, props.size), [props.carPhoto, props.size]);
  // Reset failures immediately when the source list changes, including switching cars.
  return <PhotoSources key={JSON.stringify(sources)} {...props} sources={sources} />;
}

function PhotoSources({ sources, carName, className, fit = "cover", fallback }: VehiclePhotoProps & { sources: string[] }) {
  const [index, setIndex] = useState(0);
  const src = sources[index];
  if (!src && !fallback) return null;
  return <div className={cn("shrink-0 overflow-hidden rounded-md border border-border bg-muted", className)}>
    {src ? <img key={src} src={src} alt={carName ? `${carName} photo` : "Vehicle photo"}
      className={cn("h-full w-full", fit === "contain" ? "object-contain" : "object-cover")}
      loading="lazy" onError={() => setIndex(current => current + 1)} /> : fallback}
  </div>;
}
