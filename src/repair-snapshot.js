import { api, pull, textOf } from "./graph.js";

export const referencesTo = uid => (api().data.q("[:find ?u :in $ ?uid :where [?t :block/uid ?uid] [?b :block/refs ?t] [?b :block/uid ?u]]", uid) || []).map(row => row[0]).filter(other => other !== uid).sort();
export function referenceSnapshot(from, to) {
  return referencesTo(from).map(uid => {
    const before = textOf(pull(uid));
    return { uid, before, after: before.split(`((${from}))`).join(`((${to}))`) };
  });
}
export function referencesUnchanged(from, changes) {
  return JSON.stringify(referencesTo(from)) === JSON.stringify(changes.map(item => item.uid).sort()) &&
    changes.every(item => { const node = pull(item.uid); return node && textOf(node) === item.before && item.after !== item.before; });
}
// Compare graph state, never derive additional mutations at apply time.
export function fingerprint(uid) {
  const node = api().data.pull("[:block/uid :block/string :block/heading :block/open :block/order {:block/children [:block/uid :block/order]} {:block/parents [:block/uid]}]", [":block/uid", uid]);
  const canonical = value => Array.isArray(value) ? value.map(canonical).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return JSON.stringify(canonical(node));
}
