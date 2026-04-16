import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import {
  BarChart3,
  RefreshCw,
  ArrowLeft,
  Car,
  Route,
  Clock,
  Fuel,
  Gauge,
  TrendingUp,
  MapPin,
  Activity,
} from "lucide-react";
import { Link } from "wouter";
import { BouncieConnectionBanner } from "@/components/admin/BouncieConnectionBanner";

interface VehicleUtilization {
  device_id: string;
  imei: string;
  device_nickname: string | null;
  car_id: string | null;
  make: string | null;
  model: string | null;
  year: string | null;
  plate: string | null;
  total_trips: number;
  total_miles: number;
  total_duration_seconds: number;
  total_fuel_gallons: number;
  avg_speed: number;
  max_speed_ever: number;
  odometer_miles: number | null;
}

interface FleetTotals {
  active_vehicles: number;
  total_trips: number;
  total_miles: number;
  total_fuel: number;
  fleet_avg_speed: number;
}

interface DailyMile {
  day: string;
  miles: number;
  trips: number;
}

interface FleetAnalytics {
  period: { days: number; from: string };
  totals: FleetTotals;
  utilization: VehicleUtilization[];
  eventCounts: { event_type: string; severity: string; cnt: number }[];
  geofenceHits: { geofence_name: string; event_type: string; cnt: number }[];
  dailyMiles: DailyMile[];
}

const DAYS_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 60 days", value: "60" },
  { label: "Last 90 days", value: "90" },
];

function vehicleName(v: VehicleUtilization): string {
  if (v.year && v.make) return `${v.year} ${v.make} ${v.model || ""}`.trim();
  if (v.device_nickname) return v.device_nickname;
  return `Device ${v.imei}`;
}

function n(val: any): number {
  return Number(val) || 0;
}

function formatDuration(secs: any): string {
  const total = n(secs);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMiles(miles: any): string {
  const m = n(miles);
  if (m >= 1000) return `${(m / 1000).toFixed(1)}k`;
  return m.toFixed(1);
}

// Simple bar chart using div widths
function MiniBarChart({ data }: { data: DailyMile[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-4">No data</p>;

  const maxMiles = Math.max(...data.map(d => n(d.miles)), 1);
  const recentDays = data.slice(-14); // Show last 14 days

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1 h-28">
        {recentDays.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full bg-primary/80 rounded-t-sm hover:bg-primary transition-colors cursor-pointer"
              style={{ height: `${(n(d.miles) / maxMiles) * 100}%`, minHeight: "2px" }}
              title={`${new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${n(d.miles).toFixed(1)} mi, ${d.trips} trips`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{recentDays[0] ? new Date(recentDays[0].day).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
        <span>{recentDays[recentDays.length - 1] ? new Date(recentDays[recentDays.length - 1].day).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
      </div>
    </div>
  );
}

export default function BouncieAnalyticsPage() {
  const [days, setDays] = useState("30");

  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; data: FleetAnalytics }>({
    queryKey: ["/api/bouncie/analytics/fleet", days],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/bouncie/analytics/fleet?days=${days}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const analytics = data?.data;
  const totals = analytics?.totals;
  const utilization = analytics?.utilization ?? [];
  const dailyMiles = analytics?.dailyMiles ?? [];
  const topGeofences = analytics?.geofenceHits?.slice(0, 6) ?? [];

  // Sort utilization by total_miles descending
  const sorted = [...utilization]
    .map(v => ({
      ...v,
      total_miles: n(v.total_miles),
      total_trips: n(v.total_trips),
      total_duration_seconds: n(v.total_duration_seconds),
      total_fuel_gallons: n(v.total_fuel_gallons),
      avg_speed: n(v.avg_speed),
      max_speed_ever: n(v.max_speed_ever),
      odometer_miles: v.odometer_miles != null ? n(v.odometer_miles) : null,
    }))
    .sort((a, b) => b.total_miles - a.total_miles);
  const maxMiles = sorted[0]?.total_miles ?? 1;

  return (
    <AdminLayout>
      <div className="space-y-6 p-1">
        <BouncieConnectionBanner />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin/bouncie">
              <Button size="sm" variant="ghost" className="text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Fleet
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-primary" />
                Fleet Analytics
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Business intelligence and fleet performance insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Fleet KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Vehicles</p>
              <p className="text-3xl font-bold mt-1">{isLoading ? "—" : totals?.active_vehicles ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Trips</p>
              <p className="text-3xl font-bold mt-1">{isLoading ? "—" : totals?.total_trips ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Miles</p>
              <p className="text-3xl font-bold mt-1">{isLoading ? "—" : formatMiles(totals?.total_miles ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Fuel Used</p>
              <p className="text-3xl font-bold mt-1">{isLoading ? "—" : `${n(totals?.total_fuel).toFixed(1)}`}</p>
              <p className="text-xs text-muted-foreground">gallons</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Fleet Avg Speed</p>
              <p className="text-3xl font-bold mt-1">{isLoading ? "—" : `${n(totals?.fleet_avg_speed).toFixed(0)}`}</p>
              <p className="text-xs text-muted-foreground">mph</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Mileage Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Daily Mileage Trend (Last {Math.min(parseInt(days), 14)} days shown)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-28 text-muted-foreground gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <MiniBarChart data={dailyMiles} />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fleet Utilization Ranking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Fleet Utilization Ranking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
              ) : sorted.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No trip data in this period</p>
              ) : (
                sorted.map((v, i) => (
                  <div key={v.device_id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                        <Car className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{vehicleName(v)}</span>
                      </div>
                      <span className="text-sm font-bold ml-2 flex-shrink-0">{v.total_miles.toFixed(1)} mi</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden ml-7">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(v.total_miles / maxMiles) * 100}%` }}
                      />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground ml-7">
                      <span className="flex items-center gap-0.5"><Route className="w-3 h-3" /> {v.total_trips} trips</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {formatDuration(v.total_duration_seconds)}</span>
                      {v.avg_speed > 0 && (
                        <span className="flex items-center gap-0.5"><Gauge className="w-3 h-3" /> {v.avg_speed.toFixed(0)} mph avg</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="space-y-6">
            {/* Top geofences */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Top Location Patterns (Geofences)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                ) : topGeofences.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No geofence data — configure zones in Bouncie</p>
                ) : (
                  topGeofences.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4 text-center">{i + 1}</span>
                      <span className="flex-1 text-sm truncate">{g.geofence_name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{g.event_type}</span>
                      <span className="text-xs font-medium">{g.cnt}×</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Vehicle Performance Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  Vehicle Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                ) : sorted.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data in this period</p>
                ) : (
                  sorted.slice(0, 5).map((v) => (
                    <div key={v.device_id} className="text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate">{vehicleName(v)}</span>
                        {v.plate && <span className="text-xs font-mono text-muted-foreground">{v.plate}</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Gauge className="w-3 h-3" />
                          Max {v.max_speed_ever.toFixed(0)} mph
                        </span>
                        {v.total_fuel_gallons > 0 && (
                          <span className="flex items-center gap-1">
                            <Fuel className="w-3 h-3" />
                            {v.total_fuel_gallons.toFixed(1)} gal
                          </span>
                        )}
                        {v.odometer_miles != null && (
                          <span className="flex items-center gap-1">
                            <Route className="w-3 h-3" />
                            {v.odometer_miles.toLocaleString()} odo
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
