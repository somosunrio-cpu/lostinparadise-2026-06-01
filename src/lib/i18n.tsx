import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from "react";

type Lang = "es" | "en";

const translations = {
  es: {
    subtitle: "Rutas en bicicleta por Formentera",
    accessLabel: "Introduce tu código de acceso",
    accessPlaceholder: " ",
    accessButton: "Acceder",
    errorEmpty: "Introduce un código",
    errorInvalid: "Código no válido. Inténtalo de nuevo.",
    copyright: "© 2026 Lost in Paradise Formentera",
    back: "Volver",
    gpsMap: "Mapa GPS",
    instructions: "Instrucciones",
    start: "Inicio",
    arrival: "Llegada",
    step: "Paso",
    point: "Punto",
    exit: "Salir",
    adminPanel: "Panel de Admin",
    newRoute: "Nueva Ruta",
    savedOk: "✓ Guardado correctamente",
    backToList: "Volver a la lista",
    code: "Código",
    name: "Nombre",
    description: "Descripción",
    distance: "Distancia",
    duration: "Duración",
    difficulty: "Dificultad",
    routePoints: "Puntos de la ruta",
    pointLabel: "Punto",
    saveRoute: "Guardar ruta",
    edit: "Editar",
    easy: "Fácil",
    medium: "Media",
    hard: "Difícil",
    lat: "Lat",
    lng: "Lng",
    instruction: "Instrucción",
    adminAccess: "Acceso administrador",
    adminLogin: "Acceso administrador",
    username: "Usuario",
    password: "Contraseña",
    signIn: "Entrar",
    loginOk: "Sesión iniciada",
    logout: "Cerrar sesión",
  },
  en: {
    subtitle: "Bike routes around Formentera",
    accessLabel: "Enter your access code",
    accessPlaceholder: " ",
    accessButton: "Enter",
    errorEmpty: "Enter a code",
    errorInvalid: "Invalid code. Try again.",
    copyright: "© 2026 Lost in Paradise Formentera",
    back: "Back",
    gpsMap: "GPS Map",
    instructions: "Instructions",
    start: "Start",
    arrival: "Finish",
    step: "Step",
    point: "Point",
    exit: "Exit",
    adminPanel: "Admin Panel",
    newRoute: "New Route",
    savedOk: "✓ Saved successfully",
    backToList: "Back to list",
    code: "Code",
    name: "Name",
    description: "Description",
    distance: "Distance",
    duration: "Duration",
    difficulty: "Difficulty",
    routePoints: "Route points",
    pointLabel: "Point",
    saveRoute: "Save route",
    edit: "Edit",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    lat: "Lat",
    lng: "Lng",
    instruction: "Instruction",
    adminAccess: "Admin access",
    adminLogin: "Admin login",
    username: "Username",
    password: "Password",
    signIn: "Sign in",
    loginOk: "Signed in",
    logout: "Sign out",
  },
} as const;

type TranslationKey = keyof typeof translations.es;

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("efp-lang");
      if (stored === "en" || stored === "es") {
        setLangState(stored);
        return;
      }
      const nav = navigator.language?.slice(0, 2);
      setLangState(nav === "es" ? "es" : "en");
    } catch {}
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("efp-lang", l); } catch {}
  }, []);

  const t = useCallback((key: TranslationKey): string => translations[lang][key] || key, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
