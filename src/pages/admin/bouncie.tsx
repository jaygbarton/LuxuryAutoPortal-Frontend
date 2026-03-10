import { useEffect } from "react";
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
} from "lucide-react";

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
  model: string | null;
  year: string | null;
  license_plate: string | null;
  color: string | null;
  displayStatus: string;
  liveStatus: {
    isConnected: boolean;
    speed: number;
    latitude: number | null;
    longitude: number | null;
    lastSeen: string | null;
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
  const model = v.model || v.liveStatus?.vehicleInfo?.model;
  const nick = v.device_nickname || v.liveStatus?.vehicleInfo?.nickname;

  if (year && make && model) return `${year} ${make} ${model}`;
  if (make && model) return `${make} ${model}`;
  if (nick) return nick;
  return `Device ${v.imei}`;
}

export default function BouncieFleetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle OAuth redirect result (bouncie_connected=true or bouncie_error=...)
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
      return res.json();
    },
    refetchInterval: 60000,
  });

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
      toast({
        title: "Sync Complete",
        description: `Synced ${result.data?.synced ?? 0} vehicle(s) from Bouncie.`,
      });
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
            {/* Connection status badge */}
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

            <Button
              size="sm"
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/bouncie/fleet-overview"] })}
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !conn?.connected}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing…" : "Sync from Bouncie"}
            </Button>
          </div>
        </div>

        {/* OAuth connection card — show unless there is a valid non-expired DB token */}
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

        {/* Connected via DB — show expiry + disconnect option */}
        {!connLoading && conn?.source === "database" && conn.connected && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm("Disconnect from Bouncie? Live tracking will stop.")) {
                  disconnectMutation.mutate();
                }
              }}
              disabled={disconnectMutation.isPending}
            >
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
                        <span className="text-xs text-muted-foreground font-mono">
                          IMEI: {v.imei}
                        </span>
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
                      </div>
                    </div>

                    {/* Location */}
                    {(v.liveStatus?.latitude || v.last_latitude) && (
                      <a
                        href={`https://www.google.com/maps?q=${v.liveStatus?.latitude || v.last_latitude},${v.liveStatus?.longitude || v.last_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <MapPin className="w-3 h-3" />
                        View Map
                      </a>
                    )}

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
