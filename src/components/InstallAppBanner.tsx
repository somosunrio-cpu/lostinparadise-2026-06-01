import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "installBannerDismissed";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // iOS Safari
  (window.navigator as any).standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const recentlyDismissed = () => sessionStorage.getItem(DISMISS_KEY) === "1";

const InstallAppBanner = () => {
  const { lang } = useI18n();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);

    // iOS doesn't fire beforeinstallprompt — show hint after a small delay
    if (isIOS()) {
      const t = setTimeout(() => setShow(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBIP);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
    setIosHint(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setShow(false);
    } else if (isIOS()) {
      setIosHint((s) => !s);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[2000] mx-auto max-w-md bg-card/95 backdrop-blur border rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">
            {lang === "es" ? "Instala la app" : "Install the app"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === "es"
              ? "Acceso rápido desde tu pantalla de inicio."
              : "Quick access from your home screen."}
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label={lang === "es" ? "Cerrar" : "Close"}
          className="text-muted-foreground hover:text-foreground p-1 -m-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {iosHint && isIOS() && (
        <div className="mt-3 text-xs text-foreground bg-muted rounded-lg p-3 flex items-start gap-2">
          <Share className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <span>
            {lang === "es"
              ? 'Pulsa el icono Compartir y elige "Añadir a pantalla de inicio".'
              : 'Tap the Share icon and choose "Add to Home Screen".'}
          </span>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={dismiss}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          {lang === "es" ? "Ahora no" : "Not now"}
        </button>
        <button
          onClick={install}
          className="flex-1 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {lang === "es" ? "Instalar" : "Install"}
        </button>
      </div>
    </div>
  );
};

export default InstallAppBanner;
