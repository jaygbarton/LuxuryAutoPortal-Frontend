import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Car, Users, ExternalLink } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface CoHostCar {
  id: number;
  year: string;
  make: string;
  model: string;
  vin: string;
  licensePlate: string;
  isActive: number;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  ownerEmail?: string | null;
}

interface CoHostGroup {
  coHostId: number;
  coHostName: string;
  coHostNumber: string;
  cars: CoHostCar[];
}

export default function CoHostPaymentsPage() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ groups: CoHostGroup[] }>({
    queryKey: ["/api/admin/all-co-host-cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/all-co-host-cars"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch co-host cars");
      return res.json();
    },
  });

  const groups = data?.groups ?? [];
  const currentYear = new Date().getFullYear();

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Co-Host Payments</h1>
          <p className="text-muted-foreground text-sm">
            Co-host earnings by car — view each car's income &amp; expense page for the detailed split breakdown.
          </p>
        </div>

        {isLoading ? (
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Users className="w-10 h-10 opacity-30" />
              <p className="text-sm">No co-hosts have been assigned cars yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <Card key={g.coHostId} className="bg-card border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{g.coHostName}</span>
                  {g.coHostNumber && (
                    <Badge variant="outline" className="text-xs">{g.coHostNumber}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {g.cars.length} car{g.cars.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <CardContent className="p-0">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[540px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Vehicle</th>
                          <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">License Plate</th>
                          <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Owner</th>
                          <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Owner Email</th>
                          <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                          <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Earnings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {g.cars.map((car) => {
                          const ownerName = [car.ownerFirstName, car.ownerLastName].filter(Boolean).join(" ");
                          return (
                            <tr key={car.id} className="hover:bg-muted/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Car className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="text-sm font-medium text-foreground">
                                    {[car.year, car.make, car.model].filter(Boolean).join(" ") || `Car #${car.id}`}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                                {car.licensePlate || "—"}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                                {ownerName || "—"}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                                {car.ownerEmail || "—"}
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
                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-primary hover:text-primary/80 gap-1"
                                  onClick={() => navigate(`/admin/cars/${car.id}/income-expense?year=${currentYear}`)}
                                >
                                  View I&amp;E
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
