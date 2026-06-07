import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fetchRoutes, type BikeRoute } from "@/lib/routes-data";
import { apiCheckSession, apiLogin, apiLogout, apiSaveRoute, apiDeleteRoute } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Save, Eye, LogOut, Lock } from "lucide-react";
import LangToggle from "@/components/LangToggle";

const RouteEditorMap = lazy(() => import("@/components/RouteEditorMap"));

const emptyRoute: Omit<BikeRoute, "id"> = {
  code: "",
  name: "",
  description: "",
  distance: "",
  duration: "",
  difficulty: "Fácil",
//  points: [{ lat: 38.708, lng: 1.422, instruction: "" }],
points: [{ lat: 38.708, lng: 1.422, instruction: "", mode: "bike" }],
};

export default function Admin() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [authState, setAuthState] = useState<"checking" | "anon" | "ok">("checking");

  useEffect(() => {
    apiCheckSession().then((ok) => setAuthState(ok ? "ok" : "anon"));
  }, []);

  if (authState === "checking") {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">…</div>;
  }

  if (authState === "anon") {
    return <LoginForm onSuccess={() => setAuthState("ok")} onCancel={() => navigate("/")} />;
  }

  return <AdminPanel onLogout={() => setAuthState("anon")} />;
}

function LoginForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiLogin(username.trim(), password);
      toast.success(t("loginOk") || "Sesión iniciada");
      onSuccess();
    } catch (err) {
      setError((err as Error).message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-card border rounded-2xl p-8 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-5 h-5 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">
            {t("adminLogin") || "Acceso administrador"}
          </h1>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">{t("username") || "Usuario"}</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">{t("password") || "Contraseña"}</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "…" : (t("signIn") || "Entrar")}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {t("back") || "Volver"}
        </button>
      </form>
    </div>
  );
}

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [routes, setRoutes] = useState<BikeRoute[]>([]);
  const [editing, setEditing] = useState<BikeRoute | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setRoutes(await fetchRoutes());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleLogout = async () => {
    await apiLogout();
    onLogout();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiSaveRoute({
        ...editing,
        code: editing.code.toUpperCase().trim(),
      });
      toast.success(t("savedOk"));
      setEditing(null);
      await reload();
    } catch (err) {
      toast.error((err as Error).message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDeleteRoute(id);
      await reload();
    } catch (err) {
      toast.error((err as Error).message || "Error");
    }
  };

  if (editing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)} className="text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> {t("backToList")}
            </Button>
            <LangToggle className="bg-muted/50 text-foreground border-border" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-6">
            {editing.name || t("newRoute")}
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("code")}</label>
                <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="RUTA01" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("name")}</label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("description")}</label>
              <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("distance")}</label>
                <Input value={editing.distance} onChange={(e) => setEditing({ ...editing, distance: e.target.value })} placeholder="15 km" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("duration")}</label>
                <Input value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: e.target.value })} placeholder="1h 30min" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("difficulty")}</label>
                <select
                  value={editing.difficulty}
                  onChange={(e) => setEditing({ ...editing, difficulty: e.target.value as BikeRoute["difficulty"] })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Fácil">{t("easy")}</option>
                  <option value="Media">{t("medium")}</option>
                  <option value="Difícil">{t("hard")}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{t("routePoints")}</label>
              <Suspense fallback={<div className="h-[420px] rounded-xl border bg-muted/30" />}>
                <RouteEditorMap
                  points={editing.points}
                  onChange={(points) => setEditing({ ...editing, points })}
                />
              </Suspense>
            </div>

            <Button onClick={handleSaveEdit} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" /> {saving ? "…" : t("saveRoute")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> {t("exit")}
          </Button>
          <div className="flex items-center gap-2">
            <LangToggle className="bg-muted/50 text-foreground border-border" />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground" title={t("logout") || "Salir"}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl font-bold text-foreground">{t("adminPanel")}</h1>
          <Button onClick={() => setEditing({ ...emptyRoute, id: "" } as BikeRoute)} className="gap-1">
            <Plus className="w-4 h-4" /> {t("newRoute")}
          </Button>
        </div>

        <div className="space-y-3">
          {routes.map((route) => (
            <motion.div
              key={route.id || route.code}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <h3 className="font-display font-semibold text-foreground">{route.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("code")}: <span className="font-mono tracking-wider">{route.code}</span> · {route.distance} · {route.difficulty}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/route/${encodeURIComponent(route.code)}`)}>
                  <Eye className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing({ ...route })}>{t("edit")}</Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(route.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
