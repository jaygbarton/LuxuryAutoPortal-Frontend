import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import {
  MapPin, Car, Clock, Gauge, Battery,
  Search, X, Fuel, Activity, Layers, Map as MapIcon,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────── */
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
  car_photo_url: string | null;
  vin: string | null;
  displayStatus: string;
  // Canonical resolved coords — backend already applied live-API → DB fallback.
  latitude: number | null;
  longitude: number | null;
  speed: number;
  last_seen_resolved: string | null;
  liveStatus: {
    isRunning: boolean;
    speed: number;
    latitude: number | null;
    longitude: number | null;
    lastSeen: string | null;
    fuelLevel: number | null;
    odometer: number | null;
    vehicleInfo: { make: string | null; model: string | null; year: string | null; nickname: string | null };
  } | null;
}
interface FleetOverview {
  summary: { total: number; online: number; offline: number; driving: number };
  vehicles: VehicleEntry[];
  apiConnected: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
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

function vehicleInitials(v: VehicleEntry): string {
  const name = vehicleDisplayName(v);
  const words = name.split(/[\s\-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || "?";
}

function vehicleSubline(v: VehicleEntry): string {
  const year = v.year || v.liveStatus?.vehicleInfo?.year;
  const make = v.make || v.liveStatus?.vehicleInfo?.make;
  return [year, make ? make.toUpperCase() : null].filter(Boolean).join(" ");
}

function formatLastSeen(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function getStatusInfo(status: string) {
  switch (status) {
    case "driving":
      return { label: "Driving", color: "#22c55e", bg: "bg-green-500", textClass: "text-green-400" };
    case "parked":
    case "online":
      return { label: status === "parked" ? "Parked" : "Online", color: "#3b82f6", bg: "bg-blue-500", textClass: "text-blue-400" };
    default:
      return { label: "Offline", color: "#6b7280", bg: "bg-gray-500", textClass: "text-gray-500" };
  }
}

function slideMarkerTo(marker: any, newLat: number, newLng: number, durationMs = 1500) {
  const start = marker.getLatLng();
  const startTime = performance.now();
  function step(now: number) {
    const t = Math.min((now - startTime) / durationMs, 1);
    const ease = t * (2 - t);
    marker.setLatLng([
      start.lat + (newLat - start.lat) * ease,
      start.lng + (newLng - start.lng) * ease,
    ]);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ─── Vehicle Avatar ─────────────────────────────────────────────── */
function VehicleAvatar({ v, size = 48 }: { v: VehicleEntry; size?: number }) {
  const [err, setErr] = useState(false);
  const rawPhoto = !err ? v.car_photo_url : null;
  const photo = rawPhoto ? getProxiedImageUrl(rawPhoto) : null;
  const si = getStatusInfo(v.displayStatus);
  const initials = vehicleInitials(v);

  if (photo) {
    return (
      <img
        src={photo} alt={vehicleDisplayName(v)} onError={() => setErr(true)}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: si.color, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 700, fontSize: size * 0.3,
    }}>
      {initials}
    </div>
  );
}

/* ─── Vehicle Detail Panel ───────────────────────────────────────── */
function VehicleDetailPanel({ v, onClose }: { v: VehicleEntry; onClose: () => void }) {
  const si = getStatusInfo(v.displayStatus);
  const speed = Number(v.speed ?? 0);
  const lat = v.latitude;
  const lng = v.longitude;
  const lastSeen = formatLastSeen(v.last_seen_resolved ?? v.last_seen);
  const odometer = v.liveStatus?.odometer ?? v.odometer_miles;
  const fuelLevel = v.liveStatus?.fuelLevel;
  const plate = v.license_plate;
  const name = vehicleDisplayName(v);

  return (
    <div
      className="absolute bottom-4 right-4 z-[1000] w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 text-gray-900 overflow-hidden"
      style={{ animation: "slideUp .25s ease-out" }}
    >
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }`}</style>
      <div className="flex items-start gap-3 p-4 pb-3">
        <VehicleAvatar v={v} size={52} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold truncate leading-tight">{name}</h3>
          {plate && <p className="text-xs text-gray-500 mt-0.5">{plate}</p>}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: si.color + "18", color: si.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: si.color }} />
              {si.label}
            </span>
            {si.label === "Driving" && speed > 0 && (
              <span className="text-[11px] font-bold text-green-600 flex items-center gap-0.5">
                <Gauge className="w-3 h-3" />{speed.toFixed(0)} mph
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors p-1 -mt-1 -mr-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-px bg-gray-100 mx-4 rounded-lg overflow-hidden mb-3">
        {[
          { icon: Clock, value: lastSeen, label: "Last seen" },
          { icon: Activity, value: odometer != null ? `${Number(odometer).toLocaleString()}` : "—", label: "Miles" },
          { icon: fuelLevel != null ? Fuel : Battery, value: fuelLevel != null ? `${Math.round(fuelLevel)}%` : (v.battery_level != null ? `${Math.round(v.battery_level)}%` : "—"), label: fuelLevel != null ? "Fuel" : "Battery" },
        ].map((s, i) => (
          <div key={i} className="bg-white p-2.5 text-center">
            <s.icon className="w-3.5 h-3.5 mx-auto text-gray-400 mb-1" />
            <p className="text-xs font-semibold">{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="px-4 pb-2 space-y-1.5">
        {v.color && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Color</span>
            <span className="font-medium capitalize">{v.color}</span>
          </div>
        )}
        {v.vin && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">VIN</span>
            <span className="font-mono text-gray-500 text-[11px]">{v.vin}</span>
          </div>
        )}
        {lat != null && lng != null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Coordinates</span>
            <span className="font-mono text-gray-500 text-[11px]">{Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 p-4 pt-2 border-t border-gray-100 mt-1">
        {lat != null && lng != null && (
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-gray-50 hover:bg-gray-100 rounded-lg py-2 transition-colors text-gray-700">
            <MapPin className="w-3.5 h-3.5" />Google Maps
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── Tile layer configs (Google Maps — same provider as Bouncie) ── */
const TILES = {
  satellite: {
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    opts: { maxZoom: 21, attribution: "&copy; Google" },
  },
  satelliteLabels: {
    url: "https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}",
    opts: { maxZoom: 21, pane: "overlayPane" },
  },
  road: {
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    opts: { maxZoom: 21, attribution: "&copy; Google" },
  },
};

/* ─── Map ────────────────────────────────────────────────────────── */
function FleetMap({
  vehicles, selectedId, onSelect,
}: { vehicles: VehicleEntry[]; selectedId: string | null; onSelect: (v: VehicleEntry) => void }) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapInst    = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markerMap  = useRef<Record<string, any>>({});
  const fittedRef  = useRef(false);
  const layersRef  = useRef<{ sat: any; labels: any; road: any }>({ sat: null, labels: null, road: null });
  const onSelectRef = useRef(onSelect);
  const prevStateRef = useRef<Record<string, string>>({});
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<"satellite" | "road">("satellite");

  useEffect(() => { onSelectRef.current = onSelect; });

  const withCoords = useMemo(() => vehicles.filter(v =>
    v.latitude != null && v.longitude != null
  ), [vehicles]);

  const buildIcon = useCallback((L: any, v: VehicleEntry, selected: boolean) => {
    const si = getStatusInfo(v.displayStatus);
    const ring  = selected ? "3px solid #f59e0b" : "2.5px solid white";
    const glow  = selected
      ? "0 0 0 4px rgba(245,158,11,0.35), 0 4px 14px rgba(0,0,0,0.3)"
      : "0 2px 8px rgba(0,0,0,0.35)";
    const size = selected ? 46 : 40;
    const photoUrl = v.car_photo_url ? getProxiedImageUrl(v.car_photo_url) : null;
    const initials = vehicleInitials(v);

    const inner = photoUrl
      ? `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"
           onerror="this.style.display='none';this.nextSibling.style.display='flex'" />
         <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;
           background:${si.color};border-radius:50%;color:white;font-weight:700;font-size:${size * 0.32}px">
           ${initials}</div>`
      : `<span style="color:white;font-weight:700;font-size:${size * 0.32}px">${initials}</span>`;

    return L.divIcon({
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${si.color};
        border:${ring};box-shadow:${glow};overflow:hidden;
        display:flex;align-items:center;justify-content:center">${inner}</div>`,
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }, []);

  const buildLabel = useCallback((v: VehicleEntry) => {
    const name  = vehicleDisplayName(v);
    const short = name.length > 22 ? name.slice(0, 20) + "…" : name;
    const speed = v.speed ?? 0;
    const mph   = v.displayStatus === "driving" && Number(speed) > 0
      ? ` <b style="color:#4ade80">${Number(speed).toFixed(0)} mph</b>` : "";
    return `<div style="background:rgba(15,23,42,0.88);backdrop-filter:blur(6px);
      color:white;border-radius:6px;padding:3px 9px;font-family:system-ui;font-size:11px;
      font-weight:500;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);
      pointer-events:none;margin-top:4px">${short}${mph}</div>`;
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    import("leaflet").then((L) => {
      leafletRef.current = L;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      const map = L.map(mapRef.current!, { zoomControl: false }).setView([40.5, -111.9], 7);
      const sat    = L.tileLayer(TILES.satellite.url, TILES.satellite.opts);
      const labels = L.tileLayer(TILES.satelliteLabels.url, TILES.satelliteLabels.opts);
      const road   = L.tileLayer(TILES.road.url, TILES.road.opts);
      sat.addTo(map);
      labels.addTo(map);
      layersRef.current = { sat, labels, road };
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInst.current = map;
      setMapReady(true);
    });
    return () => {
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
        markerMap.current = {};
        prevStateRef.current = {};
        fittedRef.current = false;
        setMapReady(false);
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;
    const { sat, labels, road } = layersRef.current;
    if (!sat || !road) return;
    if (mapType === "satellite") {
      if (map.hasLayer(road)) map.removeLayer(road);
      if (!map.hasLayer(sat)) sat.addTo(map);
      if (!map.hasLayer(labels)) labels.addTo(map);
    } else {
      if (map.hasLayer(sat)) map.removeLayer(sat);
      if (map.hasLayer(labels)) map.removeLayer(labels);
      if (!map.hasLayer(road)) road.addTo(map);
    }
  }, [mapType]);

  const vehiclesRef = useRef(withCoords);
  vehiclesRef.current = withCoords;

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInst.current;
    if (!mapReady || !L || !map) return;
    const existing = new Set(Object.keys(markerMap.current));

    withCoords.forEach(v => {
      const lat = v.latitude as number;
      const lng = v.longitude as number;
      const speed = Number(v.speed ?? 0);
      const stateKey = `${v.displayStatus}|${v.car_photo_url || ""}|${speed.toFixed(0)}`;

      if (markerMap.current[v.device_id]) {
        const m = markerMap.current[v.device_id];
        existing.delete(v.device_id);
        const old = m.getLatLng();
        const moved = Math.abs(old.lat - lat) > 0.00001 || Math.abs(old.lng - lng) > 0.00001;
        if (moved) slideMarkerTo(m, lat, lng, v.displayStatus === "driving" ? 2000 : 400);
        if (prevStateRef.current[v.device_id] !== stateKey) {
          m.setIcon(buildIcon(L, v, false));
          prevStateRef.current[v.device_id] = stateKey;
        }
        if (m.getTooltip()) m.setTooltipContent(buildLabel(v));
      } else {
        const icon = buildIcon(L, v, false);
        const marker = L.marker([lat, lng], { icon })
          .addTo(map)
          .bindTooltip(buildLabel(v), { permanent: true, direction: "bottom", offset: [0, 4], className: "bouncie-label" })
          .on("click", () => onSelectRef.current(v));
        markerMap.current[v.device_id] = marker;
        prevStateRef.current[v.device_id] = stateKey;
      }
    });

    existing.forEach(id => {
      map.removeLayer(markerMap.current[id]);
      delete markerMap.current[id];
      delete prevStateRef.current[id];
    });

    if (!fittedRef.current && Object.keys(markerMap.current).length > 0) {
      const group = L.featureGroup(Object.values(markerMap.current));
      map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 16 });
      fittedRef.current = true;
    }
  }, [mapReady, withCoords, buildIcon, buildLabel]);

  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const L = leafletRef.current;
    if (!L) return;
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedId;
    if (prev && markerMap.current[prev]) {
      const v = vehiclesRef.current.find(vv => vv.device_id === prev);
      if (v) markerMap.current[prev].setIcon(buildIcon(L, v, false));
    }
    if (selectedId && markerMap.current[selectedId]) {
      const v = vehiclesRef.current.find(vv => vv.device_id === selectedId);
      if (v) markerMap.current[selectedId].setIcon(buildIcon(L, v, true));
      mapInst.current?.flyTo(markerMap.current[selectedId].getLatLng(), 16, { duration: 0.8 });
    }
  }, [selectedId, buildIcon]);

  return (
    <div className="relative h-full">
      <style>{`
        .bouncie-label { background:transparent !important; border:none !important; box-shadow:none !important; padding:0 !important; }
        .bouncie-label::before { display:none !important; }
      `}</style>
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
      {withCoords.length === 0 && (
        <div className="absolute inset-0 z-[800] flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-lg flex flex-col items-center">
            <MapPin className="w-10 h-10 text-gray-300 mb-2" />
            <p className="font-semibold text-sm text-gray-600">No vehicle locations yet</p>
            <p className="text-xs text-gray-400 mt-1">Your vehicle will appear once its tracker reports a position</p>
          </div>
        </div>
      )}
      <button
        onClick={() => setMapType(t => t === "satellite" ? "road" : "satellite")}
        className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md rounded-lg p-2 shadow-lg border border-gray-200/80 text-gray-600 hover:text-gray-900 transition-colors"
        title={mapType === "satellite" ? "Switch to road map" : "Switch to satellite"}
      >
        {mapType === "satellite" ? <MapIcon className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
      </button>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
const LIVE_POLL_MS = 10_000;

export default function ClientCarTrackingPage() {
  const [search, setSearch]           = useState("");
  const [selectedId, setSelectedId]   = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: FleetOverview }>({
    queryKey: ["/api/bouncie/client-fleet"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/bouncie/client-fleet"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load vehicle data");
      return res.json();
    },
    refetchInterval: LIVE_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: LIVE_POLL_MS - 1000,
    retry: 2,
    placeholderData: keepPreviousData,
  });

  const overview = data?.data;
  const allVehicles = useMemo(() => overview?.vehicles ?? [], [overview]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allVehicles;
    const q = search.toLowerCase();
    return allVehicles.filter(v =>
      vehicleDisplayName(v).toLowerCase().includes(q)
      || (v.license_plate || "").toLowerCase().includes(q)
      || (v.vin || "").toLowerCase().includes(q)
    );
  }, [allVehicles, search]);

  const selectedVehicle = useMemo(
    () => allVehicles.find(v => v.device_id === selectedId) ?? null,
    [allVehicles, selectedId]
  );

  const handleMapSelect = useCallback((v: VehicleEntry) => {
    setSelectedId(prev => prev === v.device_id ? null : v.device_id);
  }, []);

  return (
    <AdminLayout>
      <div className="flex overflow-hidden h-full -mr-3 -mt-3 -mb-3 sm:-mr-4 sm:-mt-4 sm:-mb-4 md:-mr-6 md:-mt-6 md:-mb-6">

        {/* ── Sidebar ── */}
        <div className="flex flex-col w-72 lg:w-80 flex-shrink-0 bg-[#1e1e1e] text-white overflow-hidden border-r border-[#2a2a2a]">

          {/* Header */}
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Car className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-100">My Vehicles</h2>
                <p className="text-[11px] text-gray-400">Live tracking</p>
              </div>
            </div>
          </div>

          {/* Search (only when >1 vehicle) */}
          {allVehicles.length > 1 && (
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center gap-2 bg-[#282828] border border-[#3a3a3a] rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicle..."
                  className="bg-transparent text-sm text-white placeholder-gray-500 outline-none flex-1 min-w-0" />
                {search && <button onClick={() => setSearch("")} className="text-gray-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          )}

          {/* Vehicle count */}
          <div className="px-4 pb-2 pt-1">
            <p className="text-xs text-gray-400">
              {allVehicles.length === 1 ? "1 vehicle" : `${filtered.length} of ${allVehicles.length} vehicles`}
            </p>
          </div>

          {/* Vehicle list */}
          <div className="flex-1 overflow-y-auto border-t border-[#2a2a2a]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
                <Car className="w-8 h-8 opacity-25" />
                <p className="text-sm">{search ? "No matches" : "No tracked vehicles"}</p>
                <p className="text-xs text-gray-600 text-center px-4 max-w-[220px]">
                  {search ? "Try a different search" : "No vehicles are currently linked to your account."}
                </p>
              </div>
            ) : (
              filtered.map(v => {
                const isSelected = v.device_id === selectedId;
                const si = getStatusInfo(v.displayStatus);

                return (
                  <button key={v.device_id}
                    onClick={() => setSelectedId(isSelected ? null : v.device_id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 border-b border-[#2a2a2a] transition-colors
                      hover:bg-[#272727] ${isSelected ? "bg-[#272727] border-l-2 border-l-blue-500 pl-[10px]" : ""}`}>
                    <VehicleAvatar v={v} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-gray-100 truncate leading-tight">{vehicleDisplayName(v)}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: si.color }} />
                        <span className="text-[11px] text-gray-400 truncate">
                          {si.label}
                          {v.displayStatus === "driving" && Number(v.speed ?? 0) > 0
                            ? ` · ${Number(v.speed).toFixed(0)} mph`
                            : ""}
                        </span>
                      </div>
                      {v.license_plate && (
                        <p className="text-[10px] text-gray-500 mt-0.5">{v.license_plate}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Map area ── */}
        <div className="flex-1 overflow-hidden relative">
          <FleetMap vehicles={allVehicles} selectedId={selectedId} onSelect={handleMapSelect} />
          {selectedVehicle && <VehicleDetailPanel v={selectedVehicle} onClose={() => setSelectedId(null)} />}
        </div>
      </div>
    </AdminLayout>
  );
}
