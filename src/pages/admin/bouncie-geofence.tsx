import "leaflet/dist/leaflet.css";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  RefreshCw,
  ArrowLeft,
  LogIn,
  LogOut,
  Clock,
  Car,
  Plus,
  Pencil,
  Trash2,
  Circle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Link } from "wouter";
import { BouncieConnectionBanner } from "@/components/admin/BouncieConnectionBanner";

// ── Types ──────────────────────────────────────────────────────────────────

interface GeofenceZone {
  id: string;
  name: string;
  description: string | null;
  type: "circle" | "polygon";
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  polygon_coords: any[] | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface GeofenceEvent {
  id: string;
  device_id: string;
  imei?: string;
  device_nickname: string | null;
  car_id: string | null;
  make: string | null;
  model: string | null;
  year?: string | null;
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

const RADIUS_PRESETS = [
  { label: "100 m", value: 100 },
  { label: "250 m", value: 250 },
  { label: "500 m", value: 500 },
  { label: "1 km", value: 1000 },
  { label: "2 km", value: 2000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
];

function vehicleName(event: GeofenceEvent): string {
  if (event.year && event.make) return `${event.year} ${event.make} ${event.model || ""}`.trim();
  if (event.make) return `${event.make} ${event.model || ""}`.trim();
  if (event.device_nickname) return event.device_nickname;
  return `Device ${event.imei || event.device_id}`;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metersToFeet(m: number): string {
  return m >= 1000
    ? `${(m / 1000).toFixed(1)} km`
    : `${Math.round(m)} m`;
}

// ── Zone Map (Leaflet) ─────────────────────────────────────────────────────

interface ZoneMapProps {
  zones: GeofenceZone[];
  onClickMap?: (lat: number, lng: number) => void;
  pendingCircle?: { lat: number; lng: number; radiusMeters: number } | null;
  height?: string;
}

function ZoneMap({ zones, onClickMap, pendingCircle, height = "400px" }: ZoneMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const circleLayersRef = useRef<any[]>([]);
  const pendingLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current!).setView([40.7608, -111.8910], 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        mapInstanceRef.current = map;

        if (onClickMap) {
          map.on("click", (e: any) => {
            onClickMap(e.latlng.lat, e.latlng.lng);
          });
        }
      }

      const map = mapInstanceRef.current;

      // Remove old zone circles
      circleLayersRef.current.forEach((l) => map.removeLayer(l));
      circleLayersRef.current = [];

      // Draw active zones
      const activeCounts: [number, number][] = [];
      zones.filter((z) => z.active).forEach((zone) => {
        if (zone.type === "circle" && zone.center_lat && zone.center_lng && zone.radius_meters) {
          const circle = L.circle([zone.center_lat, zone.center_lng], {
            radius: zone.radius_meters,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
            weight: 2,
          })
            .addTo(map)
            .bindPopup(`<b>${zone.name}</b><br/>${metersToFeet(zone.radius_meters)} radius`);
          circleLayersRef.current.push(circle);
          activeCounts.push([zone.center_lat, zone.center_lng]);
        }
      });

      // Fit to zones if any
      if (activeCounts.length > 0 && !pendingCircle) {
        try {
          const group = L.featureGroup(circleLayersRef.current);
          map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 14 });
        } catch (_) {}
      }

      // Draw pending circle (while user is placing a new zone)
      if (pendingLayerRef.current) {
        map.removeLayer(pendingLayerRef.current);
        pendingLayerRef.current = null;
      }
      if (pendingCircle) {
        const pending = L.circle([pendingCircle.lat, pendingCircle.lng], {
          radius: pendingCircle.radiusMeters,
          color: "#f59e0b",
          fillColor: "#f59e0b",
          fillOpacity: 0.18,
          weight: 2,
          dashArray: "6 4",
        }).addTo(map);
        pendingLayerRef.current = pending;
        map.setView([pendingCircle.lat, pendingCircle.lng], 14);
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, pendingCircle]);

  return <div ref={mapRef} style={{ height, width: "100%", borderRadius: "8px", zIndex: 0 }} />;
}

// ── Zone Form Modal ────────────────────────────────────────────────────────

interface ZoneFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<GeofenceZone>) => void;
  loading: boolean;
  initial?: GeofenceZone | null;
  zones: GeofenceZone[];
}

function ZoneFormModal({ open, onClose, onSave, loading, initial, zones }: ZoneFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [centerLat, setCenterLat] = useState<number | null>(initial?.center_lat ?? null);
  const [centerLng, setCenterLng] = useState<number | null>(initial?.center_lng ?? null);
  const [radiusMeters, setRadiusMeters] = useState<number>(initial?.radius_meters ?? 500);

  // Reset on open/initial change
  useEffect(() => {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setCenterLat(initial?.center_lat ?? null);
    setCenterLng(initial?.center_lng ?? null);
    setRadiusMeters(initial?.radius_meters ?? 500);
  }, [open, initial]);

  const handleMapClick = (lat: number, lng: number) => {
    setCenterLat(lat);
    setCenterLng(lng);
  };

  const handleSave = () => {
    onSave({
      name,
      description: description || undefined,
      type: "circle",
      center_lat: centerLat ?? undefined,
      center_lng: centerLng ?? undefined,
      radius_meters: radiusMeters,
    });
  };

  const canSave = name.trim().length > 0 && centerLat !== null && centerLng !== null && radiusMeters > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Zone" : "Add Geofence Zone"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {/* Left: form fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="zone-name">Zone Name *</Label>
              <Input
                id="zone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. GLA Headquarters"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zone-desc">Description</Label>
              <Textarea
                id="zone-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes about this zone"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Radius</Label>
              <div className="flex flex-wrap gap-1.5">
                {RADIUS_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setRadiusMeters(p.value)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      radiusMeters === p.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={50}
                  max={50000}
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="w-28 text-sm"
                />
                <span className="text-sm text-muted-foreground">meters</span>
              </div>
            </div>

            {centerLat !== null && centerLng !== null ? (
              <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">Center point set ✓</p>
                <p>{centerLat.toFixed(6)}, {centerLng.toFixed(6)}</p>
                <button
                  type="button"
                  className="text-primary underline text-xs mt-1"
                  onClick={() => { setCenterLat(null); setCenterLng(null); }}
                >
                  Clear and re-pick
                </button>
              </div>
            ) : (
              <div className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground text-center">
                <MapPin className="w-4 h-4 mx-auto mb-1 opacity-50" />
                Click anywhere on the map to set the zone center
              </div>
            )}
          </div>

          {/* Right: mini map */}
          <div className="rounded-lg overflow-hidden border" style={{ minHeight: 280 }}>
            <ZoneMap
              zones={zones.filter((z) => z.active && (!initial || z.id !== initial.id))}
              onClickMap={handleMapClick}
              pendingCircle={
                centerLat !== null && centerLng !== null
                  ? { lat: centerLat, lng: centerLng, radiusMeters }
                  : null
              }
              height="280px"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || loading}>
            {loading ? "Saving…" : initial ? "Save Changes" : "Create Zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function BouncieGeofencePage() {
  const [tab, setTab] = useState<"zones" | "events">("zones");
  const [hours, setHours] = useState("168");
  const [typeFilter, setTypeFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editZone, setEditZone] = useState<GeofenceZone | null>(null);
  const [deleteZone, setDeleteZone] = useState<GeofenceZone | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Zones query ──
  const { data: zonesData, isLoading: zonesLoading, refetch: refetchZones } = useQuery<{ success: boolean; data: GeofenceZone[] }>({
    queryKey: ["/api/bouncie/geofences"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/bouncie/geofences"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch zones");
      return res.json();
    },
  });

  // ── Events query ──
  const { data, isLoading: eventsLoading, refetch: refetchEvents, isFetching } = useQuery<{ success: boolean; data: GeofenceEvent[] }>({
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

  const zones = zonesData?.data ?? [];
  const allEvents = data?.data ?? [];

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (body: Partial<GeofenceZone>) => {
      const res = await fetch(buildApiUrl("/api/bouncie/geofences"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to create zone"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/geofences"] });
      setShowForm(false);
      toast({ title: "Zone created", description: "Geofence zone added successfully." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<GeofenceZone> }) => {
      const res = await fetch(buildApiUrl(`/api/bouncie/geofences/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to update zone"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/geofences"] });
      setShowForm(false);
      setEditZone(null);
      toast({ title: "Zone updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(buildApiUrl(`/api/bouncie/geofences/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to delete zone"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bouncie/geofences"] });
      setDeleteZone(null);
      toast({ title: "Zone deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(buildApiUrl(`/api/bouncie/geofences/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed to update zone");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bouncie/geofences"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Derived event data ──
  const zoneNames = Array.from(new Set(allEvents.map((e) => e.geofence_name).filter(Boolean))) as string[];
  const filteredEvents = allEvents.filter((e) => {
    if (typeFilter !== "all" && e.event_type !== typeFilter) return false;
    if (zoneFilter !== "all" && e.geofence_name !== zoneFilter) return false;
    return true;
  });
  const entryCount = allEvents.filter((e) => e.event_type === "entry").length;
  const exitCount = allEvents.filter((e) => e.event_type === "exit").length;

  const zoneCounts: Record<string, { entries: number; exits: number }> = {};
  allEvents.forEach((e) => {
    const zone = e.geofence_name || "Unknown";
    if (!zoneCounts[zone]) zoneCounts[zone] = { entries: 0, exits: 0 };
    if (e.event_type === "entry") zoneCounts[zone].entries++;
    else zoneCounts[zone].exits++;
  });
  const topZones = Object.entries(zoneCounts)
    .sort((a, b) => (b[1].entries + b[1].exits) - (a[1].entries + a[1].exits))
    .slice(0, 8);

  const vehicleCounts: Record<string, { name: string; count: number }> = {};
  allEvents.forEach((e) => {
    const name = vehicleName(e);
    if (!vehicleCounts[e.device_id]) vehicleCounts[e.device_id] = { name, count: 0 };
    vehicleCounts[e.device_id].count++;
  });
  const topVehicles = Object.entries(vehicleCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
                <MapPin className="w-6 h-6 text-primary" />
                Geofence
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Manage zones and review entry/exit activity</p>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 border-b">
          {(["zones", "events"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "zones" ? `Manage Zones (${zones.length})` : `Event Log (${allEvents.length})`}
            </button>
          ))}
        </div>

        {/* ── TAB: Manage Zones ── */}
        {tab === "zones" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {zones.filter((z) => z.active).length} active zone{zones.filter((z) => z.active).length !== 1 ? "s" : ""}
              </p>
              <Button
                size="sm"
                onClick={() => { setEditZone(null); setShowForm(true); }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Zone
              </Button>
            </div>

            {/* Zone map overview */}
            {zones.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Zone Map</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <ZoneMap zones={zones} height="360px" />
                </CardContent>
              </Card>
            )}

            {/* Zone list */}
            <Card>
              <CardContent className="p-0">
                {zonesLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading zones…
                  </div>
                ) : zones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                    <Circle className="w-12 h-12 opacity-20 mb-3" />
                    <p className="text-sm font-medium">No geofence zones yet</p>
                    <p className="text-xs mt-1">Click "Add Zone" to create your first zone</p>
                    <Button
                      size="sm"
                      className="mt-4"
                      onClick={() => { setEditZone(null); setShowForm(true); }}
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add Zone
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {zones.map((zone) => (
                      <div key={zone.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          zone.active ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground"
                        }`}>
                          <Circle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{zone.name}</span>
                            <Badge variant={zone.active ? "default" : "secondary"} className="text-xs h-4 px-1.5">
                              {zone.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span className="capitalize">{zone.type}</span>
                            {zone.type === "circle" && zone.radius_meters && (
                              <span>{metersToFeet(zone.radius_meters)} radius</span>
                            )}
                            {zone.center_lat && zone.center_lng && (
                              <span>{Number(zone.center_lat).toFixed(4)}, {Number(zone.center_lng).toFixed(4)}</span>
                            )}
                          </div>
                          {zone.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{zone.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title={zone.active ? "Deactivate zone" : "Activate zone"}
                            onClick={() => toggleActiveMutation.mutate({ id: zone.id, active: !zone.active })}
                          >
                            {zone.active
                              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                              : <XCircle className="w-4 h-4 text-muted-foreground" />
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Edit zone"
                            onClick={() => { setEditZone(zone); setShowForm(true); }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            title="Delete zone"
                            onClick={() => setDeleteZone(zone)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB: Event Log ── */}
        {tab === "events" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div />
              <div className="flex items-center gap-2">
                <Select value={hours} onValueChange={setHours}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => refetchEvents()} disabled={isFetching}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Events</p>
                <p className="text-3xl font-bold mt-1">{allEvents.length}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5 pb-4">
                <p className="text-xs text-green-600 uppercase tracking-wide font-medium">Entries</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{entryCount}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5 pb-4">
                <p className="text-xs text-orange-600 uppercase tracking-wide font-medium">Exits</p>
                <p className="text-3xl font-bold mt-1 text-orange-600">{exitCount}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Unique Zones</p>
                <p className="text-3xl font-bold mt-1">{zoneNames.length}</p>
              </CardContent></Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Activity by zone */}
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
                          <div className="bg-green-400 rounded-full" style={{ width: `${(counts.entries / total) * (total / maxTotal) * 100}%` }} title={`${counts.entries} entries`} />
                          <div className="bg-orange-400 rounded-full" style={{ width: `${(counts.exits / total) * (total / maxTotal) * 100}%` }} title={`${counts.exits} exits`} />
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> {counts.entries} in</span>
                          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> {counts.exits} out</span>
                        </div>
                      </div>
                    );
                  })}
                  {topZones.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No events in this period</p>}
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
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                      <div className="flex-1"><span className="text-sm font-medium">{info.name}</span></div>
                      <Badge variant="secondary" className="text-xs">{info.count} events</Badge>
                      <Car className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                  {topVehicles.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data available</p>}
                </CardContent>
              </Card>
            </div>

            {/* Event log */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-semibold">Event Log ({filteredEvents.length})</CardTitle>
                  <div className="flex gap-2">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="entry">Entry Only</SelectItem>
                        <SelectItem value="exit">Exit Only</SelectItem>
                      </SelectContent>
                    </Select>
                    {zoneNames.length > 0 && (
                      <Select value={zoneFilter} onValueChange={setZoneFilter}>
                        <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All Zones" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Zones</SelectItem>
                          {zoneNames.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {eventsLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading events…
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MapPin className="w-10 h-10 opacity-30 mb-2" />
                    <p className="text-sm">No geofence events found</p>
                    <p className="text-xs mt-1">Configure zones and Bouncie webhooks to track entry/exit activity</p>
                  </div>
                ) : (
                  <div className="divide-y max-h-[500px] overflow-y-auto">
                    {filteredEvents.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
                        <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${event.event_type === "entry" ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"}`}>
                          {event.event_type === "entry" ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
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
                              <Clock className="w-3 h-3" />{formatTime(event.timestamp)}
                            </span>
                            {event.speed_mph != null && (
                              <span className="text-xs text-muted-foreground">{Number(event.speed_mph).toFixed(0)} mph</span>
                            )}
                          </div>
                          {event.address && <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.address}</p>}
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
        )}
      </div>

      {/* Zone form modal */}
      <ZoneFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditZone(null); }}
        onSave={(data) => {
          if (editZone) {
            updateMutation.mutate({ id: editZone.id, body: data });
          } else {
            createMutation.mutate(data);
          }
        }}
        loading={isSaving}
        initial={editZone}
        zones={zones}
      />

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteZone} onOpenChange={(v) => { if (!v) setDeleteZone(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteZone?.name}</strong>? This cannot be undone.
              Existing geofence event logs will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteZone && deleteMutation.mutate(deleteZone.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
