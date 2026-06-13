import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";
import { fetchRouteByCode } from "@/lib/routes-data";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bike, MapPin, Shield } from "lucide-react";
import LangToggle from "@/components/LangToggle";

export default function Index() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t("errorEmpty"));
      return;
    }
    setLoading(true);
    try {
      const route = await fetchRouteByCode(trimmed);
      if (route) {
        navigate(`/route/${encodeURIComponent(route.code)}`);
      } else {
        setError(t("errorInvalid"));
      }
    } catch (err) {
      setError((err as Error).message || t("errorInvalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <img
        src={heroBg}
        alt="Vista aérea de la costa de Formentera"
        className="absolute inset-0 w-full h-full object-cover"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 hero-overlay" />

      <div className="absolute top-4 right-4 z-20">
        <LangToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center px-6 text-center max-w-lg w-full"
      >
        <div className="flex items-center gap-2 mb-4">
          <Bike className="w-8 h-8 text-accent" />
          <MapPin className="w-6 h-6 text-sea" />
        </div>

        <h1 className="font-display text-5xl md:text-6xl font-bold text-primary-foreground leading-tight mb-2">
          Lost in Paradise
        </h1>
        <p className="text-primary-foreground/70 font-body text-lg mb-10">
          {t("subtitle")}
        </p>

        <form
          onSubmit={handleSubmit}
          className="glass-card rounded-2xl p-8 w-full max-w-sm flex flex-col gap-4"
        >
          <label className="text-sm font-medium text-foreground text-left flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            {t("accessLabel")}
          </label>
          <Input
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(""); }}
            placeholder={t("accessPlaceholder")}
            className="text-center text-lg tracking-widest uppercase font-medium bg-background/60"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90 text-base py-5">
            {loading ? "…" : t("accessButton")}
          </Button>
        </form>
{/*
        <Link
          to="/admin"
          className="text-primary-foreground/60 hover:text-primary-foreground text-xs mt-6 underline-offset-4 hover:underline"
        >
          {t("adminAccess") || "Acceso administrador"}
        </Link>
*/}
        <p className="text-primary-foreground/40 text-xs mt-6 font-body">
          {t("copyright")}
        </p>
      </motion.div>
    </div>
  );
}
