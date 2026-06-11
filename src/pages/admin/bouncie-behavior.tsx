import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import {
  ShieldAlert,
  RefreshCw,
  ArrowLeft,
  TrendingDown,
  Zap,
  Gauge,
  Car,
  Route,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import { BouncieConnectionBanner } from "@/components/admin/BouncieConnectionBanner";

interface VehicleBehavior {
  device_id: string;
  imei: string;
  device_nickname: string | null;
  make: string | null;
  model: string | null;
  year: string | null;
  plate: string | null;
  trip_count: number;
  total_miles: number;
  hard_braking_total: number;
  hard_accel_total: number;
  speeding_total: number;
  top_speed_mph: number | null;
  avg_speed_mph: number | null;
  last_trip_at: string | null;
}

const DAYS_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
];

function vehicleName(v: VehicleBehavior): string {
  if (v.year && v.make) return `${v.year} ${v.make} ${v.model || ""}`.trim();
  if (v.device_nickname) return v.device_nickname;
  return `Device ${v.imei}`;
}

function n(val: any): number {
  return Number(val) || 0;
}

function riskBadge(score: number) {
  if (score === 0) return <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">Clean</Badge>;
  if (score <= 3) return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">Low Risk</Badge>;
  if (score <= 8) return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">Medium Risk</Badge>;
  return <Badge variant="destructive" className="text-xs">High Risk</Badge>;
}

function perTripRate(total: number, trips: number): string {
  if (!trips) return "—";
  return (total / trips).toFixed(1);
}

export default function BouncieBehaviorPage() {
  const [days, setDays] = useState("30");

  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; data: VehicleBehavior[] }>({
    queryKey: ["/api/bouncie/analytics/driving-behavior", days],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/bouncie/analytics/driving-behavior?days=${days}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch behavior data");
      return res.json();
    },
  });

  const vehicles = data?.data ?? [];

  const totalTrips    = vehicles.reduce((s, v) => s + n(v.trip_count), 0);
  const totalBraking  = vehicles.reduce((s, v) => s + n(v.hard_braking_total), 0);
  const totalAccel    = vehicles.reduce((s, v) => s + n(v.hard_accel_total), 0);
  const totalSpeeding = vehicles.reduce((s, v) => s + n(v.speeding_total), 0);

  // Vehicles with any incidents, sorted worst-first (already sorted by backend)
  const flagged = vehicles.filter(v => n(v.hard_braking_total) + n(v.hard_accel_total) + n(v.speeding_total) > 0);
  const clean   = vehicles.filter(v => n(v.hard_braking_total) + n(v.hard_accel_total) + n(v.speeding_total) === 0 && n(v.trip_count) > 0);

  return (
    <AdminLayout>
      <div className="space-y-6 p-1">
        <BouncieConnectionBanner />

        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/admin/bouncie">
              <Button size="sm" variant="ghost" className="text-muted-foreground w-fit">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Fleet
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 leading-tight">
                <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <span className="truncate">Driving Behavior</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Hard braking, acceleration, and speeding per vehicle</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-40">
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

        {/* Fleet-wide summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Route className="w-3 h-3" /> Total Trips
              </p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">{totalTrips}</p>
            </CardContent>
          </Card>
          <Card className={totalBraking > 0 ? "border-red-200" : ""}>
            <CardContent className="pt-5 pb-4">
              <p className={`text-xs uppercase tracking-wide font-medium flex items-center gap-1 ${totalBraking > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                <TrendingDown className="w-3 h-3" /> Hard Braking
              </p>
              <p className={`text-2xl sm:text-3xl font-bold mt-1 ${totalBraking > 0 ? "text-red-600" : ""}`}>{totalBraking}</p>
            </CardContent>
          </Card>
          <Card className={totalAccel > 0 ? "border-orange-200" : ""}>
            <CardContent className="pt-5 pb-4">
              <p className={`text-xs uppercase tracking-wide font-medium flex items-center gap-1 ${totalAccel > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                <Zap className="w-3 h-3" /> Hard Accel
              </p>
              <p className={`text-2xl sm:text-3xl font-bold mt-1 ${totalAccel > 0 ? "text-orange-600" : ""}`}>{totalAccel}</p>
            </CardContent>
          </Card>
          <Card className={totalSpeeding > 0 ? "border-yellow-200" : ""}>
            <CardContent className="pt-5 pb-4">
              <p className={`text-xs uppercase tracking-wide font-medium flex items-center gap-1 ${totalSpeeding > 0 ? "text-yellow-600" : "text-muted-foreground"}`}>
                <Gauge className="w-3 h-3" /> Speeding
              </p>
              <p className={`text-2xl sm:text-3xl font-bold mt-1 ${totalSpeeding > 0 ? "text-yellow-600" : ""}`}>{totalSpeeding}</p>
            </CardContent>
          </Card>
        </div>

        {/* Vehicle breakdown */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading behavior data…
            </CardContent>
          </Card>
        ) : vehicles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShieldAlert className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-sm font-medium">No trip data in this period</p>
              <p className="text-xs mt-1">Behavior counts populate as trips complete via Bouncie webhooks</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Flagged vehicles */}
            {flagged.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Vehicles with Incidents ({flagged.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {flagged.map(v => {
                      const riskScore = n(v.hard_braking_total) + n(v.hard_accel_total) + n(v.speeding_total);
                      return (
                        <div key={v.device_id} className="px-4 py-3 hover:bg-muted/30">
                          <div className="flex items-start gap-3">
                            <Car className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{vehicleName(v)}</span>
                                {v.plate && <span className="text-xs font-mono text-muted-foreground">{v.plate}</span>}
                                {riskBadge(riskScore)}
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                                <div>
                                  <span className="text-red-600 font-semibold">{n(v.hard_braking_total)}</span>
                                  <span className="ml-1">hard brake</span>
                                </div>
                                <div>
                                  <span className="text-orange-600 font-semibold">{n(v.hard_accel_total)}</span>
                                  <span className="ml-1">hard accel</span>
                                </div>
                                <div>
                                  <span className="text-yellow-600 font-semibold">{n(v.speeding_total)}</span>
                                  <span className="ml-1">speeding</span>
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">{n(v.trip_count)}</span>
                                  <span className="ml-1">trips</span>
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">{n(v.total_miles).toFixed(0)}</span>
                                  <span className="ml-1">mi</span>
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">{perTripRate(riskScore, n(v.trip_count))}</span>
                                  <span className="ml-1">incidents/trip</span>
                                </div>
                              </div>
                              {v.top_speed_mph && n(v.top_speed_mph) > 85 && (
                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                  <Gauge className="w-3 h-3" />
                                  Top speed: {n(v.top_speed_mph).toFixed(0)} mph
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clean vehicles */}
            {clean.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-green-500" />
                    Clean Record ({clean.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {clean.map(v => (
                      <div key={v.device_id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30">
                        <Car className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{vehicleName(v)}</span>
                            {v.plate && <span className="text-xs font-mono text-muted-foreground">{v.plate}</span>}
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">No incidents</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {n(v.trip_count)} trips · {n(v.total_miles).toFixed(0)} mi
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Note about data availability */}
            {vehicles.every(v => n(v.hard_braking_total) + n(v.hard_accel_total) + n(v.speeding_total) === 0) && vehicles.length > 0 && (
              <Card className="border-blue-200 bg-blue-50/30">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-blue-800">
                    <strong>No behavior incidents recorded yet.</strong> Hard braking, acceleration, and speeding counts are captured from Bouncie's <code>tripMetrics</code> webhook at the end of each trip. Counts will appear here as trips complete going forward.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
      <AdminPageLinks />
    </AdminLayout>
  );
}
