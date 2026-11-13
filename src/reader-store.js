import { api, childrenOf, createBlock, pull, textOf, uidOf, updateBlock } from "./graph.js";
import { ensureMetadataPage } from './metadata-page.js';
import { t } from "./i18n.js";

const PREFIX = "EPUB-READER:DOC:1 ";
const CHUNK = "EPUB-READER:CHUNK:1 ";
const PAGE = "roam/epub-importer/reader";
const queues = new Map();
const parse = text => JSON.parse(text.slice(PREFIX.length));

export function documentHeaders(type) {
  return (api().data.q('[:find ?uid ?s :in $ ?prefix :where [?page :node/title ?page-title] [?page :block/children ?e] [?e :block/uid ?uid] [?e :block/string ?s] [(clojure.string/starts-with? ?s ?prefix)]]', PREFIX) || []).map(([uid, text]) => ({ uid, ...parse(text) })).filter(header => !type || header.type === type);
}

export function readDocument(type, key, headerHint) {
  const header = headerHint !== undefined ? headerHint : documentHeaders(type).filter(item => item.key === key).sort((a, b) => b.revision - a.revision)[0];
  if (!header) return null;
  const chunks = childrenOf(pull(header.uid)).filter(node => textOf(node).startsWith(CHUNK)).map(node => JSON.parse(textOf(node).slice(CHUNK.length))).filter(chunk => chunk.bank === header.bank && chunk.index < header.count).sort((a, b) => a.index - b.index);
  if (chunks.length !== header.count || chunks.some((chunk, index) => chunk.index !== index)) throw new Error(t("Reading metadata is incomplete. Refresh and retry; the original book is unaffected."));
  const joined = chunks.map(chunk => chunk.text).join("");
  const json = header.encoding === "base64-utf8" ? new TextDecoder().decode(Uint8Array.from(atob(joined), character => character.charCodeAt(0))) : joined;
  return JSON.parse(json);
}

export function putDocument(type, key, data) {
  const queueKey = `${type}:${key}`;
  const previous = queues.get(queueKey) || Promise.resolve();
  const json = JSON.stringify(data);
  // Store payload as plain encoded data, not live Roam markup. Repair backups
  // must not create duplicate #mark/page/block references in the graph.
  const snapshot = btoa([...new TextEncoder().encode(json)].map(byte => String.fromCharCode(byte)).join(""));
  const task = previous.catch(() => {}).then(async () => {
    const prior = documentHeaders(type).filter(item => item.key === key).sort((a, b) => b.revision - a.revision)[0];
    const parent = prior?.uid || await createBlock(await ensureMetadataPage(PAGE,[PREFIX,'EPUB-READER:PENDING:1 ']), `EPUB-READER:PENDING:1 ${queueKey}`);
    const bank = prior ? 1 - prior.bank : 0;
    const oldChunks = childrenOf(pull(parent)).filter(node => textOf(node).startsWith(CHUNK)).map(node => ({ uid: uidOf(node), ...JSON.parse(textOf(node).slice(CHUNK.length)) }));
    const count = Math.max(1, Math.ceil(snapshot.length / 2000));
    // Two banks retain the last complete state if a write is interrupted.
    // Reusing the inactive bank bounds storage instead of appending on scroll.
    for (let index = 0; index < count; index++) {
      const string = CHUNK + JSON.stringify({ bank, index, text: snapshot.slice(index * 2000, (index + 1) * 2000) });
      const old = oldChunks.find(chunk => chunk.bank === bank && chunk.index === index);
      if (old) await updateBlock({ uid: old.uid, string });
      else await createBlock(parent, string);
    }
    await updateBlock({ uid: parent, string: PREFIX + JSON.stringify({ type, key, bank, count, encoding: "base64-utf8", revision: (prior?.revision || 0) + 1, updatedAt: Date.now() }), open: false });
    return parent;
  });
  queues.set(queueKey, task);
  task.finally(() => { if (queues.get(queueKey) === task) queues.delete(queueKey); }).catch(() => {});
  return task;
}

export function readerMetadataUids() {
  const result = new Set();
  documentHeaders().forEach(header => {
    result.add(header.uid);
    childrenOf(pull(header.uid)).forEach(child => { if (textOf(child).startsWith(CHUNK)) result.add(uidOf(child)); });
  });
  return result;
}

export const storeInternals = { PREFIX, CHUNK, PAGE };
