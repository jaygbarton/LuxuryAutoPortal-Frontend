import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Car, Users, DollarSign, MapPin, Mail, Phone } from "lucide-react";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";

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
  coHostCity?: string | null;
  coHostState?: string | null;
  coHostEmail?: string | null;
  coHostPhone?: string | null;
  cars: CoHostCar[];
}

function CarTable({ cars }: { cars: CoHostCar[] }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[540px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Vehicle</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">License Plate</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">VIN</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Owner Name</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden xl:table-cell">Owner Email</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Income & Expenses</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {cars.map((car) => {
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
              <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{car.licensePlate || "—"}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden lg:table-cell">{car.vin || "—"}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{ownerName || "—"}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground hidden xl:table-cell">{car.ownerEmail || "—"}</td>
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
              <td className="px-4 py-3">
                <a
                  href={`/admin/cars/${car.id}/income-expense`}
                  className="inline-flex items-center gap-1 text-xs text-[#D3BC8D] hover:text-[#b89d6a] font-medium transition-colors"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  View I&amp;E
                </a>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function MyCoHostCarsPage() {
  const { data: meData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    staleTime: 5 * 60 * 1000,
  });

  const user = meData?.user;
  const isRealCoHost = !!(user as any)?.isCoHost;
  const isViewingAsCoHost = !!(user as any)?.viewAsCoHost?.coHostId;
  const isCoHostContext = isRealCoHost || isViewingAsCoHost;
  // GLA admin (not in co-host context) sees the grouped overview of ALL co-host cars
  const isGlaAdminOverview = !!user?.isAdmin && !isCoHostContext;

  // Co-host's own assigned cars
  const { data: myCarsData, isLoading: myLoading } = useQuery<{ cars: CoHostCar[] }>({
    queryKey: ["/api/co-host/my-vehicles"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/co-host/my-vehicles"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch co-host vehicles");
      return res.json();
    },
    enabled: isCoHostContext,
  });

  // GLA admin overview — all co-host cars grouped by co-host
  const { data: allData, isLoading: allLoading } = useQuery<{ groups: CoHostGroup[] }>({
    queryKey: ["/api/admin/all-co-host-cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/all-co-host-cars"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch all co-host cars");
      return res.json();
    },
    enabled: isGlaAdminOverview,
  });

  const myCars = myCarsData?.cars ?? [];
  const groups = allData?.groups ?? [];
  const isLoading = isGlaAdminOverview ? allLoading : myLoading;

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {isGlaAdminOverview ? "Co-Hosted Cars" : "My Co-Hosted Cars"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isGlaAdminOverview
              ? "All vehicles assigned to co-hosts, grouped by co-host."
              : "Vehicles assigned to you for co-hosting"}
          </p>
        </div>

        {isLoading ? (
          <Card className="bg-card border-border">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : isGlaAdminOverview ? (
          // GLA admin: grouped by co-host
          groups.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Car className="w-10 h-10 opacity-30" />
                <p className="text-sm">No cars have been assigned to any co-host yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <Card key={g.coHostId} className="bg-card border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-semibold text-foreground">{g.coHostName}</span>
                      {g.coHostNumber && (
                        <Badge variant="outline" className="text-xs">{g.coHostNumber}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {g.cars.length} car{g.cars.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {[g.coHostCity, g.coHostState, g.coHostEmail, g.coHostPhone].filter(Boolean).length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 pl-6 text-xs text-muted-foreground">
                        {[g.coHostCity, g.coHostState].filter(Boolean).length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {[g.coHostCity, g.coHostState].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {g.coHostEmail && (
                          <a href={`mailto:${g.coHostEmail}`} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            {g.coHostEmail}
                          </a>
                        )}
                        {g.coHostPhone && (
                          <a href={`tel:${g.coHostPhone}`} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {g.coHostPhone}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <CardContent className="p-0">
                    <CarTable cars={g.cars} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          // Co-host: own cars
          <Card className="bg-card border-border overflow-hidden">
            <CardContent className="p-0">
              {myCars.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Car className="w-10 h-10 opacity-30" />
                  <p className="text-sm">No vehicles have been assigned to you yet.</p>
                  <p className="text-xs">Contact your GLA administrator to get vehicles assigned.</p>
                </div>
              ) : (
                <>
                  <CarTable cars={myCars} />
                  <div className="px-4 py-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {myCars.length} vehicle{myCars.length !== 1 ? "s" : ""} assigned
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
