import { checkCancelled } from "./cancellation.js";
import { api, ensurePage, childrenOf, textOf, uidOf, titleOf } from './graph.js';
const pagesByApi = new WeakMap();
const SETTINGS_KEY = 'metadata-page-uids-v1';
const TITLES = ['roam/epub-importer/library', 'roam/epub-importer/reader'];
let settings;
function cache() { let found = pagesByApi.get(api()); if (!found) { found = new Map(); pagesByApi.set(api(), found); } return found; }
export async function configureMetadataPages(extensionAPI) {
  settings = extensionAPI.settings;
  const stored = settings?.get?.(SETTINGS_KEY) || {};
  for (const title of TITLES) if (typeof stored[title] === 'string') cache().set(title, stored[title]);
  TITLES.forEach(metadataPage);
  await persist();
}
async function persist() {
  try { await settings?.set?.(SETTINGS_KEY, Object.fromEntries(cache())); } catch { /* title lookups remain available */ }
}
export function metadataPage(title) {
  const previous = cache().get(title);
  const pattern = '[:block/uid :node/title {:block/children [:block/uid :block/string]}]';
  if (previous) { const node = api().data.pull(pattern, [':block/uid', previous]); if (titleOf(node) != null) return node; }
  const node = api().data.pull(pattern, [':node/title', title]);
  if (uidOf(node)) cache().set(title, uidOf(node));
  return node;
}
export function metadataRows(title, prefix) {
  return childrenOf(metadataPage(title)).filter(node => textOf(node).startsWith(prefix)).map(node => [uidOf(node), textOf(node)]);
}
export function metadataPageUids(prefixes) {
  const titles = TITLES.filter(title => prefixes.some(prefix => title.endsWith('/reader') ? prefix.startsWith('EPUB-READER:') : prefix.startsWith('EPUB-IMPORTER:')));
  return new Set(titles.map(title => uidOf(metadataPage(title))).filter(Boolean));
}
export async function ensureMetadataPage(title, prefixes, signal) {
  const previous = uidOf(metadataPage(title));
  if (previous) return previous;
  checkCancelled(signal);
  const uid = await ensurePage(title);
  cache().set(title, uid); await persist(); return uid;
}
