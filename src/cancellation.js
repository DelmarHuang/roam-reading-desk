import { t } from "./i18n.js";
export function checkCancelled(signal) {
  if (signal?.aborted) { const error = new Error(t("Import paused because Reading Desk was disabled. Enable it to resume.")); error.name = "AbortError"; throw error; }
}
