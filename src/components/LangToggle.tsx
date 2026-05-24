import { useI18n } from "@/lib/i18n";

const LangToggle = ({ className = "" }: { className?: string }) => {
  const { lang, setLang } = useI18n();

  return (
    <button
      onClick={() => setLang(lang === "es" ? "en" : "es")}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors ${className}`}
      aria-label="Toggle language"
    >
      <span className={lang === "en" ? "opacity-100" : "opacity-50"}>EN</span>
      <span className="opacity-40">|</span>
      <span className={lang === "es" ? "opacity-100" : "opacity-50"}>ES</span>
    </button>
  );
};

export default LangToggle;
