// Interface language. English text is the key; other languages live in
// ./locales. "auto" follows the browser (French, Italian, German, Spanish,
// Chinese; anything else English).
import fr from "./locales/fr.js";
import it from "./locales/it.js";
import de from "./locales/de.js";
import es from "./locales/es.js";
import zh from "./locales/zh.js";

const DICTIONARIES = { fr, it, de, es, zh };
// Stored by name, so Roam's own settings select shows readable choices.
export const LANGUAGES = [["Auto", "Auto (browser language)"], ["English", "English"], ["Français", "Français"], ["Italiano", "Italiano"], ["Deutsch", "Deutsch"], ["Español", "Español"], ["\u4e2d\u6587", "\u4e2d\u6587"]];
const CODES = { auto: "auto", english: "en", "français": "fr", italiano: "it", deutsch: "de", "español": "es", "\u4e2d\u6587": "zh", en: "en", fr: "fr", it: "it", de: "de", es: "es", zh: "zh" };
// A stored value (a name, or a code from 0.7.0) as the stored name.
export const languageName = value => { const code = CODES[String(value || "auto").toLowerCase()] || "auto"; return code === "auto" ? "Auto" : LANGUAGES.find(([name]) => CODES[name.toLowerCase()] === code)[0]; };
let current = "en";

export function resolveLanguage(preference = "auto") {
  const code = CODES[String(preference || "auto").toLowerCase()] || "en";
  if (code !== "auto") return code;
  const tags = [...(globalThis.navigator?.languages || []), globalThis.navigator?.language].filter(Boolean);
  for (const tag of tags) { const code = String(tag).toLowerCase().slice(0, 2); if (code === "en") return "en"; if (DICTIONARIES[code]) return code; }
  return "en";
}
export function setLanguage(preference) { current = resolveLanguage(preference); globalThis.document?.documentElement?.setAttribute?.("data-rd-lang", current); return current; }
export const language = () => current;

// t("Deleted {0} files", [count]) → the current language, English if missing.
export function t(text, values = []) {
  const template = (current !== "en" && DICTIONARIES[current]?.[text]) || text;
  return values.length ? template.replace(/\{(\d+)\}/g, (match, index) => values[index] ?? "") : template;
}
