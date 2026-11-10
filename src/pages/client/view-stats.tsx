/**
 * Cars → View Stats (client). Pick a vehicle — preselected with the one chosen
 * on the Dashboard — then pick a section to open for it. The sections are the
 * same ones the "View Stats" quick links offer; Income and Expenses is never
 * among them (clients must not see a car's I&E).
 */
import { BarChart3, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportLinkCard } from "@/pages/client/_components/ReportLinkCard";
import { clientStatsSections, getCarLabel, useStatsCars } from "@/components/admin/VehicleStatsQuickLinks";
import { useSelectedClientCarId } from "@/lib/clientSelectedCar";
import { optionKeywords } from "@/lib/select-search";

export default function ClientViewStatsPage() {
  const [, setLocation] = useLocation();
  const { cars, isLoading } = useStatsCars();
  const [selectedCarId, setSelectedCarId] = useSelectedClientCarId();
  const selectedCar = cars.find((c) => c.id === selectedCarId);
  const sections = selectedCar ? clientStatsSections(selectedCar.id) : [];

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 pb-12">
        <div>
          <h1 className="text-2xl font-bold text-primary">View Stats</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a vehicle, then the stats you want to open.
          </p>
        </div>

        <div className="rounded-xl border-2 border-[#D3BC8D] bg-[#D3BC8D]/10 px-6 py-5 shadow-sm shadow-[#D3BC8D]/10">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D3BC8D]/70 bg-[#D3BC8D]/20 text-[#8B6914]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-foreground">Vehicle stats</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Select a Car</label>
              <Select
                value={selectedCar ? String(selectedCar.id) : ""}
                onValueChange={(v) => setSelectedCarId(Number(v))}
              >
                <SelectTrigger
                  className="w-full border-[#D3BC8D]/70 bg-background/70 text-foreground"
                  data-testid="view-stats-car"
                >
                  <SelectValue placeholder={isLoading ? "Loading cars..." : "Select a car"} />
                </SelectTrigger>
                <SelectContent className="max-h-80 border-[#D3BC8D]/70 bg-card text-foreground">
                  {cars.length > 0 ? (
                    cars.map((car) => (
                      <SelectItem searchKeywords={optionKeywords(car)} key={car.id} value={String(car.id)}>
                        {getCarLabel(car) || `Car #${car.id}`}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-cars" disabled>
                      No cars available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Open</label>
              {/* Choosing a section opens it for the selected car. */}
              <Select value="" onValueChange={(href) => setLocation(href)} disabled={!selectedCar}>
                <SelectTrigger
                  className="w-full border-[#D3BC8D]/70 bg-background/70 text-foreground"
                  data-testid="view-stats-section"
                >
                  <SelectValue placeholder={selectedCar ? "Select stats to open" : "Select a car first"} />
                </SelectTrigger>
                <SelectContent className="border-[#D3BC8D]/70 bg-card text-foreground">
                  {sections.map((s) => (
                    <SelectItem key={s.label} value={s.href}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-[#d3bc8d]" />
            </div>
          )}

          {selectedCar && (
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 pl-2 md:grid-cols-3 lg:grid-cols-4">
              {sections.map((s) => (
                <ReportLinkCard key={s.label} href={s.href} icon={s.icon} label={s.label} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
