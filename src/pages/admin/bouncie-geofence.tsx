import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
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
  MapPin,
  RefreshCw,
  ArrowLeft,
  LogIn,
  LogOut,
  Clock,
  Car,
} from "lucide-react";
import { Link } from "wouter";

interface GeofenceEvent {
  id: string;
  device_id: string;
  imei: string;
  device_nickname: string | null;
  car_id: string | null;
  make: string | null;
  model: string | null;
  year: string | null;
  event_type: "entry" | "exit";
  geofence_name: string | null;
  geofence_id: string | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  address: string | null;
  speed_mph: number | null;
  severity: string | null;
}

const HOURS_OPTIONS = [
  { label: "Last 24 hours", value: "24" },
  { label: "Last 7 days", value: "168" },
  { label: "Last 30 days", value: "720" },
  { label: "Last 90 days", value: "2160" },
];

function vehicleName(event: GeofenceEvent): string {
  if (event.year && event.make) return `${event.year} ${event.make} ${event.model || ""}`.trim();
  if (event.device_nickname) return event.device_nickname;
  return `Device ${event.imei}`;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function BouncieGeofencePage() {
  const [hours, setHours] = useState("168");
  const [typeFilter, setTypeFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; data: GeofenceEvent[] }>({
    queryKey: ["/api/bouncie/analytics/geofence-events", hours],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/bouncie/analytics/geofence-events?hours=${hours}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch geofence events");
      return res.json();
    },
  });

  const { data: summaryData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/bouncie/analytics/geofence-summary", hours],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/bouncie/analytics/geofence-summary?hours=${hours}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const allEvents = data?.data ?? [];

  // Unique zone names
  const zoneNames = Array.from(new Set(allEvents.map(e => e.geofence_name).filter(Boolean))) as string[];

  const events = allEvents.filter(e => {
    if (typeFilter !== "all" && e.event_type !== typeFilter) return false;
    if (zoneFilter !== "all" && e.geofence_name !== zoneFilter) return false;
    return true;
  });

  const entryCount = allEvents.filter(e => e.event_type === "entry").length;
  const exitCount = allEvents.filter(e => e.event_type === "exit").length;

  // Top zones by hit count
  const zoneCounts: Record<string, { entries: number; exits: number }> = {};
  allEvents.forEach(e => {
    const zone = e.geofence_name || "Unknown";
    if (!zoneCounts[zone]) zoneCounts[zone] = { entries: 0, exits: 0 };
    if (e.event_type === "entry") zoneCounts[zone].entries++;
    else zoneCounts[zone].exits++;
  });
  const topZones = Object.entries(zoneCounts)
    .sort((a, b) => (b[1].entries + b[1].exits) - (a[1].entries + a[1].exits))
    .slice(0, 8);

  // Top vehicles by geofence activity
  const vehicleCounts: Record<string, { name: string; count: number }> = {};
  allEvents.forEach(e => {
    const name = vehicleName(e);
    if (!vehicleCounts[e.device_id]) vehicleCounts[e.device_id] = { name, count: 0 };
    vehicleCounts[e.device_id].count++;
  });
  const topVehicles = Object.entries(vehicleCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  return (
    <AdminLayout>
      <div className="space-y-6 p-1">
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
                <MapPin className="w-6 h-6 text-primary" />
                Geofence Reports
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Zone entry and exit activity for your fleet</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS_OPTIONS.map(o => (
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Events</p>
              <p className="text-3xl font-bold mt-1">{allEvents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-green-600 uppercase tracking-wide font-medium">Zone Entries</p>
              <p className="text-3xl font-bold mt-1 text-green-600">{entryCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-orange-600 uppercase tracking-wide font-medium">Zone Exits</p>
              <p className="text-3xl font-bold mt-1 text-orange-600">{exitCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Unique Zones</p>
              <p className="text-3xl font-bold mt-1">{zoneNames.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top zones */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Activity by Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topZones.map(([zone, counts]) => {
                const total = counts.entries + counts.exits;
                const maxTotal = Math.max(...topZones.map(([, c]) => c.entries + c.exits));
                return (
                  <div key={zone} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium truncate">{zone}</span>
                      <span className="text-muted-foreground ml-2 flex-shrink-0">{total} events</span>
                    </div>
                    <div className="flex gap-1 h-1.5">
                      <div
                        className="bg-green-400 rounded-full"
                        style={{ width: `${(counts.entries / total) * (total / maxTotal) * 100}%` }}
                        title={`${counts.entries} entries`}
                      />
                      <div
                        className="bg-orange-400 rounded-full"
                        style={{ width: `${(counts.exits / total) * (total / maxTotal) * 100}%` }}
                        title={`${counts.exits} exits`}
                      />
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> {counts.entries} in</span>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> {counts.exits} out</span>
                    </div>
                  </div>
                );
              })}
              {topZones.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No geofence events in this period</p>
              )}
            </CardContent>
          </Card>

          {/* Top vehicles */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Most Active Vehicles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topVehicles.map(([, info], i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{info.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{info.count} events</Badge>
                  <Car className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
              {topVehicles.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Event Log */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-semibold">Event Log ({events.length})</CardTitle>
              <div className="flex gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="entry">Entry Only</SelectItem>
                    <SelectItem value="exit">Exit Only</SelectItem>
                  </SelectContent>
                </Select>
                {zoneNames.length > 0 && (
                  <Select value={zoneFilter} onValueChange={setZoneFilter}>
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue placeholder="All Zones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Zones</SelectItem>
                      {zoneNames.map(z => (
                        <SelectItem key={z} value={z}>{z}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading events…
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MapPin className="w-10 h-10 opacity-30 mb-2" />
                <p className="text-sm">No geofence events found</p>
                <p className="text-xs mt-1">Configure geofences in Bouncie to start tracking zone activity</p>
              </div>
            ) : (
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                      event.event_type === "entry" ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                    }`}>
                      {event.event_type === "entry"
                        ? <LogIn className="w-3.5 h-3.5" />
                        : <LogOut className="w-3.5 h-3.5" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {event.event_type === "entry" ? "Entered" : "Exited"}{" "}
                          <span className="text-primary">{event.geofence_name || "Unknown Zone"}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{vehicleName(event)}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTime(event.timestamp)}
                        </span>
                        {event.speed_mph != null && (
                          <span className="text-xs text-muted-foreground">{Number(event.speed_mph).toFixed(0)} mph</span>
                        )}
                      </div>
                      {event.address && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.address}</p>
                      )}
                    </div>
                    {event.latitude && event.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex-shrink-0 mt-1"
                      >
                        Map
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
