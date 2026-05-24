import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { fetchRouteByCode, type BikeRoute } from "@/lib/routes-data";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Navigation, List, Clock, Ruler, Mountain } from "lucide-react";
import RouteInstructions from "@/components/RouteInstructions";
import LangToggle from "@/components/LangToggle";

const RouteMap = lazy(() => import("@/components/RouteMap"));

export default function RouteView() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [route, setRoute] = useState<BikeRoute | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<"map" | "instructions">("map");

  useEffect(() => {
    let active = true;
    fetchRouteByCode(code).then((r) => {
      if (!active) return;
      if (!r) setNotFound(true);
      else setRoute(r);
    });
    return () => { active = false; };
  }, [code]);

  useEffect(() => {
    if (notFound) navigate("/");
  }, [notFound, navigate]);

  if (!route) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t("back")}…
      </div>
    );
  }

  const difficultyColor =
    route.difficulty === "Fácil"
      ? "bg-olive text-olive-foreground"
      : route.difficulty === "Media"
        ? "bg-accent text-accent-foreground"
        : "bg-terracotta text-terracotta-foreground";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border-b px-4 py-4"
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> {t("back")}
            </Button>
            <LangToggle className="bg-muted/50 text-foreground border-border" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">{route.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{route.description}</p>
          <div className="flex gap-3 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <Ruler className="w-3 h-3" /> {route.distance}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <Clock className="w-3 h-3" /> {route.duration}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${difficultyColor}`}>
              <Mountain className="w-3 h-3" /> {route.difficulty}
            </span>
          </div>
        </div>
      </motion.header>

      <div className="flex justify-center gap-2 py-3 bg-card border-b">
        <Button variant={mode === "map" ? "default" : "outline"} size="sm" onClick={() => setMode("map")} className="gap-1">
          <Navigation className="w-4 h-4" /> {t("gpsMap")}
        </Button>
        <Button variant={mode === "instructions" ? "default" : "outline"} size="sm" onClick={() => setMode("instructions")} className="gap-1">
          <List className="w-4 h-4" /> {t("instructions")}
        </Button>
      </div>

      <div className="flex-1">
        {mode === "map" ? (
          <Suspense fallback={<div className="flex items-center justify-center h-[70vh] text-muted-foreground">…</div>}>
            <RouteMap route={route} />
          </Suspense>
        ) : (
          <RouteInstructions route={route} />
        )}
      </div>
    </div>
  );
}
