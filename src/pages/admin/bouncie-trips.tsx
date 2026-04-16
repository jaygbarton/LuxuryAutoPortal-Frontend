import "leaflet/dist/leaflet.css";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { buildApiUrl } from "@/lib/queryClient";
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

interface StoredTrip {
  id: string;
  device_id: string;
  imei: string;
  device_nickname: string | null;
  car_id: string | null;
  make: string | null;
  model: string | null;
  year: string | null;
  plate: string | null;
  trip_id: string | null;
  start_time: string;
  end_time: string | null;
  start_latitude: number | null;
  start_longitude: number | null;
  start_address: string | null;
  end_latitude: number | null;
  end_longitude: number | null;
  end_address: string | null;
  distance_miles: number | null;
  duration_seconds: number | null;
  max_speed_mph: number | null;
  avg_speed_mph: number | null;
  fuel_used_gallons: number | null;
  status: string;
}

interface TripLocation {
  latitude: number;
  longitude: number;
  speed_mph: number | null;
  heading: number | null;
  timestamp: string;
}

function formatDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function vehicleName(trip: StoredTrip): string {
  if (trip.year && trip.make) return `${trip.year} ${trip.make} ${trip.model || ""}`.trim();
  if (trip.device_nickname) return trip.device_nickname;
  return `Device ${trip.imei}`;
}

// Route playback map
function TripRouteMap({ tripId, startLat, startLng, endLat, endLng }: {
  tripId: string;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: TripLocation[] }>({
    queryKey: ["/api/bouncie/trips", tripId, "locations"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/bouncie/trips/${tripId}/locations`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch route");
      return res.json();
    },
  });

  const locations = data?.data ?? [];

  useEffect(() => {
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      if (!mapInstanceRef.current) {
        const centerLat = startLat ?? 36.1699;
        const centerLng = startLng ?? -115.1398;
        const map = L.map(mapRef.current!).setView([centerLat, centerLng], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Draw route polyline
      if (locations.length >= 2) {
        const coords: [number, number][] = locations.map(p => [p.latitude, p.longitude]);
        const poly = L.polyline(coords, { color: "#3b82f6", weight: 4, opacity: 0.8 }).addTo(map);
        map.fitBounds(poly.getBounds().pad(0.1));

        // Start marker (green)
        L.circleMarker(coords[0], { radius: 8, fillColor: "#22c55e", color: "white", weight: 2, fillOpacity: 1 })
          .addTo(map).bindPopup("Start");

        // End marker (red)
        L.circleMarker(coords[coords.length - 1], { radius: 8, fillColor: "#ef4444", color: "white", weight: 2, fillOpacity: 1 })
          .addTo(map).bindPopup("End");
      } else if (startLat && startLng) {
        // Fallback: just show start/end markers
        const sIcon = L.divIcon({ html: `<div style="width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid white"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] });
        L.marker([startLat, startLng], { icon: sIcon }).addTo(map).bindPopup("Start");
        if (endLat && endLng) {
          const eIcon = L.divIcon({ html: `<div style="width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] });
          L.marker([endLat, endLng], { icon: eIcon }).addTo(map).bindPopup("End");
          map.fitBounds([[startLat, startLng], [endLat, endLng]], { padding: [40, 40] });
        }
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [locations, startLat, startLng, endLat, endLng]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading route…
      </div>
    );
  }

  return <div ref={mapRef} style={{ height: "300px", width: "100%", borderRadius: "8px" }} />;
}

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
  if (endDate) queryParams.set("endDate", endDate + "T23:59:59");
  queryParams.set("limit", "100");

  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; data: StoredTrip[] }>({
    queryKey: ["/api/bouncie/trips", deviceFilter, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/bouncie/trips?${queryParams.toString()}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
  });

  const trips = data?.data ?? [];

  const n = (v: any) => Number(v) || 0;
  const totalMiles = trips.reduce((sum, t) => sum + n(t.distance_miles), 0);
  const totalDuration = trips.reduce((sum, t) => sum + n(t.duration_seconds), 0);
  const avgSpeed = trips.length > 0
    ? trips.reduce((sum, t) => sum + n(t.avg_speed_mph), 0) / (trips.filter(t => t.avg_speed_mph).length || 1)
    : 0;

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
                <Route className="w-6 h-6 text-primary" />
                Trip History
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">View all recorded trips and route playback</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label className="text-xs mb-1 block">Start Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">End Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
              </div>
              <div className="flex-1 min-w-48">
                <Label className="text-xs mb-1 block">Device ID (optional)</Label>
                <Input placeholder="Filter by device ID…" value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)} />
              </div>
              <Button size="sm" onClick={() => refetch()}>Apply</Button>
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
                          <Badge variant={trip.status === "active" ? "default" : "secondary"} className="text-xs flex-shrink-0">
                            {trip.status}
                          </Badge>
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
    </AdminLayout>
  );
}
