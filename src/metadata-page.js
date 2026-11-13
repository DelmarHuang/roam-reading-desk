import { api, ensurePage, owningPage, titleOf } from './graph.js';
const pagesByApi = new WeakMap();
export function metadataPageUids(prefixes) {
  const pages = new Set();
  for (const prefix of prefixes) {
    const rows = api().data.q('[:find ?uid ?s :in $ ?prefix :where [?page :node/title ?page-title] [?page :block/children ?e] [?e :block/uid ?uid] [?e :block/string ?s] [(clojure.string/starts-with? ?s ?prefix)]]',prefix) || [];
    rows.forEach(([uid]) => { const page = owningPage(uid); if (page) pages.add(page.uid); });
  }
  return pages;
}
export async function ensureMetadataPage(title,prefixes) {
  let cache = pagesByApi.get(api()); if (!cache) { cache = new Map(); pagesByApi.set(api(),cache); }
  const previous = cache.get(title);
  if (previous && titleOf(api().data.pull('[:node/title]', [':block/uid',previous])) != null) return previous;
  // Discover legacy and renamed pages by record markers, across installations.
  const uid = [...metadataPageUids(prefixes)][0] || await ensurePage(title);
  cache.set(title,uid); return uid;
}
