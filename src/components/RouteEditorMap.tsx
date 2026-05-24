import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RoutePoint } from "@/lib/routes-data";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, MapPin, Search, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Default Leaflet marker icon (already configured in RouteMap, but keep here too)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const numberedIcon = (n: number, color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="position:relative;width:32px;height:42px;">
             <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:28px;height:28px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${n}</div>
             <div style="position:absolute;left:50%;top:24px;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:12px solid ${color};"></div>
           </div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 36],
  });

const colorFor = (i: number, total: number) => {
  if (i === 0) return "#16a34a"; // start green
  if (i === total - 1) return "#dc2626"; // end red
  return "#2563eb"; // mid blue
};

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  points: RoutePoint[];
  onChange: (points: RoutePoint[]) => void;
}

const RouteEditorMap = ({ points, onChange }: Props) => {
  const { lang } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const lineRef = useRef<L.Polyline | null>(null);
  const pointsRef = useRef<RoutePoint[]>(points);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NominatimResult[]>([]);

  useEffect(() => { pointsRef.current = points; }, [points]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Initial view
    if (pointsRef.current.length > 0) {
      const bounds = L.latLngBounds(pointsRef.current.map((p) => [p.lat, p.lng] as [number, number]));
      if (pointsRef.current.length === 1) map.setView([pointsRef.current[0].lat, pointsRef.current[0].lng], 14);
      else map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView([38.7080, 1.4220], 13); // Formentera default
    }

    // Click to add point
    map.on("click", (e: L.LeafletMouseEvent) => {
      const next = [...pointsRef.current, { lat: e.latlng.lat, lng: e.latlng.lng, instruction: "" }];
      onChange(next);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      lineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers + polyline whenever points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    points.forEach((p, idx) => {
      const marker = L.marker([p.lat, p.lng], {
        draggable: true,
        icon: numberedIcon(idx + 1, colorFor(idx, points.length)),
      }).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        const next = pointsRef.current.map((pp, i) => (i === idx ? { ...pp, lat: ll.lat, lng: ll.lng } : pp));
        onChange(next);
      });
      markersRef.current.push(marker);
    });

    // Polyline
    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }
    if (points.length >= 2) {
      lineRef.current = L.polyline(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#2563eb", weight: 3, opacity: 0.7, dashArray: "6 6" }
      ).addTo(map);
    }
  }, [points, onChange]);

  // Search via Nominatim
  const runSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(search)}`;
      const res = await fetch(url, { headers: { "Accept-Language": lang === "es" ? "es" : "en" } });
      const data: NominatimResult[] = await res.json();
      if (data.length === 0) {
        toast(lang === "es" ? "Sin resultados" : "No results");
      }
      setResults(data);
    } catch (e) {
      toast.error(lang === "es" ? "Error en la búsqueda" : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const addFromResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    onChange([...points, { lat, lng, instruction: r.display_name.split(",")[0] }]);
    if (mapRef.current) mapRef.current.setView([lat, lng], 16);
    setResults([]);
    setSearch("");
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= points.length) return;
    const next = [...points];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(points.filter((_, i) => i !== idx));
  };

  const updateInstruction = (idx: number, value: string) => {
    onChange(points.map((p, i) => (i === idx ? { ...p, instruction: value } : p)));
  };

  const fitToPoints = () => {
    if (!mapRef.current || points.length === 0) return;
    if (points.length === 1) mapRef.current.setView([points[0].lat, points[0].lng], 15);
    else mapRef.current.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40] });
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
              placeholder={lang === "es" ? "Buscar dirección o lugar…" : "Search address or place…"}
              className="pl-9"
            />
          </div>
          <Button type="button" onClick={runSearch} disabled={searching}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        {results.length > 0 && (
          <div className="bg-card border rounded-lg overflow-hidden">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => addFromResult(r)}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0 text-foreground"
              >
                <MapPin className="w-3 h-3 inline mr-1 text-primary" />
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative">
        <div ref={containerRef} className="w-full h-[420px] rounded-xl border overflow-hidden" />
        <div className="absolute top-2 right-2 z-[500] flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={fitToPoints}>
            {lang === "es" ? "Ver ruta" : "Fit route"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {lang === "es"
            ? "Haz clic en el mapa para añadir puntos. Arrastra los marcadores para moverlos."
            : "Click the map to add points. Drag markers to move them."}
        </p>
      </div>

      {/* Points list */}
      <div className="space-y-2">
        {points.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {lang === "es" ? "Aún no hay puntos. Haz clic en el mapa." : "No points yet. Click on the map."}
          </p>
        )}
        {points.map((p, i) => (
          <div key={i} className="flex gap-2 items-center bg-muted/50 p-2 rounded-lg">
            <span
              className="w-6 h-6 shrink-0 rounded-full text-white text-xs font-bold flex items-center justify-center"
              style={{ background: colorFor(i, points.length) }}
            >
              {i + 1}
            </span>
            <Input
              className="flex-1"
              placeholder={lang === "es" ? "Instrucción" : "Instruction"}
              value={p.instruction || ""}
              onChange={(e) => updateInstruction(i, e.target.value)}
            />
            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
              {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === points.length - 1}>
              <ArrowDown className="w-3 h-3" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouteEditorMap;
