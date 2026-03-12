import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import {
  RefreshCw,
  MapPin,
  Car,
  Wifi,
  WifiOff,
  Navigation,
  Clock,
  Gauge,
  AlertCircle,
  CheckCircle2,
  Activity,
  Link2,
  Link2Off,
  Timer,
  Battery,
  BatteryLow,
  Route,
  BarChart3,
  ShieldAlert,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";

interface VehicleEntry {
  device_id: string;
  imei: string;
  device_nickname: string | null;
  car_id: string | null;
  is_active: boolean;
  status: string | null;
  last_seen: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_speed_mph: number | null;
  battery_level: number | null;
  odometer_miles: number | null;
  make: string | null;
  model: string | null | Record<string, any>;
  year: string | null;
  license_plate: string | null;
  color: string | null;
  displayStatus: string;
  liveStatus: {
    isRunning: boolean;
    speed: number;
    latitude: number | null;
    longitude: number | null;
    lastSeen: string | null;
    fuelLevel: number | null;
    odometer: number | null;
    vehicleInfo: {
      make: string | null;
      model: string | null;
      year: string | null;
      nickname: string | null;
    };
  } | null;
}

interface FleetOverview {
  summary: {
    total: number;
    online: number;
    offline: number;
    driving: number;
  };
  vehicles: VehicleEntry[];
  apiConnected: boolean;
}

interface ConnectionStatus {
  connected: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  expiresInMinutes: number | null;
  source: "database" | "env" | "none";
}

function statusColor(status: string) {
  switch (status) {
    case "driving": return "bg-blue-100 text-blue-800 border-blue-200";
    case "parked": return "bg-green-100 text-green-800 border-green-200";
    case "online": return "bg-green-100 text-green-800 border-green-200";
    case "offline": return "bg-gray-100 text-gray-600 border-gray-200";
    case "maintenance": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default: return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "driving": return <Navigation className="w-3 h-3" />;
    case "parked": return <CheckCircle2 className="w-3 h-3" />;
    case "online": return <Wifi className="w-3 h-3" />;
    case "offline": return <WifiOff className="w-3 h-3" />;
    default: return <Activity className="w-3 h-3" />;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "driving": return "Driving";
    case "parked": return "Parked";
    case "online": return "Online";
    case "offline": return "Offline";
    case "maintenance": return "Maintenance";
    default: return "Unknown";
  }
}

function formatLastSeen(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function vehicleDisplayName(v: VehicleEntry): string {
  const year = v.year || v.liveStatus?.vehicleInfo?.year;
  const make = v.make || v.liveStatus?.vehicleInfo?.make;
  const rawModel = v.model || v.liveStatus?.vehicleInfo?.model;
  const model = rawModel && typeof rawModel === "object" ? (rawModel as any).name : rawModel;
  const nick = v.liveStatus?.vehicleInfo?.nickname ||
    (v.device_nickname && v.device_nickname !== "[object Object]" ? v.device_nickname : null);

  if (year && make && model) return `${year} ${make} ${model}`;
  if (make && model) return `${make} ${model}`;
  if (nick) return nick;
  return `Device ${v.imei}`;
}

function BatteryIndicator({ level }: { level: number | null }) {
  if (level == null) return null;
  const pct = Math.round(level);
  const color = pct <= 20 ? "text-red-500" : pct <= 50 ? "text-yellow-500" : "text-green-500";
  const Icon = pct <= 20 ? BatteryLow : Battery;
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`} title={`Battery: ${pct}%`}>
      <Icon className="w-3 h-3" />
      {pct}%
    </span>
  );
}

// Lazy-load Leaflet map; smoothly updates existing markers rather than rebuilding
function FleetMap({ vehicles }: { vehicles: VehicleEntry[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  // keyed by device_id so we can update in-place
  const markerMapRef = useRef<Record<string, any>>({});
  const fittedRef = useRef(false);

  const vehiclesWithCoords = vehicles.filter(v => {
    const lat = v.liveStatus?.latitude ?? v.last_latitude;
    const lng = v.liveStatus?.longitude ?? v.last_longitude;
    return lat != null && lng != null;
  });

  const buildIcon = useCallback((L: any, status: string) => {
    const color = status === "driving" ? "#3b82f6"
      : status === "parked" || status === "online" ? "#22c55e"
      : "#9ca3af";
    return L.divIcon({
      html: `<div style="
        width:28px;height:28px;border-radius:50%;background:${color};
        border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        ${status === "driving" ? "animation:pulsePin 1.5s infinite;" : ""}
      ">
        <svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='white'>
          <path d='M5 11a7 7 0 1114 0c0 5.25-7 11-7 11S5 16.25 5 11z'/>
        </svg>
      </div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -30],
    });
  }, []);

  const buildPopup = useCallback((v: VehicleEntry, lat: number, lng: number) => {
    const name = vehicleDisplayName(v);
    const status = v.displayStatus;
    const speed = v.liveStatus?.speed ?? v.last_speed_mph ?? 0;
    const lastSeen = formatLastSeen(v.liveStatus?.lastSeen || v.last_seen);
    const color = status === "driving" ? "#3b82f6"
      : status === "parked" || status === "online" ? "#22c55e"
      : "#9ca3af";
    return `<div style="min-width:190px;font-family:system-ui;line-height:1.5">
      <strong style="font-size:13px">${name}</strong><br/>
      <span style="color:${color};font-weight:600">${statusLabel(status)}</span>
      ${Number(speed) > 0 ? ` &nbsp;·&nbsp; <b>${Number(speed).toFixed(0)} mph</b>` : ""}
      <br/><small style="color:#888">Last seen: ${lastSeen}</small>
      ${v.license_plate ? `<br/><small style="color:#888">Plate: ${v.license_plate}</small>` : ""}
      <br/><a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank"
        style="color:#3b82f6;font-size:12px">Open in Google Maps ↗</a>
    </div>`;
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current!).setView([36.1699, -115.1398], 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      const existingIds = new Set(Object.keys(markerMapRef.current));

      vehiclesWithCoords.forEach(v => {
        const lat = (v.liveStatus?.latitude ?? v.last_latitude) as number;
        const lng = (v.liveStatus?.longitude ?? v.last_longitude) as number;
        const icon = buildIcon(L, v.displayStatus);
        const popup = buildPopup(v, lat, lng);

        if (markerMapRef.current[v.device_id]) {
          // Smoothly move existing marker to new position
          markerMapRef.current[v.device_id].setLatLng([lat, lng]);
          markerMapRef.current[v.device_id].setIcon(icon);
          markerMapRef.current[v.device_id].setPopupContent(popup);
          existingIds.delete(v.device_id);
        } else {
          // New marker
          const marker = L.marker([lat, lng], { icon })
            .addTo(map)
            .bindPopup(popup);
          markerMapRef.current[v.device_id] = marker;
        }
      });

      // Remove markers for vehicles that disappeared
      existingIds.forEach(id => {
        map.removeLayer(markerMapRef.current[id]);
        delete markerMapRef.current[id];
      });

      // Fit bounds only on first load (don't auto-zoom on every refresh)
      const allMarkers = Object.values(markerMapRef.current);
      if (!fittedRef.current && allMarkers.length > 0) {
        const group = L.featureGroup(allMarkers);
        map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 14 });
        fittedRef.current = true;
      }
    });
  }, [vehicles, buildIcon, buildPopup]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerMapRef.current = {};
        fittedRef.current = false;
      }
    };
  }, []);

  if (vehiclesWithCoords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-muted/30 rounded-lg">
        <MapPin className="w-10 h-10 opacity-30 mb-2" />
        <p className="text-sm">No vehicle locations available</p>
        <p className="text-xs mt-1">Sync from Bouncie to get live coordinates</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes pulsePin { 0%,100%{opacity:1} 50%{opacity:0.55} }
      `}</style>
      <div ref={mapRef} style={{ height: "420px", width: "100%", borderRadius: "8px" }} />
    </>
  );
}

const LIVE_POLL_MS = 15_000; // poll every 15 s when tab is visible

export default function BouncieFleetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sseStatus, setSseStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const sseRef = useRef<EventSource | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // Handle OAuth redirect result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("bouncie_connected");
    const error = params.get("bouncie_error");
    if (connected === "true") {
      toast({ title: "Bouncie Connected", description: "Successfully connected to Bouncie. Live tracking is now active." });
      window.history.replaceState({}, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/connection-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/fleet-overview"] });
    } else if (error) {
      toast({ title: "Bouncie Connection Failed", description: `Error: ${error}`, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // SSE connection for real-time updates
  useEffect(() => {
    const connect = () => {
      if (sseRef.current) sseRef.current.close();
      setSseStatus("connecting");
      const es = new EventSource(buildApiUrl("/api/bouncie/sse"), { withCredentials: true });
      sseRef.current = es;

      es.addEventListener("connected", () => setSseStatus("connected"));
      es.addEventListener("fleet_event", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/bouncie/fleet-overview"] });
      });
      es.addEventListener("fleet_update", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/bouncie/fleet-overview"] });
      });
      es.onerror = () => {
        setSseStatus("disconnected");
        es.close();
        // Reconnect after 10s
        setTimeout(connect, 10000);
      };
    };

    connect();
    return () => {
      sseRef.current?.close();
    };
  }, []);

  const { data: connData, isLoading: connLoading } = useQuery<{ success: boolean; data: ConnectionStatus }>({
    queryKey: ["/api/bouncie/connection-status"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/bouncie/connection-status"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch connection status");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data, isLoading, error, isFetching } = useQuery<{ success: boolean; data: FleetOverview }>({
    queryKey: ["/api/bouncie/fleet-overview"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/bouncie/fleet-overview"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch fleet overview");
      const json = await res.json();
      setLastUpdated(new Date());
      setSecondsAgo(0);
      return json;
    },
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false,
  });

  // "X sec ago" counter — ticks every second
  useEffect(() => {
    if (!lastUpdated) return;
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/bouncie/sync-from-bouncie"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Sync failed");
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/fleet-overview"] });
      toast({ title: "Sync Complete", description: `Synced ${result.data?.synced ?? 0} vehicle(s) from Bouncie.` });
    },
    onError: (err: Error) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/bouncie/disconnect"), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/connection-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/fleet-overview"] });
      toast({ title: "Disconnected", description: "Bouncie connection removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const conn = connData?.data;
  const overview = data?.data;
  const summary = overview?.summary;
  const vehicles = overview?.vehicles ?? [];
  const activeTrips = vehicles.filter(v => v.displayStatus === "driving");

  const handleConnect = () => {
    window.location.href = buildApiUrl("/api/bouncie/connect");
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MapPin className="w-6 h-6 text-primary" />
              BOUNCIE Fleet Tracking
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Live GPS tracking for Golden Luxury Auto fleet vehicles
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live connection + last-updated indicator */}
            <span className={`flex items-center gap-1 text-xs font-medium ${
              sseStatus === "connected" ? "text-green-600" :
              sseStatus === "connecting" ? "text-yellow-600" :
              "text-gray-400"
            }`} title="Real-time connection status">
              <Zap className={`w-3 h-3 ${isFetching ? "animate-ping" : ""}`} />
              {sseStatus === "connected" ? "Live" : sseStatus === "connecting" ? "Connecting…" : "Offline"}
            </span>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground" title={`Last refreshed: ${lastUpdated.toLocaleTimeString()}`}>
                · updated {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
              </span>
            )}

            {/* Connection status */}
            {!connLoading && conn && (
              conn.connected ? (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {conn.source === "database" && conn.expiresInMinutes !== null
                    ? `Connected · expires in ${conn.expiresInMinutes}m`
                    : "API Connected"}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {conn.isExpired ? "Token Expired" : "Not Connected"}
                </span>
              )
            )}

            <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/bouncie/fleet-overview"] })} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || !conn?.connected}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing…" : "Sync from Bouncie"}
            </Button>
          </div>
        </div>

        {/* Quick nav to sub-pages */}
        <div className="flex gap-2 flex-wrap">
          <Link href="/admin/bouncie-trips">
            <Button size="sm" variant="outline" className="text-xs">
              <Route className="w-3.5 h-3.5 mr-1.5" />
              Trip History
            </Button>
          </Link>
          <Link href="/admin/bouncie-behavior">
            <Button size="sm" variant="outline" className="text-xs">
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
              Driving Behavior
            </Button>
          </Link>
          <Link href="/admin/bouncie-geofence">
            <Button size="sm" variant="outline" className="text-xs">
              <MapPin className="w-3.5 h-3.5 mr-1.5" />
              Geofence Reports
            </Button>
          </Link>
          <Link href="/admin/bouncie-analytics">
            <Button size="sm" variant="outline" className="text-xs">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              Analytics
            </Button>
          </Link>
        </div>

        {/* OAuth connection card */}
        {!connLoading && conn && !(conn.source === "database" && conn.connected) && (
          <Card className={conn.isExpired ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex gap-3">
                  {conn.isExpired
                    ? <Timer className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    : <Link2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className={`text-sm font-medium ${conn.isExpired ? "text-red-800" : "text-amber-800"}`}>
                      {conn.isExpired
                        ? "Bouncie token expired — reconnect to resume live tracking"
                        : conn.source === "env"
                          ? "Connect via OAuth to enable automatic token refresh"
                          : "Connect GLA to Bouncie to enable live GPS tracking"}
                    </p>
                    <p className={`text-sm mt-1 ${conn.isExpired ? "text-red-700" : "text-amber-700"}`}>
                      You'll be redirected to Bouncie to log in with <strong>goldenluxuryauto@gmail.com</strong>.
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={handleConnect} className="flex-shrink-0">
                  <Link2 className="w-4 h-4 mr-2" />
                  {conn.isExpired ? "Reconnect to Bouncie" : "Connect to Bouncie"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Disconnect button */}
        {!connLoading && conn?.source === "database" && conn.connected && (
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => { if (confirm("Disconnect from Bouncie? Live tracking will stop.")) disconnectMutation.mutate(); }}
              disabled={disconnectMutation.isPending}>
              <Link2Off className="w-3.5 h-3.5 mr-1.5" />
              Disconnect Bouncie
            </Button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Vehicles</p>
                  <p className="text-3xl font-bold mt-1">{summary?.total ?? "—"}</p>
                </div>
                <Car className="w-8 h-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Online</p>
                  <p className="text-3xl font-bold mt-1 text-green-600">{summary?.online ?? "—"}</p>
                </div>
                <Wifi className="w-8 h-8 text-green-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Driving Now</p>
                  <p className="text-3xl font-bold mt-1 text-blue-600">{summary?.driving ?? "—"}</p>
                </div>
                <Navigation className="w-8 h-8 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Offline</p>
                  <p className="text-3xl font-bold mt-1 text-gray-400">{summary?.offline ?? "—"}</p>
                </div>
                <WifiOff className="w-8 h-8 text-gray-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Trips Panel */}
        {activeTrips.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <Navigation className="w-4 h-4 animate-pulse" />
                Active Trips ({activeTrips.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <div className="flex flex-wrap gap-3">
                {activeTrips.map(v => (
                  <div key={v.device_id} className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                    <span className="font-medium">{vehicleDisplayName(v)}</span>
                    {v.liveStatus?.speed != null && v.liveStatus.speed > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Gauge className="w-3 h-3" />
                        {v.liveStatus.speed.toFixed(0)} mph
                      </span>
                    )}
                    {(v.liveStatus?.latitude || v.last_latitude) && (
                      <a
                        href={`https://www.google.com/maps?q=${v.liveStatus?.latitude || v.last_latitude},${v.liveStatus?.longitude || v.last_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Map
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live Map */}
        {vehicles.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Live Fleet Map
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <FleetMap vehicles={vehicles} />
            </CardContent>
          </Card>
        )}

        {/* Vehicle List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Fleet Vehicles</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading fleet data…
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-16 text-destructive gap-2">
                <AlertCircle className="w-5 h-5" />
                Failed to load fleet data. Please try again.
              </div>
            ) : !overview?.vehicles?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <MapPin className="w-12 h-12 opacity-30" />
                <div className="text-center">
                  <p className="font-medium">No vehicles found</p>
                  <p className="text-sm mt-1">
                    {conn?.source === "database" && conn.connected
                      ? `Click "Sync from Bouncie" to pull your fleet devices.`
                      : "Connect to Bouncie first, then sync your fleet devices."}
                  </p>
                </div>
                {!(conn?.source === "database" && conn?.connected) && (
                  <Button size="sm" onClick={handleConnect}>
                    <Link2 className="w-4 h-4 mr-2" />
                    Connect to Bouncie
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {overview.vehicles.map((v) => (
                  <div key={v.device_id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors">
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      v.displayStatus === "driving" ? "bg-blue-500 animate-pulse" :
                      v.displayStatus === "parked" || v.displayStatus === "online" ? "bg-green-500" :
                      "bg-gray-300"
                    }`} />

                    {/* Vehicle info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{vehicleDisplayName(v)}</span>
                        {v.license_plate && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                            {v.license_plate}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">IMEI: {v.imei}</span>
                        {v.last_seen && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatLastSeen(v.liveStatus?.lastSeen || v.last_seen)}
                          </span>
                        )}
                        {(v.liveStatus?.speed != null && v.liveStatus.speed > 0) && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Gauge className="w-3 h-3" />
                            {v.liveStatus.speed.toFixed(0)} mph
                          </span>
                        )}
                        {v.odometer_miles != null && (
                          <span className="text-xs text-muted-foreground">
                            {v.odometer_miles.toLocaleString()} mi
                          </span>
                        )}
                        <BatteryIndicator level={v.battery_level} />
                      </div>
                    </div>

                    {/* Location link */}
                    {(v.liveStatus?.latitude || v.last_latitude) && (
                      <a
                        href={`https://www.google.com/maps?q=${v.liveStatus?.latitude || v.last_latitude},${v.liveStatus?.longitude || v.last_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <MapPin className="w-3 h-3" />
                        Map
                      </a>
                    )}

                    {/* Trip history link */}
                    <Link href={`/admin/bouncie-trips?deviceId=${v.device_id}`}>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary cursor-pointer">
                        <Route className="w-3 h-3" />
                        Trips
                      </span>
                    </Link>

                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${statusColor(v.displayStatus)}`}>
                      {statusIcon(v.displayStatus)}
                      {statusLabel(v.displayStatus)}
                    </span>
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
