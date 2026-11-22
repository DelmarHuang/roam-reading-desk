import { checkCancelled } from "./cancellation.js";
// Extension settings can belong to a particular developer-extension identity.
// Keep the authoritative ledger in the graph, not in that identity's settings.
import { putDocument, readDocument } from "./reader-store.js";
import { owningPage } from "./graph.js";
import { ensureMetadataPage, metadataPageUids, metadataRows } from './metadata-page.js';
import { t } from "./i18n.js";
const settingsCache = new WeakMap();
const SETTINGS_KEY = "managed-books-v1";
const LIBRARY_TITLE = "roam/epub-importer/library";
const RECORD_PREFIX = "EPUB-IMPORTER:BOOK:1 ";
const CHUNK_PREFIX = "EPUB-IMPORTER:ASSETS:1 ";
const PENDING_PREFIX = "EPUB-IMPORTER:PENDING:1 ";
const CHUNK_SIZE = 12;
const api = () => window.roamAlphaAPI;
const uidOf = node => node?.[":block/uid"] || node?.uid;
const stringOf = node => node?.[":block/string"] ?? node?.string ?? "";
const childrenOf = node => node?.[":block/children"] || node?.children || [];
const titleOf = node => node?.[":node/title"] ?? node?.title;
const keyOf = record => record.libraryKey || record.pageUid || record.id;

function parseJson(text, prefix) {
  if (!text.startsWith(prefix)) throw new Error(t("Invalid library format. Stopped to protect existing data."));
  try { return JSON.parse(text.slice(prefix.length)); }
  catch { throw new Error(t("Cannot read the library. Stopped to protect existing data.")); }
}

async function cacheSettings(extensionAPI, books) {
  if (extensionAPI.settings?.canSet === false) return;
  const fingerprint = JSON.stringify(books);
  if (settingsCache.get(extensionAPI) === fingerprint) return;
  // A missing settings cache must not turn a committed graph write into a
  // failed import. Old extension identities may not be writable any more.
  try { await extensionAPI.settings?.set?.(SETTINGS_KEY, books); settingsCache.set(extensionAPI, fingerprint); } catch { /* graph is authoritative */ }
}

function readGraphLibrary() {
  const rows = metadataRows(LIBRARY_TITLE, RECORD_PREFIX);
  const latest = new Map();
  const metadataUids = new Set();
  for (const [uid, text] of rows) {
    const metadata = parseJson(text, RECORD_PREFIX);
    if (metadata.schema !== 1 || !metadata.key || !Number.isInteger(metadata.sequence) || !["active", "deleted"].includes(metadata.state)) {
      throw new Error(t("Unsupported library version or structure. Stopped to protect existing data."));
    }
    // Exclude only actual ledger blocks from attachment reference checks.
    // Plain URL references anywhere else in the graph still protect the file.
    metadataUids.add(uid);
    const tree = api().data.pull("[:block/uid :block/string {:block/children ...}]", [":block/uid", uid]);
    for (const child of childrenOf(tree)) {
      if (stringOf(child).startsWith(CHUNK_PREFIX)) metadataUids.add(uidOf(child));
    }
    const prior = latest.get(metadata.key);
    if (!prior || metadata.sequence > prior.metadata.sequence || (metadata.sequence === prior.metadata.sequence && `${metadata.updatedAt}:${uid}` > `${prior.metadata.updatedAt}:${prior.uid}`)) {
      latest.set(metadata.key, { uid, metadata, tree });
    }
  }
  const books = [];
  for (const { metadata, tree } of latest.values()) {
    if (metadata.state === "deleted") continue;
    const chunks = childrenOf(tree).filter(child => stringOf(child).startsWith(CHUNK_PREFIX)).map(child => parseJson(stringOf(child), CHUNK_PREFIX)).sort((a, b) => a.index - b.index);
    if (chunks.length !== metadata.chunkCount || chunks.some((chunk, index) => chunk.index !== index || !Array.isArray(chunk.attachments))) {
      throw new Error(t("The attachment ledger is incomplete. Stopped to protect attachments."));
    }
    const attachments = chunks.flatMap(chunk => chunk.attachments);
    if (attachments.length !== metadata.attachmentCount || !metadata.record?.id) throw new Error(t("Attachment ledger validation failed."));
    const record = { ...metadata.record, libraryKey: metadata.key, attachments };
    if (record.catalogKey) record.catalog = readDocument("book-catalog", record.catalogKey);
    // Follow renames by UID; a title is a display label, never the identity.
    if (record.pageUid && (!record.catalog?.confirmed || record.catalog.rootUids.some(uid => owningPage(uid)?.uid === record.pageUid))) {
      const current = api().data.pull("[:node/title]", [":block/uid", record.pageUid]);
      if (titleOf(current)) record.title = titleOf(current);
    }
    books.push(record);
  }
  return { books, metadataUids, latest };
}

async function ensureLibraryPage(signal) {
  return ensureMetadataPage(LIBRARY_TITLE,[RECORD_PREFIX,PENDING_PREFIX],signal);
}

async function writeSnapshot(record, state, library, signal) {
  const key = keyOf(record);
  if (!key) throw new Error(t("The book record has no stable identity."));
  const parentUid = await ensureLibraryPage(signal);
  const uid = api().util.generateUID();
  const attachments = state === "deleted" ? [] : (record.attachments || []);
  const { attachments: ignored, ...summary } = record;
  const metadata = {
    schema: 1, key, state,
    sequence: (library.latest.get(key)?.metadata.sequence || 0) + 1,
    updatedAt: new Date().toISOString(),
    record: { ...summary, libraryKey: key },
    chunkCount: Math.ceil(attachments.length / CHUNK_SIZE), attachmentCount: attachments.length
  };
  // Append a new snapshot, then publish it only after all chunks exist. An
  // interrupted write cannot replace a complete ledger with a partial one.
  checkCancelled(signal);
  await api().data.block.create({ location: { "parent-uid": parentUid, order: "last" }, block: { uid, string: `${PENDING_PREFIX}${key}`, open: false } });
  for (let index = 0; index < metadata.chunkCount; index++) {
    checkCancelled(signal);
  await api().data.block.create({
      location: { "parent-uid": uid, order: index },
      block: { uid: api().util.generateUID(), string: CHUNK_PREFIX + JSON.stringify({ index, attachments: attachments.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE) }), open: false }
    });
  }
  checkCancelled(signal);
  await api().data.block.update({ block: { uid, string: RECORD_PREFIX + JSON.stringify(metadata), open: false } });
}

export async function getManagedLibrary(extensionAPI, signal) {
  checkCancelled(signal);
  let library = readGraphLibrary();
  const cached = extensionAPI.settings?.get?.(SETTINGS_KEY);
  // Automatically migrate old trusted records, but never resurrect a book
  // explicitly deleted in the graph by a newer copy of the extension.
  for (const record of Array.isArray(cached) ? cached : []) {
    if (!record?.id || !keyOf(record) || library.latest.has(keyOf(record))) continue;
    await writeSnapshot(record, "active", library, signal);
    library = readGraphLibrary();
  }
  await cacheSettings(extensionAPI, library.books);
  return library;
}

export async function getManagedBooks(extensionAPI, signal) {
  return (await getManagedLibrary(extensionAPI, signal)).books;
}

export async function saveManagedBook(extensionAPI, record, signal) {
  checkCancelled(signal);
  const library = await getManagedLibrary(extensionAPI, signal);
  const { catalog, ...summary } = record;
  if (catalog) {
    await putDocument("book-catalog", keyOf(record), catalog, signal);
    summary.catalogKey = keyOf(record);
  }
  await writeSnapshot(summary, "active", library, signal);
  await cacheSettings(extensionAPI, readGraphLibrary().books);
}

export async function forgetManagedBook(extensionAPI, record, signal) {
  checkCancelled(signal);
  const library = await getManagedLibrary(extensionAPI, signal);
  await writeSnapshot(record, "deleted", library);
  await cacheSettings(extensionAPI, readGraphLibrary().books);
}

const normalizeTitle = title => title.normalize("NFKC").replace(/[\p{P}\p{S}\s]/gu, "").toLowerCase();

export function findRecoveryPages(search) {
  const input = search.trim();
  if (input.length < 2) throw new Error(t("Enter at least two characters of the page title."));
  const needle = normalizeTitle(input);
  const rows = api().data.q("[:find ?uid ?title :where [?e :node/title ?title] [?e :block/uid ?uid]]") || [];
  const internal = metadataPageUids([RECORD_PREFIX,PENDING_PREFIX,'EPUB-READER:DOC:1 ','EPUB-READER:PENDING:1 ']);
  return rows.filter(([uid, title]) => !internal.has(uid) && title !== LIBRARY_TITLE && title !== 'roam/epub-importer/reader' && normalizeTitle(title).includes(needle)).map(([pageUid, title]) => ({ pageUid, title })).slice(0, 30);
}

export async function recoverExistingBook(pageUid, extensionAPI, signal) {
  checkCancelled(signal);
  const library = await getManagedLibrary(extensionAPI, signal);
  const existing = library.books.find(record => record.pageUid === pageUid || record.catalog?.rootUids.some(uid => {
    const root = api().data.pull("[{:block/parents [:block/uid]}]", [":block/uid", uid]);
    return (root?.[":block/parents"] || []).some(parent => uidOf(parent) === pageUid);
  }));
  if (existing) return existing;
  const tree = api().data.pull("[:block/uid :node/title :block/string {:block/children ...}]", [":block/uid", pageUid]);
  if (!titleOf(tree) || [LIBRARY_TITLE,'roam/epub-importer/reader'].includes(titleOf(tree)) || metadataPageUids([RECORD_PREFIX,PENDING_PREFIX,'EPUB-READER:DOC:1 ','EPUB-READER:PENDING:1 ']).has(pageUid)) throw new Error(t("The specified book page could not be found."));
  const urls = new Set();
  let blocks = 0;
  const visit = node => {
    blocks++;
    for (const match of stringOf(node).matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)) urls.add(match[1]);
    childrenOf(node).forEach(visit);
  };
  childrenOf(tree).forEach(visit);
  const record = {
    id: `recovered-${pageUid}`, libraryKey: pageUid, pageUid, title: titleOf(tree),
    recoveredAt: new Date().toISOString(), status: "recovered", stats: { blocks },
    // Seeing a URL in a page does NOT prove that this plugin uploaded it.
    attachments: [...urls].map(url => ({ url, ownership: "unknown" }))
  };
  await saveManagedBook(extensionAPI, record, signal);
  return record;
}

export const libraryInternals = { RECORD_PREFIX, CHUNK_PREFIX, PENDING_PREFIX, LIBRARY_TITLE, readGraphLibrary };
