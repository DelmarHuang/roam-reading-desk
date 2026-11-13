import { t } from "./i18n.js";
// Customisable keyboard shortcuts. Reading Desk listens on window (capture),
// before Roam, Folio and the textarea see the key, so a matched shortcut never
// types a character (Option+M used to insert "µ" on macOS) and is never handled
// twice. Shortcuts are stored by physical key (event.code), so they work with
// any keyboard layout and with Option/Alt characters.
export const SHORTCUTS = [
  { id: "mark", label: "Toggle Mark", fallback: "Alt+KeyM" },
  { id: "question", label: "Toggle Question", fallback: "Alt+KeyQ" },
  { id: "panel", label: "Open / close Reading Desk", fallback: "" },
  { id: "continue", label: "Continue reading", fallback: "" },
  { id: "notes", label: "Open reading notes", fallback: "" }
];
export const shortcutKey = id => `shortcut-${id}`;
const MODIFIERS = ["Ctrl", "Meta", "Alt", "Shift"];
const isMac = () => /Mac|iPhone|iPad/.test(window.navigator?.platform || window.navigator?.userAgent || "");

// "Alt+Shift+KeyM" for an event, or null for a bare modifier / plain key.
export function comboFromEvent(event) {
  const code = event.code || "";
  if (!code || /^(Shift|Control|Alt|Meta|OS)(Left|Right)?$/.test(code)) return null;
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.metaKey) parts.push("Meta");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  const functionKey = /^F\d{1,2}$/.test(code);
  // A shortcut needs Ctrl, Cmd or Alt (Shift alone would block typing),
  // except function keys.
  if (!functionKey && !parts.some(part => part !== "Shift")) return null;
  return [...parts, code].join("+");
}

export function normalizeCombo(value) {
  if (!value) return "";
  const parts = String(value).split("+").map(part => part.trim()).filter(Boolean);
  const code = parts.pop();
  if (!code) return "";
  const mods = MODIFIERS.filter(mod => parts.some(part => part.toLowerCase() === mod.toLowerCase() || (mod === "Meta" && /^(cmd|command)$/i.test(part)) || (mod === "Alt" && /^(option|opt)$/i.test(part)) || (mod === "Ctrl" && /^control$/i.test(part))));
  return [...mods, code].join("+");
}

export function displayCombo(combo) {
  if (!combo) return t("Not set");
  const mac = isMac();
  const parts = combo.split("+"), code = parts.pop();
  const key = code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Arrow/, "").replace(/^Numpad/, "Num ");
  const names = mac ? { Ctrl: "⌃", Meta: "⌘", Alt: "⌥", Shift: "⇧" } : { Ctrl: "Ctrl+", Meta: "Win+", Alt: "Alt+", Shift: "Shift+" };
  return parts.map(part => names[part]).join("") + key;
}

export function installShortcuts({ get, handlers }) {
  let paused = false;
  const comboFor = id => { const stored = get(shortcutKey(id)); const spec = SHORTCUTS.find(item => item.id === id); return normalizeCombo(stored == null ? spec?.fallback : stored); };
  const onKeyDown = event => {
    if (paused || event.isComposing || event.keyCode === 229) return;
    const combo = comboFromEvent(event); if (!combo) return;
    const match = SHORTCUTS.find(item => handlers[item.id] && comboFor(item.id) === combo);
    if (!match) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    Promise.resolve().then(() => handlers[match.id]()).catch(error => { console.warn(error); if (error?.message) window.alert?.(error.message); });
  };
  window.addEventListener("keydown", onKeyDown, true);
  return {
    comboFor,
    // While the settings panel records a new shortcut, existing ones are off.
    pause(value) { paused = Boolean(value); },
    conflicts(id, combo) { return SHORTCUTS.filter(item => item.id !== id && combo && comboFor(item.id) === combo).map(item => t(item.label)); },
    cleanup() { window.removeEventListener("keydown", onKeyDown, true); }
  };
}
