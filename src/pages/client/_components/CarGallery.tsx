import React, { useState, useMemo } from "react";
import { Car } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getProxiedImageUrl } from "@/lib/queryClient";
import type { ClientCar } from "./types";

interface CarGalleryProps {
  apiPhotos: string[];
  activeCar?: ClientCar;
}

export function CarGallery({ apiPhotos, activeCar }: CarGalleryProps) {
  const photos = useMemo(() => {
    const rawPhoto = activeCar?.photo;
    let parsedMainPhotos: string[] = [];
    if (rawPhoto) {
      try {
        const parsed = JSON.parse(rawPhoto);
        if (Array.isArray(parsed)) {
          parsedMainPhotos = parsed.filter((u): u is string => typeof u === "string" && u.startsWith("http"));
        } else if (typeof parsed === "string" && parsed.startsWith("http")) {
          parsedMainPhotos = [parsed];
        } else if (parsed?.url) {
          parsedMainPhotos = [parsed.url];
        }
      } catch {
        if (typeof rawPhoto === "string" && rawPhoto.startsWith("http")) {
          parsedMainPhotos = [rawPhoto];
        }
      }
    }
    const all = [...apiPhotos];
    for (const url of parsedMainPhotos) {
      if (!all.includes(url)) all.push(url);
    }
    return all;
  }, [apiPhotos, activeCar]);

  const [activeIndex, setActiveIndex] = useState(0);
  const activePhoto = photos[activeIndex] ?? null;

  return (
    <Card className="border-border bg-card overflow-hidden h-full">
      <div className="flex flex-col h-full">
        <div className="relative flex-1 bg-muted/20 flex items-center justify-center" style={{ minHeight: "300px" }}>
          {activePhoto ? (
            <img
              src={getProxiedImageUrl(activePhoto)}
              alt={activeCar?.makeModel ?? "Vehicle"}
              className="w-full h-full object-cover absolute inset-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground/30 py-12">
              <Car className="w-24 h-24" />
              <p className="text-sm text-muted-foreground">
                {activeCar ? `${activeCar.year ?? ""} ${activeCar.makeModel}`.trim() : "No vehicle photo"}
              </p>
            </div>
          )}

          {photos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm shadow text-sm font-medium text-gray-800 select-none">
              <button
                onClick={() => setActiveIndex((i) => (i - 1 + photos.length) % photos.length)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                aria-label="Previous photo"
              >‹</button>
              <span className="min-w-[40px] text-center text-xs font-semibold">
                {activeIndex + 1} / {photos.length}
              </span>
              <button
                onClick={() => setActiveIndex((i) => (i + 1) % photos.length)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                aria-label="Next photo"
              >›</button>
            </div>
          )}
        </div>

        {photos.length > 1 && (
          <div className="flex justify-center gap-1.5 py-2 px-2 flex-wrap">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className="rounded-full transition-colors"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: i === activeIndex ? "#d3bc8d" : "#1a1a1a",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
