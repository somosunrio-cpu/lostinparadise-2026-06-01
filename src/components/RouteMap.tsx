import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BikeRoute } from "@/lib/routes-data";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { speak, stopSpeaking, primeSpeech, isSpeechSupported } from "@/lib/speak";
import { Volume2, VolumeX, LocateFixed, Compass, Layers } from "lucide-react";

type MapType = "streets" | "satellite" | "cycling";

const TILE_LAYERS: Record<MapType, { url: string; attribution: string; maxZoom?: number; subdomains?: string }> = {
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  cycling: {
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.cyclosm.org">CyclOSM</a> | &copy; OpenStreetMap',
    maxZoom: 20,
    subdomains: "abc",
  },
};

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

//async function fetchOSRMRoute(points: { lat: number; lng: number }[]): Promise<[number, number][]> {
//  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
//  const url = `https://router.project-osrm.org/route/v1/cycling/${coords}?overview=full&geometries=geojson`;
//  try {
//    const res = await fetch(url);
//    const data = await res.json();
//    if (data.code === "Ok" && data.routes?.[0]) {
//      return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
//    }
//  } catch (e) {
//    console.warn("OSRM fetch failed, falling back to straight lines", e);
//  }
//  return points.map((p) => [p.lat, p.lng] as [number, number]);
//}

async function fetchOSRMRoute(points: { lat: number; lng: number }[]): Promise<[number, number][]> {
  const start = `${points[0].lng},${points[0].lat}`;
  const end = `${points[points.length-1].lng},${points[points.length-1].lat}`;
  const url = `https://api.openrouteservice.org/v2/directions/cycling-mountain?api_key=eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjY3ZmNjMjM1MGVmYTRkNzU4ZjNjYjk5ZDYwYWNlYTQ3IiwiaCI6Im11cm11cjY0In0=&start=${start}&end=${end}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.features?.[0]?.geometry?.coordinates) {
      return data.features[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
    }
  } catch (e) {
    console.warn("OpenRouteService fetch failed, falling back to straight lines", e);
  }
  return points.map((p) => [p.lat, p.lng] as [number, number]);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createUserIcon(heading: number | null, mapRotation: number = 0): L.DivIcon {
  // arrowRot is the rotation of the arrow relative to the (possibly rotated) map container
  const arrowRot = heading === null ? null : heading + mapRotation;
  const arrow =
    arrowRot === null
      ? ""
      : `<div style="position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-150%) rotate(${arrowRot}deg);transform-origin:50% 150%;">
           <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:14px solid #3b82f6;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));"></div>
         </div>`;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:40px;height:40px;">
             ${arrow}
             <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:18px;height:18px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.6);"></div>
           </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

const ALERT_DISTANCE = 50; // meters

const RouteMap = ({ route }: { route: BikeRoute }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const alertedPointsRef = useRef<Set<number>>(new Set());
  const [tracking, setTracking] = useState(false);
  const [nextPointIndex, setNextPointIndex] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const headingRef = useRef<number | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [rotateMap, setRotateMap] = useState(false);
  const followUserRef = useRef(true);
  const rotateMapRef = useRef(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapType, setMapType] = useState<MapType>(() => {
    try {
      const saved = localStorage.getItem("mapType") as MapType | null;
      if (saved === "streets" || saved === "satellite" || saved === "cycling") return saved;
    } catch {}
    return "streets";
  });
  useEffect(() => {
    try { localStorage.setItem("mapType", mapType); } catch {}
  }, [mapType]);
  const [showMapMenu, setShowMapMenu] = useState(false);
  const lastUserPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const suppressMoveEventsRef = useRef(false);
  useEffect(() => { followUserRef.current = followUser; }, [followUser]);
  useEffect(() => { rotateMapRef.current = rotateMap; }, [rotateMap]);
  const voiceEnabledRef = useRef(true);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  const { lang } = useI18n();

  // Build map
  useEffect(() => {
    if (!mapContainerRef.current || route.points.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    alertedPointsRef.current = new Set();
    setNextPointIndex(0);

    // CSS var --sea is already a full color (e.g. "hsl(185 75% 48%)"), so use it raw.
    const seaToken = getComputedStyle(document.documentElement).getPropertyValue("--sea").trim();
    const polylineColor = seaToken && /^(hsl|rgb|oklch|#)/i.test(seaToken)
      ? seaToken
      : seaToken
        ? `hsl(${seaToken})`
        : "hsl(195 80% 42%)";

    const map = L.map(mapContainerRef.current, { zoomControl: true, scrollWheelZoom: true });
    mapRef.current = map;

    // Disable follow mode when user manually drags the map
    map.on("dragstart", () => {
      if (suppressMoveEventsRef.current) return;
      if (followUserRef.current) setFollowUser(false);
    });

    const initial = TILE_LAYERS[mapType];
    tileLayerRef.current = L.tileLayer(initial.url, {
      attribution: initial.attribution,
      maxZoom: initial.maxZoom,
      ...(initial.subdomains ? { subdomains: initial.subdomains } : {}),
    }).addTo(map);

    route.points.forEach((point, index) => {
      const title = index === 0 ? "🚩 Inicio" : index === route.points.length - 1 ? "🏁 Fin" : `Punto ${index + 1}`;
      const instruction = point.instruction ? `<p style="margin: 4px 0 0;">${escapeHtml(point.instruction)}</p>` : "";
      L.marker([point.lat, point.lng]).addTo(map).bindPopup(`<div><strong>${title}</strong>${instruction}</div>`);
    });

    const straightPositions = route.points.map<[number, number]>(({ lat, lng }) => [lat, lng]);
    if (straightPositions.length === 1) {
      map.setView(straightPositions[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(straightPositions), { padding: [40, 40] });
    }

    let cancelled = false;
    fetchOSRMRoute(route.points).then((positions) => {
      if (cancelled || !mapRef.current) return;
      const routeLine = L.polyline(positions, { color: polylineColor, weight: 4 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
    });

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
    };
  }, [route]);

  // Swap tile layer when mapType changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const cfg = TILE_LAYERS[mapType];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      ...(cfg.subdomains ? { subdomains: cfg.subdomains } : {}),
    }).addTo(mapRef.current);
  }, [mapType]);

  // Wake Lock: keep screen on while tracking
  useEffect(() => {
    if (!tracking) return;
    const anyNav = navigator as any;
    if (!anyNav.wakeLock?.request) return;

    let wakeLock: any = null;
    let released = false;

    const acquire = async () => {
      try {
        wakeLock = await anyNav.wakeLock.request("screen");
        wakeLock.addEventListener?.("release", () => {
          // Will be re-acquired by visibilitychange handler if still tracking
        });
      } catch (e) {
        console.warn("Wake Lock request failed", e);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !released) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (wakeLock) wakeLock.release?.().catch(() => {});
    };
  }, [tracking]);

  // Device orientation (compass heading)
  useEffect(() => {
    if (!tracking) return;

    let lastUpdate = 0;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const iosHeading = (event as any).webkitCompassHeading;
      let h: number | null = null;
      if (typeof iosHeading === "number" && isFinite(iosHeading)) {
        h = iosHeading;
      } else if (typeof event.alpha === "number" && isFinite(event.alpha)) {
        h = (360 - event.alpha) % 360;
      }
      if (h === null) return;
      const now = Date.now();
      if (now - lastUpdate < 100) return;
      lastUpdate = now;
      headingRef.current = h;
      setHeading(h);
      if (userMarkerRef.current) {
        userMarkerRef.current.setIcon(createUserIcon(h, rotateMapRef.current ? -h : 0));
      }
    };

    const attach = () => {
      const eventName = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
      window.addEventListener(eventName as any, handleOrientation as any, true);
      return () => window.removeEventListener(eventName as any, handleOrientation as any, true);
    };

    let detach: (() => void) | null = null;
    const DOE = (window as any).DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      DOE.requestPermission()
        .then((state: string) => {
          if (state === "granted") detach = attach();
        })
        .catch(() => {});
    } else {
      detach = attach();
    }

    return () => {
      if (detach) detach();
      headingRef.current = null;
      setHeading(null);
    };
  }, [tracking]);

  // Update marker arrow when rotateMap toggles or tracking stops
  useEffect(() => {
    if (!tracking || !rotateMap) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setIcon(createUserIcon(headingRef.current, 0));
      }
    } else {
      const h = headingRef.current;
      if (h !== null && userMarkerRef.current) {
        userMarkerRef.current.setIcon(createUserIcon(h, -h));
      }
    }
  }, [rotateMap, tracking]);


  useEffect(() => {
    if (!tracking || !mapRef.current) return;

    if (!navigator.geolocation) {
      toast.error(lang === "es" ? "Tu navegador no soporta GPS" : "Your browser doesn't support GPS");
      setTracking(false);
      return;
    }

    const map = mapRef.current;

    const onPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy: acc, speed } = pos.coords;

      if (!userMarkerRef.current) {
        const h = headingRef.current;
        userMarkerRef.current = L.marker([latitude, longitude], {
          icon: createUserIcon(h, rotateMapRef.current && h !== null ? -h : 0),
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([latitude, longitude]);
      }

      // Accuracy circle
      if (typeof acc === "number" && isFinite(acc)) {
        setAccuracy(acc);
        if (!accuracyCircleRef.current) {
          accuracyCircleRef.current = L.circle([latitude, longitude], {
            radius: acc,
            color: "#3b82f6",
            weight: 1,
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
          }).addTo(map);
        } else {
          accuracyCircleRef.current.setLatLng([latitude, longitude]);
          accuracyCircleRef.current.setRadius(acc);
        }
      }

      // Speed: prefer device-provided speed (m/s); fallback to derived from positions
      let kmh: number | null = null;
      if (typeof speed === "number" && isFinite(speed) && speed >= 0) {
        kmh = speed * 3.6;
      } else if (lastPosRef.current) {
        const dt = (pos.timestamp - lastPosRef.current.t) / 1000;
        if (dt > 0.5 && dt < 30) {
          const d = haversineDistance(lastPosRef.current.lat, lastPosRef.current.lng, latitude, longitude);
          kmh = (d / dt) * 3.6;
        }
      }
      if (kmh !== null) setSpeedKmh(kmh);
      lastPosRef.current = { lat: latitude, lng: longitude, t: pos.timestamp };

      lastUserPosRef.current = { lat: latitude, lng: longitude };
      if (followUserRef.current) {
        suppressMoveEventsRef.current = true;
        map.setView([latitude, longitude], Math.max(map.getZoom(), 16), { animate: true });
        setTimeout(() => { suppressMoveEventsRef.current = false; }, 400);
      }

      // Check proximity to route points
      for (let i = 0; i < route.points.length; i++) {
        if (alertedPointsRef.current.has(i)) continue;
        const pt = route.points[i];
        const dist = haversineDistance(latitude, longitude, pt.lat, pt.lng);
        if (dist < ALERT_DISTANCE) {
          alertedPointsRef.current.add(i);
          const label = i === 0 ? "🚩" : i === route.points.length - 1 ? "🏁" : `📍 ${i + 1}`;
          const arrived = i === route.points.length - 1;
          const fallback = arrived ? (lang === "es" ? "¡Has llegado!" : "You arrived!") : "";
          const msg = pt.instruction || fallback;
          toast(`${label} ${msg}`, { duration: 5000 });
          if (voiceEnabledRef.current && msg) speak(msg, lang);
          setNextPointIndex(Math.min(i + 1, route.points.length - 1));
        }
      }
    };

    const onError = (err: GeolocationPositionError) => {
      console.warn("Geolocation error", err);
      const denied = err.code === err.PERMISSION_DENIED;
      const msg = denied
        ? lang === "es"
          ? "Permiso de ubicación denegado. Ábrelo en una pestaña nueva y permite el GPS."
          : "Location permission denied. Open the app in a new tab and allow GPS."
        : lang === "es"
          ? "No se pudo obtener tu ubicación. Sal al aire libre e inténtalo de nuevo."
          : "Could not get your location. Try again outdoors.";
      toast.error(msg, { duration: 6000 });
      setTracking(false);
    };

    const watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000,
    });
    watchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(watchId);
      watchIdRef.current = null;
      stopSpeaking();
      if (userMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      if (accuracyCircleRef.current && mapRef.current) {
        mapRef.current.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      lastPosRef.current = null;
      setSpeedKmh(null);
      setAccuracy(null);
    };
  }, [tracking, route, lang]);

  const nextPoint = route.points[nextPointIndex];
  const nextLabel =
    nextPointIndex === 0
      ? lang === "es" ? "Inicio" : "Start"
      : nextPointIndex === route.points.length - 1
        ? lang === "es" ? "Llegada" : "Finish"
        : `${lang === "es" ? "Punto" : "Point"} ${nextPointIndex + 1}`;

  return (
    <div className="relative w-full h-[70vh] min-h-[400px] overflow-hidden">
      <div
        ref={mapContainerRef}
        className="w-full h-full origin-center transition-transform duration-300 ease-out"
        style={{ transform: tracking && rotateMap && heading !== null ? `scale(1.6) rotate(${-heading}deg)` : undefined }}
      />

      {/* Map type selector (top-left) */}
      <div className="absolute top-4 left-4 z-[1000]">
        <button
          onClick={() => setShowMapMenu((s) => !s)}
          aria-label={lang === "es" ? "Tipo de mapa" : "Map type"}
          className="w-12 h-12 rounded-full shadow-lg border bg-card text-foreground flex items-center justify-center"
        >
          <Layers className="w-5 h-5" />
        </button>
        {showMapMenu && (
          <div className="mt-2 bg-card/95 backdrop-blur border rounded-xl shadow-lg overflow-hidden min-w-[140px]">
            {([
              { id: "streets", label: lang === "es" ? "Calles" : "Streets" },
              { id: "satellite", label: lang === "es" ? "Satélite" : "Satellite" },
              { id: "cycling", label: lang === "es" ? "Ciclismo" : "Cycling" },
            ] as { id: MapType; label: string }[]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => { setMapType(opt.id); setShowMapMenu(false); }}
                className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                  mapType === opt.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Speed & accuracy HUD */}
      {tracking && (speedKmh !== null || accuracy !== null) && (
        <div className="absolute top-4 right-4 z-[1000] bg-card/95 backdrop-blur border rounded-xl px-3 py-2 shadow-lg flex gap-3 items-center">
          {speedKmh !== null && (
            <div className="text-center">
              <p className="text-lg font-bold leading-none text-foreground">{speedKmh.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">km/h</p>
            </div>
          )}
          {accuracy !== null && (
            <div className="text-center border-l pl-3">
              <p className="text-lg font-bold leading-none text-foreground">±{Math.round(accuracy)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">m</p>
            </div>
          )}
        </div>
      )}

      {/* Right-side action buttons (recenter + rotate) */}
      {tracking && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
          <button
            onClick={() => {
              setFollowUser(true);
              const pos = lastUserPosRef.current;
              if (pos && mapRef.current) {
                suppressMoveEventsRef.current = true;
                mapRef.current.setView([pos.lat, pos.lng], Math.max(mapRef.current.getZoom(), 16), { animate: true });
                setTimeout(() => { suppressMoveEventsRef.current = false; }, 400);
              }
            }}
            aria-label={lang === "es" ? "Recentrar en mi posición" : "Recenter on my position"}
            className={`w-12 h-12 rounded-full shadow-lg border flex items-center justify-center transition-colors ${
              followUser ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
            }`}
          >
            <LocateFixed className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (!rotateMap && heading === null) {
                toast(lang === "es" ? "Brújula no disponible en este dispositivo" : "Compass not available on this device");
                return;
              }
              setRotateMap((r) => !r);
            }}
            aria-label={rotateMap ? (lang === "es" ? "Desactivar rotación con brújula" : "Disable compass rotation") : (lang === "es" ? "Rotar mapa con la brújula" : "Rotate map with compass")}
            className={`w-12 h-12 rounded-full shadow-lg border flex items-center justify-center transition-colors ${
              rotateMap ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
            }`}
          >
            <Compass className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Navigation control bar */}
      <div className="absolute bottom-4 left-4 right-4 z-[1000]">
        {tracking && nextPoint?.instruction && (
          <div className="bg-card/95 backdrop-blur border rounded-xl px-4 py-3 mb-2 shadow-lg">
            <p className="text-xs text-muted-foreground font-medium">{nextLabel}</p>
            <p className="text-sm font-semibold text-foreground">{nextPoint.instruction}</p>
          </div>
        )}
        <div className="flex gap-2">
          {isSpeechSupported && (
            <button
              onClick={() => {
                setVoiceEnabled((v) => {
                  const next = !v;
                  if (!next) stopSpeaking();
                  return next;
                });
              }}
              aria-label={voiceEnabled ? (lang === "es" ? "Silenciar voz" : "Mute voice") : (lang === "es" ? "Activar voz" : "Enable voice")}
              className={`shrink-0 w-12 rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center ${
                voiceEnabled ? "bg-card text-foreground border" : "bg-muted text-muted-foreground border"
              }`}
            >
              {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={() => {
              if (tracking) {
                stopSpeaking();
                setTracking(false);
                return;
              }

              if (!navigator.geolocation) {
                toast.error(lang === "es" ? "Tu navegador no soporta GPS" : "Your browser doesn't support GPS");
                return;
              }

              // Prime speech synchronously inside the user gesture (iOS/Safari requirement)
              if (voiceEnabledRef.current) {
                primeSpeech().then(() => {
                  speak(lang === "es" ? "Ruta iniciada" : "Route started", lang);
                });
              }

              // Request geolocation permission inside the user gesture so the browser shows the prompt
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setFollowUser(true);
                  followUserRef.current = true;
                  if (mapRef.current) {
                    suppressMoveEventsRef.current = true;
                    mapRef.current.setView(
                      [pos.coords.latitude, pos.coords.longitude],
                      Math.max(mapRef.current.getZoom(), 16),
                      { animate: true }
                    );
                    setTimeout(() => { suppressMoveEventsRef.current = false; }, 400);
                  }
                  lastUserPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                  setTracking(true);
                },
                (err) => {
                  console.warn("Geolocation permission error", err);
                  if (err.code === err.PERMISSION_DENIED) {
                    toast.error(
                      lang === "es"
                        ? "Permiso de ubicación denegado. Actívalo en los ajustes del navegador."
                        : "Location permission denied. Enable it in your browser settings."
                    );
                  } else {
                    toast.error(lang === "es" ? "No se pudo obtener tu ubicación" : "Could not get your location");
                  }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
              );
            }}
            className={`flex-1 py-3 rounded-xl font-bold text-sm shadow-lg transition-colors ${
              tracking
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {tracking
              ? lang === "es" ? "⏹ Detener ruta" : "⏹ Stop route"
              : lang === "es" ? "🧭 Iniciar ruta" : "🧭 Start route"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouteMap;
