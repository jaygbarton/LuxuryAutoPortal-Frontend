import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Car } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";

interface CoHostCar {
  id: number;
  year: string;
  make: string;
  model: string;
  vin: string;
  licensePlate: string;
  color: string;
  isActive: number;
}

export default function MyCoHostCarsPage() {
  const { data, isLoading } = useQuery<{ cars: CoHostCar[] }>({
    queryKey: ["/api/co-host/my-vehicles"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/co-host/my-vehicles"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch co-host vehicles");
      return res.json();
    },
  });

  const cars = data?.cars ?? [];

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">My Co-Hosted Cars</h1>
          <p className="text-muted-foreground text-sm">Vehicles assigned to you for co-hosting</p>
        </div>

        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : cars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Car className="w-10 h-10 opacity-30" />
                <p className="text-sm">No vehicles have been assigned to you yet.</p>
                <p className="text-xs">Contact your GLA administrator to get vehicles assigned.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[540px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Vehicle</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Color</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">License Plate</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">VIN</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cars.map((car) => (
                      <tr key={car.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium text-foreground">
                              {[car.year, car.make, car.model].filter(Boolean).join(" ") || `Car #${car.id}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                          {car.color || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                          {car.licensePlate || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden lg:table-cell">
                          {car.vin || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={car.isActive
                              ? "bg-green-500/20 text-green-700 border-green-500/30 text-xs"
                              : "bg-muted text-muted-foreground border-border text-xs"}
                          >
                            {car.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {cars.length} vehicle{cars.length !== 1 ? "s" : ""} assigned
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
