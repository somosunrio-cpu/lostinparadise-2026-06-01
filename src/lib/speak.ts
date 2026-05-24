// Lightweight wrapper around the browser's Speech Synthesis API.
// No backend, no API keys, works offline. Voice quality depends on the device.

const SUPPORTED = typeof window !== "undefined" && "speechSynthesis" in window;

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!SUPPORTED) return Promise.resolve([]);
  const initial = window.speechSynthesis.getVoices();
  if (initial.length > 0) {
    cachedVoices = initial;
    return Promise.resolve(initial);
  }
  return new Promise((resolve) => {
    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(cachedVoices);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    // Safety timeout
    setTimeout(() => resolve(cachedVoices), 1500);
  });
}

function pickVoice(lang: "es" | "en"): SpeechSynthesisVoice | undefined {
  const langPrefix = lang === "es" ? "es" : "en";
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
  // Prefer local (offline) voices, then any matching language
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  return matching.find((v) => v.localService) ?? matching[0];
}

export async function primeSpeech(): Promise<void> {
  // Must be called from a user gesture so iOS/Safari unlock the audio engine.
  if (!SUPPORTED) return;
  await loadVoices();
  // Speak an empty utterance to "warm up" the engine on iOS.
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

export function speak(text: string, lang: "es" | "en" = "es") {
  if (!SUPPORTED || !text) return;
  // Cancel any in-flight speech so latest instruction takes priority
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? (lang === "es" ? "es-ES" : "en-US");
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (!SUPPORTED) return;
  window.speechSynthesis.cancel();
}

export const isSpeechSupported = SUPPORTED;
