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
  ShieldAlert,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  Gauge,
  TrendingDown,
  RotateCcw,
  Zap,
  Car,
  Clock,
  MapPin,
} from "lucide-react";
import { Link } from "wouter";

interface DrivingEvent {
  id: string;
  device_id: string;
  imei: string;
  device_nickname: string | null;
  car_id: string | null;
  make: string | null;
  model: string | null;
  year: string | null;
  event_type: string;
  severity: "low" | "medium" | "high";
  latitude: number | null;
  longitude: number | null;
  speed_mph: number | null;
  speed_limit_mph: number | null;
  g_force: number | null;
  timestamp: string;
  address: string | null;
}

const HOURS_OPTIONS = [
  { label: "Last 24 hours", value: "24" },
  { label: "Last 7 days", value: "168" },
  { label: "Last 30 days", value: "720" },
  { label: "Last 90 days", value: "2160" },
];

const EVENT_TYPE_ICONS: Record<string, any> = {
  hard_brake: TrendingDown,
  hard_acceleration: Zap,
  rapid_acceleration: Zap,
  rapid_deceleration: TrendingDown,
  speeding: Gauge,
  harsh_turn: RotateCcw,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  hard_brake: "Hard Brake",
  hard_acceleration: "Hard Acceleration",
  rapid_acceleration: "Rapid Acceleration",
  rapid_deceleration: "Rapid Deceleration",
  speeding: "Speeding",
  harsh_turn: "Harsh Turn",
};

function severityBadge(severity: string) {
  switch (severity) {
    case "high": return <Badge variant="destructive" className="text-xs">High</Badge>;
    case "medium": return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">Medium</Badge>;
    default: return <Badge variant="secondary" className="text-xs">Low</Badge>;
  }
}

function vehicleName(event: DrivingEvent): string {
  if (event.year && event.make) return `${event.year} ${event.make} ${event.model || ""}`.trim();
  if (event.device_nickname) return event.device_nickname;
  return `Device ${event.imei}`;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function BouncieBehaviorPage() {
  const [hours, setHours] = useState("168");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery<{ success: boolean; data: DrivingEvent[] }>({
    queryKey: ["/api/bouncie/analytics/driving-events", hours],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/bouncie/analytics/driving-events?hours=${hours}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const { data: summaryData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/bouncie/analytics/driving-summary", hours],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/bouncie/analytics/driving-summary?hours=${hours}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const allEvents = data?.data ?? [];
  const events = severityFilter === "all" ? allEvents : allEvents.filter(e => e.severity === severityFilter);

  const highCount = allEvents.filter(e => e.severity === "high").length;
  const medCount = allEvents.filter(e => e.severity === "medium").length;
  const lowCount = allEvents.filter(e => e.severity === "low").length;

  // Count by type
  const typeCounts: Record<string, number> = {};
  allEvents.forEach(e => {
    typeCounts[e.event_type] = (typeCounts[e.event_type] || 0) + 1;
  });

  // Count by vehicle
  const vehicleCounts: Record<string, { name: string; count: number; high: number }> = {};
  allEvents.forEach(e => {
    const name = vehicleName(e);
    if (!vehicleCounts[e.device_id]) vehicleCounts[e.device_id] = { name, count: 0, high: 0 };
    vehicleCounts[e.device_id].count++;
    if (e.severity === "high") vehicleCounts[e.device_id].high++;
  });
  const vehicleRanking = Object.entries(vehicleCounts)
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
                <ShieldAlert className="w-6 h-6 text-primary" />
                Driving Behavior Analysis
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Hard braking, speeding, and harsh turn events</p>
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
          <Card className="border-red-200">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-red-600 uppercase tracking-wide font-medium">High Severity</p>
              <p className="text-3xl font-bold mt-1 text-red-600">{highCount}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-yellow-600 uppercase tracking-wide font-medium">Medium</p>
              <p className="text-3xl font-bold mt-1 text-yellow-600">{medCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Low</p>
              <p className="text-3xl font-bold mt-1 text-gray-400">{lowCount}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Events by type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Events by Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const Icon = EVENT_TYPE_ICONS[type] || AlertTriangle;
                const maxCount = Math.max(...Object.values(typeCounts));
                return (
                  <div key={type} className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{EVENT_TYPE_LABELS[type] || type.replace(/_/g, " ")}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(typeCounts).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No events in this period</p>
              )}
            </CardContent>
          </Card>

          {/* Top vehicles */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Top 5 Vehicles by Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vehicleRanking.map(([, info], i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{info.name}</span>
                      <span className="text-sm font-bold ml-2">{info.count}</span>
                    </div>
                    {info.high > 0 && (
                      <span className="text-xs text-red-600">{info.high} high severity</span>
                    )}
                  </div>
                  <Car className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
              {vehicleRanking.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Event Log */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Event Log ({events.length})</CardTitle>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="high">High Only</SelectItem>
                  <SelectItem value="medium">Medium Only</SelectItem>
                  <SelectItem value="low">Low Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading events…
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ShieldAlert className="w-10 h-10 opacity-30 mb-2" />
                <p className="text-sm">No driving events found</p>
                <p className="text-xs mt-1">Events are recorded automatically via Bouncie webhooks</p>
              </div>
            ) : (
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {events.map((event) => {
                  const Icon = EVENT_TYPE_ICONS[event.event_type] || AlertTriangle;
                  return (
                    <div key={event.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
                      <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                        event.severity === "high" ? "bg-red-100 text-red-600" :
                        event.severity === "medium" ? "bg-yellow-100 text-yellow-600" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {EVENT_TYPE_LABELS[event.event_type] || event.event_type.replace(/_/g, " ")}
                          </span>
                          {severityBadge(event.severity)}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{vehicleName(event)}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatTime(event.timestamp)}
                          </span>
                          {event.speed_mph && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Gauge className="w-3 h-3" />
                              {Number(event.speed_mph).toFixed(0)} mph
                              {event.speed_limit_mph ? ` / ${Number(event.speed_limit_mph)} limit` : ""}
                            </span>
                          )}
                          {event.g_force && (
                            <span className="text-xs text-muted-foreground">{Number(event.g_force).toFixed(2)}g</span>
                          )}
                        </div>
                        {event.address && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {event.address}
                          </p>
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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
