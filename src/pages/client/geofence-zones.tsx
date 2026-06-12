import "leaflet/dist/leaflet.css";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Pencil,
  Trash2,
  Circle,
  CheckCircle2,
  XCircle,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";

// ── Types ──────────────────────────────────────────────────────────────────

interface ClientGeofenceZone {
  id: string;
  name: string;
  description: string | null;
  zone_category: string;
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  active: boolean;
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  created_at: string;
}

const RADIUS_PRESETS = [
  { label: "100 m", value: 100 },
  { label: "250 m", value: 250 },
  { label: "500 m", value: 500 },
  { label: "1 km", value: 1000 },
  { label: "2 km", value: 2000 },
];

function metersToFeet(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// ── Mini Map ───────────────────────────────────────────────────────────────

interface MiniMapProps {
  zones: ClientGeofenceZone[];
  onClickMap?: (lat: number, lng: number) => void;
  pendingCircle?: { lat: number; lng: number; radiusMeters: number } | null;
  height?: string;
}

function MiniMap({ zones, onClickMap, pendingCircle, height = "300px" }: MiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const circleLayersRef = useRef<any[]>([]);
  const pendingLayerRef = useRef<any>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const onClickMapRef = useRef(onClickMap);
  onClickMapRef.current = onClickMap;

  // Effect 1: initialize map once, destroy only on unmount.
  useEffect(() => {
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      if (mapInstanceRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      leafletRef.current = L;
      const map = L.map(mapRef.current!, { zoomControl: true }).setView([40.7608, -111.8910], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;

      roRef.current = new ResizeObserver(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      });
      roRef.current.observe(mapRef.current!);

      map.on("click", (e: any) => {
        onClickMapRef.current?.(e.latlng.lat, e.latlng.lng);
      });
    });

    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 2: update circles/layers when data changes — never destroys the map.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    circleLayersRef.current.forEach((l) => map.removeLayer(l));
    circleLayersRef.current = [];

    const activeLayers: any[] = [];
    zones.filter((z) => z.active).forEach((zone) => {
      if (zone.center_lat && zone.center_lng && zone.radius_meters) {
        const circle = L.circle([zone.center_lat, zone.center_lng], {
          radius: zone.radius_meters,
          color: "#8b5cf6",
          fillColor: "#8b5cf6",
          fillOpacity: 0.12,
          weight: 2,
        }).addTo(map).bindPopup(`<b>${zone.name}</b><br/>${metersToFeet(zone.radius_meters)} radius`);
        circleLayersRef.current.push(circle);
        activeLayers.push(circle);
      }
    });

    if (activeLayers.length > 0 && !pendingCircle) {
      try {
        const group = L.featureGroup(activeLayers);
        map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 14 });
      } catch (_) {}
    }

    if (pendingLayerRef.current) { map.removeLayer(pendingLayerRef.current); pendingLayerRef.current = null; }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, pendingCircle]);

  return <div ref={mapRef} style={{ height, width: "100%", borderRadius: "8px", zIndex: 0 }} />;
}

// ── Zone Form Modal ────────────────────────────────────────────────────────

interface ZoneFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  loading: boolean;
  initial?: ClientGeofenceZone | null;
  zones: ClientGeofenceZone[];
}

function ZoneFormModal({ open, onClose, onSave, loading, initial, zones }: ZoneFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [centerLat, setCenterLat] = useState<number | null>(initial?.center_lat != null ? Number(initial.center_lat) : null);
  const [centerLng, setCenterLng] = useState<number | null>(initial?.center_lng != null ? Number(initial.center_lng) : null);
  const [radiusMeters, setRadiusMeters] = useState<number>(initial?.radius_meters ? Number(initial.radius_meters) : 500);
  const [alertOnEntry, setAlertOnEntry] = useState<boolean>(!!initial?.alert_on_entry);
  const [alertOnExit, setAlertOnExit] = useState<boolean>(!!initial?.alert_on_exit);

  useEffect(() => {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setCenterLat(initial?.center_lat != null ? Number(initial.center_lat) : null);
    setCenterLng(initial?.center_lng != null ? Number(initial.center_lng) : null);
    setRadiusMeters(initial?.radius_meters ? Number(initial.radius_meters) : 500);
    setAlertOnEntry(!!initial?.alert_on_entry);
    setAlertOnExit(!!initial?.alert_on_exit);
  }, [open, initial]);

  const canSave = name.trim().length > 0 && centerLat !== null && centerLng !== null && radiusMeters > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Zone" : "Add Zone"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cz-name">Zone Name *</Label>
              <Input id="cz-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Home" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cz-desc">Description</Label>
              <Textarea id="cz-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes" rows={2} />
            </div>

            {/* Alert toggles */}
            <div className="space-y-2">
              <Label>Alerts (email + in-app)</Label>
              <div className="rounded-md bg-purple-50 border border-purple-200 px-3 py-2 text-xs text-purple-700 mb-2">
                <Shield className="w-3.5 h-3.5 inline mr-1" />
                When your car leaves this zone without an active rental, you'll receive a theft-detection alert.
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={alertOnEntry} onChange={(e) => setAlertOnEntry(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
                  <span className="text-sm"><span className="font-medium">Alert on Entry</span><span className="text-muted-foreground ml-1">— notify me when my car enters</span></span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={alertOnExit} onChange={(e) => setAlertOnExit(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
                  <span className="text-sm"><span className="font-medium">Alert on Exit</span><span className="text-muted-foreground ml-1">— notify me when my car leaves (theft detection)</span></span>
                </label>
              </div>
            </div>

            {/* Radius */}
            <div className="space-y-1.5">
              <Label>Radius</Label>
              <div className="flex flex-wrap gap-1.5">
                {RADIUS_PRESETS.map((p) => (
                  <button key={p.value} type="button" onClick={() => setRadiusMeters(p.value)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${radiusMeters === p.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={50} max={10000} value={radiusMeters} onChange={(e) => setRadiusMeters(Number(e.target.value))} className="w-28 text-sm" />
                <span className="text-sm text-muted-foreground">meters</span>
              </div>
            </div>

            {centerLat !== null && centerLng !== null ? (
              <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">Center point set ✓</p>
                <p>{centerLat.toFixed(6)}, {centerLng.toFixed(6)}</p>
                <button type="button" className="text-primary underline text-xs mt-1" onClick={() => { setCenterLat(null); setCenterLng(null); }}>
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

          <div className="rounded-lg overflow-hidden border" style={{ height: 320 }}>
            <MiniMap
              zones={zones.filter((z) => z.active && (!initial || z.id !== initial.id))}
              onClickMap={(lat, lng) => { setCenterLat(lat); setCenterLng(lng); }}
              pendingCircle={centerLat !== null && centerLng !== null ? { lat: centerLat, lng: centerLng, radiusMeters } : null}
              height="280px"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={() => onSave({ name, description: description || undefined, center_lat: centerLat, center_lng: centerLng, radius_meters: radiusMeters, alert_on_entry: alertOnEntry, alert_on_exit: alertOnExit, zone_category: "client" })} disabled={!canSave || loading}>
            {loading ? "Saving…" : initial ? "Save Changes" : "Create Zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ClientGeofenceZonesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editZone, setEditZone] = useState<ClientGeofenceZone | null>(null);
  const [deleteZone, setDeleteZone] = useState<ClientGeofenceZone | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ success: boolean; data: ClientGeofenceZone[] }>({
    queryKey: ["/api/client/geofences"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/client/geofences"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch zones");
      return res.json();
    },
  });

  const zones = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch(buildApiUrl("/api/client/geofences"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to create zone"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/geofences"] });
      setShowForm(false);
      toast({ title: "Zone created", description: "Your geofence zone is now active." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const res = await fetch(buildApiUrl(`/api/client/geofences/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to update zone"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/geofences"] });
      setShowForm(false);
      setEditZone(null);
      toast({ title: "Zone updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(buildApiUrl(`/api/client/geofences/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to delete zone"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/geofences"] });
      setDeleteZone(null);
      toast({ title: "Zone deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(buildApiUrl(`/api/client/geofences/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed to update zone");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/client/geofences"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6 p-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/client/my-car-tracking">
              <Button size="sm" variant="ghost" className="text-muted-foreground w-fit">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Car Tracking
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 leading-tight">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 flex-shrink-0" />
                <span className="truncate">My Geofence Zones</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Set zones for your home or office — get alerted if your car leaves unexpectedly
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => { setEditZone(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Zone
          </Button>
        </div>

        {/* Explainer */}
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm text-purple-800">
                <p className="font-semibold">Theft Detection Zones</p>
                <p>Draw a virtual boundary around your home, office, or any location. If your car leaves the zone without an active rental booking, you'll receive an email alert immediately — giving you an early warning of unauthorized use.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zone map overview */}
        {zones.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Zone Map</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <MiniMap zones={zones} height="320px" />
            </CardContent>
          </Card>
        )}

        {/* Zone list */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading zones…
              </div>
            ) : zones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <Circle className="w-12 h-12 opacity-20 mb-3" />
                <p className="text-sm font-medium">No zones yet</p>
                <p className="text-xs mt-1">Add your home or office to start theft detection alerts</p>
                <Button size="sm" className="mt-4" onClick={() => { setEditZone(null); setShowForm(true); }}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Zone
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {zones.map((zone) => (
                  <div key={zone.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${zone.active ? "bg-purple-100 text-purple-600" : "bg-muted text-muted-foreground"}`}>
                      <Circle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{zone.name}</span>
                        <Badge variant={zone.active ? "default" : "secondary"} className="text-xs h-4 px-1.5">
                          {zone.active ? "Active" : "Inactive"}
                        </Badge>
                        {zone.alert_on_entry && (
                          <Badge className="text-xs h-4 px-1.5 bg-amber-500/15 text-amber-600 border-amber-500/30" variant="outline">
                            📍 Entry
                          </Badge>
                        )}
                        {zone.alert_on_exit && (
                          <Badge className="text-xs h-4 px-1.5 bg-purple-500/15 text-purple-600 border-purple-500/30" variant="outline">
                            🚨 Exit
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {zone.radius_meters && <span>{metersToFeet(zone.radius_meters)} radius</span>}
                        {zone.center_lat && zone.center_lng && (
                          <span>{Number(zone.center_lat).toFixed(4)}, {Number(zone.center_lng).toFixed(4)}</span>
                        )}
                      </div>
                      {zone.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{zone.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={zone.active ? "Deactivate" : "Activate"}
                        onClick={() => toggleActiveMutation.mutate({ id: zone.id, active: !zone.active })}>
                        {zone.active
                          ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                          : <XCircle className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit"
                        onClick={() => { setEditZone(zone); setShowForm(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Delete"
                        onClick={() => setDeleteZone(zone)}>
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

      <ZoneFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditZone(null); }}
        onSave={(data) => {
          if (editZone) updateMutation.mutate({ id: editZone.id, body: data });
          else createMutation.mutate(data);
        }}
        loading={isSaving}
        initial={editZone}
        zones={zones}
      />

      <AlertDialog open={!!deleteZone} onOpenChange={(v) => { if (!v) setDeleteZone(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteZone?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteZone && deleteMutation.mutate(deleteZone.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientPageLinks />
    </AdminLayout>
  );
}
