import { optionKeywords } from "@/lib/select-search";
import "leaflet/dist/leaflet.css";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Route,
  Clock,
  MapPin,
  Gauge,
  Fuel,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Navigation,
  Calendar,
} from "lucide-react";
import { Link } from "wouter";
import { BouncieConnectionBanner } from "@/components/admin/BouncieConnectionBanner";

import {
  TripRouteMap,
  formatDate,
  formatDuration,
  vehicleName,
  type StoredTrip,
} from "@/components/bouncie/trip-route";

export default function BouncieTripsPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedDeviceId = params.get("deviceId") || "";

  const [deviceFilter, setDeviceFilter] = useState(preselectedDeviceId);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedTrip, setSelectedTrip] = useState<StoredTrip | null>(null);

  const queryParams = new URLSearchParams();
  if (deviceFilter) queryParams.set("deviceId", deviceFilter);
  if (startDate) queryParams.set("startDate", startDate);
  // Compute end-of-day in Mountain Time respecting DST (-07:00 MDT, -06:00 MST)
  const mtOffset = new Date(`${endDate}T12:00:00`).toLocaleString("en-US", { timeZone: "America/Denver", timeZoneName: "shortOffset" }).match(/GMT([+-]\d+:\d+)/)?.[1] ?? "-07:00";
  if (endDate) queryParams.set("endDate", endDate + "T23:59:59" + mtOffset);
  queryParams.set("limit", "100");

  const { data: devicesData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/bouncie/devices"],
    queryFn: async () => {
      return api.get("/api/bouncie/devices", {
        fallbackMessage: "Failed to fetch devices",
      });
    },
  });
  const devices = devicesData?.data ?? [];

  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; data: StoredTrip[] }>({
    queryKey: ["/api/bouncie/trips", deviceFilter, startDate, endDate],
    queryFn: async () => {
      return api.get(`/api/bouncie/trips?${queryParams.toString()}`, {
        fallbackMessage: "Failed to fetch trips",
      });
    },
  });

  const trips = data?.data ?? [];

  const n = (v: any) => Number(v) || 0;
  const totalMiles = trips.reduce((sum, t) => sum + n(t.distance_miles), 0);
  const totalDuration = trips.reduce((sum, t) => sum + n(t.duration_seconds), 0);
  const tripsWithSpeed = trips.filter(t => t.avg_speed_mph != null);
  const avgSpeed = tripsWithSpeed.length > 0
    ? tripsWithSpeed.reduce((sum, t) => sum + n(t.avg_speed_mph), 0) / tripsWithSpeed.length
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6 p-1">
        <BouncieConnectionBanner />

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/admin/bouncie">
              <Button size="sm" variant="ghost" className="text-muted-foreground w-fit">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Fleet
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 leading-tight">
                <Route className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <span className="truncate">Trip History</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">View all recorded trips and route playback</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="w-full sm:w-auto">
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 lg:gap-4 items-end">
              <div>
                <Label className="text-xs mb-1 block">Start Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full lg:w-40" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">End Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full lg:w-40" />
              </div>
              <div className="col-span-full sm:col-span-2 lg:col-auto lg:flex-1 lg:min-w-48">
                <Label className="text-xs mb-1 block">Vehicle (optional)</Label>
                <Select value={deviceFilter || "__all__"} onValueChange={v => setDeviceFilter(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All vehicles</SelectItem>
                    {devices.map((d: any) => (
                      <SelectItem searchKeywords={optionKeywords(d)} key={d.id} value={String(d.id)}>
                        {d.nickname || `IMEI ${d.imei}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={() => refetch()} className="col-span-full sm:col-auto w-full lg:w-auto">Apply</Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary stats */}
        {trips.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Trips</p>
                <p className="text-2xl font-bold mt-1">{trips.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Miles</p>
                <p className="text-2xl font-bold mt-1">{totalMiles.toFixed(1)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Drive Time</p>
                <p className="text-2xl font-bold mt-1">{formatDuration(totalDuration)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Speed</p>
                <p className="text-2xl font-bold mt-1">{avgSpeed > 0 ? `${avgSpeed.toFixed(0)} mph` : "—"}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trip List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Trips ({trips.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading trips…
                </div>
              ) : trips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Route className="w-10 h-10 opacity-30 mb-2" />
                  <p className="text-sm">No trips found for selected period</p>
                  <p className="text-xs mt-1">Trips are recorded automatically via Bouncie webhooks</p>
                </div>
              ) : (
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {trips.map((trip) => (
                    <button
                      key={trip.id}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3 ${selectedTrip?.id === trip.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                      onClick={() => setSelectedTrip(trip)}
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${trip.status === "active" ? "bg-blue-500 animate-pulse" : trip.status === "completed" ? "bg-green-500" : "bg-gray-400"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{vehicleName(trip)}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {trip.plate && <span className="text-xs font-mono text-muted-foreground">{trip.plate}</span>}
                            <Badge variant={trip.status === "active" ? "default" : "secondary"} className="text-xs">
                              {trip.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {formatDate(trip.start_time)}
                          </span>
                          {trip.distance_miles != null && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Route className="w-3 h-3" />
                              {n(trip.distance_miles).toFixed(1)} mi
                            </span>
                          )}
                          {trip.duration_seconds != null && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatDuration(trip.duration_seconds)}
                            </span>
                          )}
                        </div>
                        {trip.start_address && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            From: {trip.start_address}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trip Detail + Route Map */}
          <div className="space-y-4">
            {selectedTrip ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-primary" />
                      Trip Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Vehicle</p>
                        <p className="font-medium mt-0.5">{vehicleName(selectedTrip)}</p>
                        {selectedTrip.plate && <p className="text-xs text-muted-foreground font-mono">{selectedTrip.plate}</p>}
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Status</p>
                        <Badge variant={selectedTrip.status === "completed" ? "secondary" : "default"} className="mt-0.5">
                          {selectedTrip.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Start</p>
                        <p className="font-medium mt-0.5">{formatDate(selectedTrip.start_time)}</p>
                        {selectedTrip.start_address && (
                          <p className="text-xs text-muted-foreground">{selectedTrip.start_address}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">End</p>
                        <p className="font-medium mt-0.5">{selectedTrip.end_time ? formatDate(selectedTrip.end_time) : "—"}</p>
                        {selectedTrip.end_address && (
                          <p className="text-xs text-muted-foreground">{selectedTrip.end_address}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Route className="w-3 h-3" /> Distance</p>
                        <p className="font-bold text-lg mt-0.5">{selectedTrip.distance_miles != null ? n(selectedTrip.distance_miles).toFixed(1) : "—"}</p>
                        <p className="text-xs text-muted-foreground">miles</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Duration</p>
                        <p className="font-bold text-lg mt-0.5">{formatDuration(selectedTrip.duration_seconds)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Gauge className="w-3 h-3" /> Max Speed</p>
                        <p className="font-bold text-lg mt-0.5">{selectedTrip.max_speed_mph != null ? n(selectedTrip.max_speed_mph).toFixed(0) : "—"}</p>
                        <p className="text-xs text-muted-foreground">mph</p>
                      </div>
                    </div>
                    {(selectedTrip.avg_speed_mph || selectedTrip.fuel_used_gallons) && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t text-sm">
                        {selectedTrip.avg_speed_mph && (
                          <div>
                            <p className="text-xs text-muted-foreground">Avg Speed</p>
                            <p className="font-medium">{n(selectedTrip.avg_speed_mph).toFixed(0)} mph</p>
                          </div>
                        )}
                        {selectedTrip.fuel_used_gallons && (
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Fuel className="w-3 h-3" /> Fuel Used</p>
                            <p className="font-medium">{n(selectedTrip.fuel_used_gallons).toFixed(2)} gal</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      Route Playback
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <TripRouteMap
                      basePath="/api/bouncie/trips"
                      tripId={selectedTrip.id}
                      startLat={selectedTrip.start_latitude}
                      startLng={selectedTrip.start_longitude}
                      endLat={selectedTrip.end_latitude}
                      endLng={selectedTrip.end_longitude}
                    />
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Route className="w-12 h-12 opacity-30 mb-3" />
                  <p className="text-sm font-medium">Select a trip</p>
                  <p className="text-xs mt-1">Click a trip on the left to see route details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}
