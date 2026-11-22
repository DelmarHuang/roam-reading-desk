import { checkCancelled } from "./cancellation.js";
import { removeJob, saveJob } from "./storage.js";
import { prepareBlockPlan, writeBlockPlan } from "./writer.js";
import { forgetManagedBook, getManagedBooks, getManagedLibrary, saveManagedBook } from "./library.js";
export { getManagedBooks } from "./library.js";
import { catalogFromPlan, readBookContent, safeRootTrees } from "./catalog.js";
import { readerMetadataUids } from "./reader-store.js";
import { flatten, owningPage, pull as pullTree, textOf, uidOf as graphUid } from "./graph.js";
import { t } from "./i18n.js";

let importInProgress = false;
let importController;
let importsEnabled = true;
export function enableImports() { importsEnabled = true; }
export function cancelImports() { importsEnabled = false; importController?.abort(); }

const roam = () => window.roamAlphaAPI;

function pullUid(value) {
  return value?.[":block/uid"] || value?.uid || null;
}

export function findPageUid(title) {
  return pullUid(roam().data.pull("[:block/uid]", [":node/title", title]));
}

export function makeUniquePageTitle(title) {
  const base = (title || "Untitled EPUB").trim();
  if (!findPageUid(base)) return base;
  let number = 2;
  while (findPageUid(`${base} (${number})`)) number += 1;
  return `${base} (${number})`;
}

export function createImportJob(book, requestedTitle = book.title) {
  return {
    id: `${book.id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requestedTitle: (requestedTitle || book.title || "Untitled EPUB").trim(),
    book,
    assetEmbeds: {},
    attachments: [],
    progress: { stage: "ready", assetIndex: 0, chapterIndex: 0, pageUid: null, pageTitle: null },
    error: null
  };
}

function extensionFor(mediaType) {
  return ({
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif"
  })[mediaType] || "bin";
}

function safeFilename(asset, mediaType) {
  const original = asset.path.split("/").pop() || `image.${extensionFor(mediaType)}`;
  const stem = original.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 80) || "image";
  return `${stem}-${asset.hash?.slice(0, 10) || asset.id}.${extensionFor(mediaType)}`;
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(t("Image conversion failed"))), "image/png"));
}

async function rasterizeImage(asset) {
  const blob = new Blob([asset.bytes], { type: asset.mediaType });
  let bitmap;
  if (typeof createImageBitmap === "function") {
    try { bitmap = await createImageBitmap(blob); } catch { /* use Image fallback */ }
  }
  let width;
  let height;
  let draw;
  if (bitmap) {
    width = bitmap.width;
    height = bitmap.height;
    draw = context => context.drawImage(bitmap, 0, 0);
  } else {
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error(t("Cannot read image: {0}", [asset.path])));
        element.src = url;
      });
      width = image.naturalWidth;
      height = image.naturalHeight;
      draw = context => context.drawImage(image, 0, 0);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const scale = Math.min(1, 4096 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.scale(scale, scale);
  draw(context);
  context.restore();
  bitmap?.close?.();
  return new File([await canvasBlob(canvas)], safeFilename(asset, "image/png"), { type: "image/png" });
}

async function assetFile(asset) {
  if (["image/png", "image/jpeg"].includes(asset.mediaType)) {
    return new File([asset.bytes], safeFilename(asset, asset.mediaType), { type: asset.mediaType });
  }
  return rasterizeImage(asset);
}

function uploadedUrl(result) {
  if (typeof result !== "string") return "";
  const match = result.match(/!\[.*?\]\((.*?)\)/);
  return match?.[1] || (/^https?:\/\//i.test(result) ? result : "");
}

async function uploadAssets(job, extensionAPI, onProgress, signal) {
  const known = new Map();
  job.attachments.forEach(item => {
    if (item.hash && item.url) known.set(item.hash, item.url);
  });
  (await getManagedBooks(extensionAPI, signal)).forEach(book => (book.attachments || []).forEach(item => {
    if (item.ownership === "unknown") return;
    if (item.hash && item.url) known.set(item.hash, item.url);
  }));
  job.progress.stage = "images";
  for (let index = job.progress.assetIndex || 0; index < job.book.assets.length; index += 1) {
    checkCancelled(signal);
    const asset = job.book.assets[index];
    onProgress?.({ stage: "images", current: index + 1, total: job.book.assets.length, message: t("Processing image {0}/{1}", [index + 1, job.book.assets.length]) });
    if (asset.missing || !asset.bytes) {
      job.assetEmbeds[asset.id] = `[Missing EPUB image: ${asset.path}]`;
    } else {
      let url = known.get(asset.hash);
      let reused = Boolean(url);
      if (!url) {
        const file = await assetFile(asset);
        checkCancelled(signal);
        const result = await roam().file.upload({ file, toast: { hide: true } });
        url = uploadedUrl(result);
        if (!url) throw new Error(t("Image upload returned no valid URL: {0}", [asset.path]));
        known.set(asset.hash, url);
        reused = false;
      }
      job.assetEmbeds[asset.id] = `![](${url})`;
      if (!job.attachments.some(item => item.hash === asset.hash && item.url === url)) {
        job.attachments.push({ hash: asset.hash, url, path: asset.path, reused });
      }
    }
    job.progress.assetIndex = index + 1;
    job.updatedAt = new Date().toISOString();
    await saveJob(job);
  }
}
function childrenOf(node) {
  return node?.[":block/children"] || node?.children || [];
}
function uidOf(node) {
  return node?.[":block/uid"] || node?.uid;
}

function flattenTree(root) {
  const output = [];
  const visit = node => {
    if (uidOf(node)) output.push(node);
    childrenOf(node).forEach(visit);
  };
  visit(root);
  return output;
}
async function ensurePage(job, signal) {
  if (!job.progress.pageUid) {
    job.progress.pageUid = roam().util.generateUID();
    job.progress.pageTitle = makeUniquePageTitle(job.requestedTitle);
    await saveJob(job);
  }
  if (!roam().data.pull("[:block/uid]", [":block/uid", job.progress.pageUid])) {
    if (job.progress.blockIndex > 0) throw new Error(t("The imported page was removed. Select the EPUB again to import."));
    checkCancelled(signal);
    await roam().data.page.create({ page: { title: job.progress.pageTitle, uid: job.progress.pageUid } });
  }
  job.progress.stage = "chapters";
  await saveJob(job);
}
export async function runImport(job, extensionAPI, onProgress) {
  if (!importsEnabled) throw new Error(t("Reading Desk is disabled. Enable it before importing."));
  if (importInProgress) throw new Error(t("A book is already being imported. Wait for it to finish."));
  importInProgress = true;
  importController = new AbortController();
  const signal = importController.signal;
  try {
    if (![3, 4].includes(job.book?.parserVersion)) throw new Error(t("This legacy job has incorrect chapter mappings. Select the EPUB again to create a new import."));
    job.error = null;
    await saveJob(job);
    checkCancelled(signal);
    await uploadAssets(job, extensionAPI, onProgress, signal);
    checkCancelled(signal);
    await ensurePage(job, signal);
    prepareBlockPlan(job, () => roam().util.generateUID());
    await saveJob(job);
    await writeBlockPlan(job, roam(), { checkpoint: saveJob, onProgress, signal });
    const record = {
      id: job.id,
      fileHash: job.book.fileHash,
      filename: job.book.filename,
      title: job.progress.pageTitle,
      author: job.book.author,
      pageUid: job.progress.pageUid,
      importedAt: new Date().toISOString(),
      attachments: job.attachments,
      stats: job.book.stats,
      catalog: catalogFromPlan(job),
      status: "complete"
    };
    checkCancelled(signal);
    await saveManagedBook(extensionAPI, record, signal);
    checkCancelled(signal);
    job.progress.stage = "complete";
    onProgress?.({ stage: "complete", current: 1, total: 1, message: t("Import complete") });
    await removeJob(job.id);
    checkCancelled(signal);
    await roam().ui.mainWindow.openPage({ page: { uid: record.pageUid } });
    return record;
  } catch (error) {
    job.error = error?.message || String(error);
    job.updatedAt = new Date().toISOString();
    await saveJob(job);
    throw error;
  } finally {
    importInProgress = false;
    importController = null;
  }
}

function collectBookUids(record) {
  if (!record.pageUid) return new Set();
  const tree = roam().data.pull("[:block/uid {:block/children ...}]", [":block/uid", record.pageUid]);
  return new Set(tree ? flattenTree(tree).map(uidOf) : []);
}

export async function prepareBookDeletion(record, extensionAPI) {
  const library = await getManagedLibrary(extensionAPI);
  const key = record.libraryKey || record.pageUid || record.id;
  record = library.books.find(book => (book.libraryKey || book.pageUid || book.id) === key);
  if (!record) throw new Error(t("This book's record has changed or was removed. Reopen the book list."));
  const content = record.status === "cleanup-needed" ? null : readBookContent(record, { allowSuggested: false });
  const rootUids = content ? safeRootTrees(content) : [];
  if (rootUids.some(uid => flatten(pullTree(uid)).some(node => textOf(node).trim() === "[[roam/comments]]"))) throw new Error(t("A native comment store is inside the chapter scope. Deletion is blocked to preserve comments. Keep the comment store on the page outside the book chapters first."));
  const bookUids = new Set(rootUids.flatMap(uid => flatten(pullTree(uid)).map(graphUid)));
  const metadataUids = new Set([...library.metadataUids, ...readerMetadataUids()]);
  const others = library.books.filter(item => item.id !== record.id || item.pageUid !== record.pageUid);
  let rows, indexedReferences;
  try {
    indexedReferences = bookUids.size ? roam().data.q("[:find ?sourceUid :in $ [?targetUid ...] :where [?target :block/uid ?targetUid] [?source :block/refs ?target] [?source :block/uid ?sourceUid]]", [...bookUids]) || [] : [];
    rows = roam().data.q("[:find ?uid ?s :where [?e :block/uid ?uid] [?e :block/string ?s]]") || [];
  } catch (error) {
    return {
      record,
      pageExists: Boolean(record.pageUid && roam().data.pull("[:block/uid]", [":block/uid", record.pageUid])),
      scanFailed: true,
      rootUids, blockUids: [...bookUids], blockCount: bookUids.size, pages: content ? [...content.pages.values()] : [], externalBlockReferences: 0,
      error: error?.message || String(error),
      attachments: (record.attachments || []).map(item => ({ ...item, safe: false, reason: t("Reference check failed; retained") }))
    };
  }
  const unique = new Map();
  (record.attachments || []).forEach(item => {
    if (item.url && !unique.has(item.url)) unique.set(item.url, item);
  });
  const attachments = [...unique.values()].map(item => {
    const shared = others.some(book => (book.attachments || []).some(candidate => candidate.url === item.url || (candidate.hash && candidate.hash === item.hash)));
    const outsideReferences = rows.filter(([uid, value]) => !bookUids.has(uid) && !metadataUids.has(uid) && typeof value === "string" && value.includes(item.url)).length;
    const unknownOwnership = item.ownership === "unknown";
    const safe = !unknownOwnership && !shared && outsideReferences === 0;
    return { ...item, shared, outsideReferences, safe, reason: unknownOwnership ? t("Original upload ownership is unknown; retained") : shared ? t("Shared with another imported book") : outsideReferences ? t("{0} references outside this book", [outsideReferences]) : t("Used only by this book") };
  });
  const externalUids = new Set([...indexedReferences.filter(([uid]) => !bookUids.has(uid) && !metadataUids.has(uid)).map(([uid]) => uid), ...rows.filter(([uid, text]) => !bookUids.has(uid) && !metadataUids.has(uid) && typeof text === "string" && [...text.matchAll(/\(\(([^()\s]+)\)\)/g)].some(match => bookUids.has(match[1]))).map(([uid]) => uid)]);
  const textByUid = new Map(rows);
  const externalReferences = [...externalUids].map(uid => ({ uid, text: String(textByUid.get(uid) || "").slice(0, 240), page: owningPage(uid) }));
  return {
    record,
    rootUids, blockUids: [...bookUids], blockCount: bookUids.size, pages: content ? [...content.pages.values()] : [],
    externalBlockReferences: externalUids.size,
    externalReferences,
    pageExists: Boolean(record.pageUid && roam().data.pull("[:block/uid]", [":block/uid", record.pageUid])),
    scanFailed: false,
    attachments
  };
}

export async function deleteManagedBook(plan, extensionAPI, onProgress) {
  const approvedUrls = new Set(plan.attachments.filter(item => item.safe).map(item => item.url));
  const approvedBlocks = new Set(plan.rootUids);
  const approvedBody = new Set(plan.blockUids);
  // Recheck immediately before deleting; references may have changed while
  // the confirmation dialog was open.
  plan = await prepareBookDeletion(plan.record, extensionAPI);
  if (plan.scanFailed) throw new Error(t("Reference check failed; deletion stopped."));
  if (plan.externalBlockReferences) throw new Error(t("This book has references from outside its chapters. Remove those references before deleting the book."));
  const record = plan.record;
  plan.attachments = plan.attachments.map(item => ({ ...item, safe: item.safe && approvedUrls.has(item.url) }));
  if (plan.rootUids.some(uid => !approvedBlocks.has(uid))) throw new Error(t("Chapter scope changed. Review the deletion preview again."));
  if (plan.blockUids.some(uid => !approvedBody.has(uid))) throw new Error(t("New content was added inside the book scope. Deletion stopped; review the preview again."));
  for (const uid of plan.rootUids) {
    onProgress?.(t("Deleting book chapters (preserving pages and native comments)…"));
    const current = flatten(pullTree(uid)).map(graphUid);
    if (current.some(id => !approvedBody.has(id))) throw new Error(t("New content was added inside the book scope. Deletion stopped; review the preview again."));
    // Recheck each subtree after earlier awaited deletions as well.
    const references = current.length ? roam().data.q("[:find ?sourceUid :in $ [?targetUid ...] :where [?target :block/uid ?targetUid] [?source :block/refs ?target] [?source :block/uid ?sourceUid]]", current) || [] : [];
    if (references.some(([source]) => !approvedBody.has(source))) throw new Error(t("This book has references from outside its chapters. Remove those references before deleting the book."));
    await roam().data.block.delete({ block: { uid } });
  }
  const safe = plan.attachments.filter(item => item.safe);
  const failures = [];
  for (let index = 0; index < safe.length; index += 1) {
    onProgress?.(t("Deleting attachment {0}/{1}…", [index + 1, safe.length]));
    try { await roam().file.delete({ url: safe[index].url }); }
    catch (error) { failures.push({ ...safe[index], error: error?.message || String(error) }); }
  }
  const preserved = plan.attachments.filter(item => !item.safe);
  if (failures.length) {
    await saveManagedBook(extensionAPI, { ...record, libraryKey: record.libraryKey || record.pageUid || record.id, pageUid: null, attachments: failures, status: "cleanup-needed", cleanupError: "Some attachments could not be deleted" });
  } else await forgetManagedBook(extensionAPI, record);
  return { deletedAttachments: safe.length - failures.length, preservedAttachments: preserved.length, failures };
}

// Remove a book's images without deleting the book: image embeds are taken
// out of the book's blocks (a block that held only an image is deleted when
// nothing else depends on it), and uploaded files used only by this book are
// deleted from Roam storage. Text, headings, comments and highlights stay.
const IMAGE_RE = /!\[[^\]]*\]\(([^()\s]+(?:\([^()\s]*\)[^()\s]*)*)\)|\{\{\[?\[?(?:img|image)\]?\]?:\s*([^}\s]+)\s*\}\}/gi;
export const imageUrlsIn = text => [...String(text || "").matchAll(IMAGE_RE)].map(match => match[1] || match[2]);
export const stripImages = text => String(text || "").replace(IMAGE_RE, "").replace(/[ \t]{2,}/g, " ").replace(/^[ \t]+|[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();

export async function prepareImageRemoval(record, extensionAPI) {
  const library = await getManagedLibrary(extensionAPI);
  const key = record.libraryKey || record.pageUid || record.id;
  record = library.books.find(book => (book.libraryKey || book.pageUid || book.id) === key);
  if (!record) throw new Error(t("This book's record has changed or was removed. Reopen the book list."));
  if (record.status === "cleanup-needed") throw new Error(t("This book is waiting for attachment cleanup. Finish that first."));
  const content = readBookContent(record, { allowSuggested: false });
  const bookUids = new Set(content.nodes.map(node => node.uid));
  const blocks = [];
  for (const item of content.nodes) {
    const urls = imageUrlsIn(item.text);
    if (!urls.length) continue;
    const after = stripImages(item.text);
    const children = (item.node?.[":block/children"] || []).length;
    let referenced = 0;
    try { referenced = (roam().data.q("[:find ?u :in $ ?uid :where [?t :block/uid ?uid] [?b :block/refs ?t] [?b :block/uid ?u]]", item.uid) || []).filter(row => row[0] !== item.uid).length; } catch { referenced = 1; }
    blocks.push({ uid: item.uid, before: item.text, after, urls, remove: !after && !children && !referenced && !content.catalog.chapters.some(chapter => chapter.uid === item.uid) });
  }
  const usedUrls = new Set(blocks.flatMap(block => block.urls));
  const metadataUids = new Set([...library.metadataUids, ...readerMetadataUids()]);
  const others = library.books.filter(item => (item.libraryKey || item.pageUid || item.id) !== key);
  let rows = null;
  try { rows = roam().data.q("[:find ?uid ?s :where [?e :block/uid ?uid] [?e :block/string ?s]]") || []; } catch { rows = null; }
  const ledger = new Map((record.attachments || []).filter(item => item.url).map(item => [item.url, item]));
  const files = [...new Set([...ledger.keys(), ...usedUrls])].map(url => {
    const item = ledger.get(url) || { url, ownership: "unknown" };
    if (!ledger.has(url)) return { ...item, safe: false, reason: t("Not uploaded by this import; file retained") };
    if (item.ownership === "unknown") return { ...item, safe: false, reason: t("Original upload ownership is unknown; file retained") };
    if (!rows) return { ...item, safe: false, reason: t("Reference check failed; file retained") };
    const shared = others.some(book => (book.attachments || []).some(candidate => candidate.url === url || (candidate.hash && candidate.hash === item.hash)));
    const outside = rows.filter(([uid, text]) => !bookUids.has(uid) && !metadataUids.has(uid) && typeof text === "string" && text.includes(url)).length;
    return { ...item, shared, outsideReferences: outside, safe: !shared && !outside, reason: shared ? t("Shared with another imported book") : outside ? t("{0} references outside this book", [outside]) : t("Used only by this book") };
  });
  return { record, blocks, files, bookUids: [...bookUids] };
}

export async function removeBookImages(plan, extensionAPI, { deleteFiles = true, onProgress } = {}) {
  const approved = new Set(plan.files.filter(item => item.safe).map(item => item.url));
  const result = { updated: 0, deleted: 0, skipped: 0, filesDeleted: 0, failures: [] };
  for (const [index, block] of plan.blocks.entries()) {
    onProgress?.(t("Removing images from blocks {0}/{1}…", [index + 1, plan.blocks.length]));
    const node = roam().data.pull("[:block/string {:block/children [:block/uid]}]", [":block/uid", block.uid]);
    if (!node || node[":block/string"] !== block.before) { result.skipped++; continue; }
    if (block.remove && !(node[":block/children"] || []).length) { await roam().data.block.delete({ block: { uid: block.uid } }); result.deleted++; }
    else { await roam().data.block.update({ block: { uid: block.uid, string: block.after } }); result.updated++; }
  }
  const kept = [];
  if (deleteFiles) {
    const files = plan.files.filter(item => item.safe && approved.has(item.url));
    for (const [index, file] of files.entries()) {
      onProgress?.(t("Deleting image file {0}/{1}…", [index + 1, files.length]));
      try { await roam().file.delete({ url: file.url }); result.filesDeleted++; }
      catch (error) { result.failures.push({ url: file.url, error: error?.message || String(error) }); kept.push(file.url); }
    }
  }
  const removed = new Set(deleteFiles ? plan.files.filter(item => item.safe && !kept.includes(item.url)).map(item => item.url) : []);
  const record = plan.record;
  await saveManagedBook(extensionAPI, { ...record, libraryKey: record.libraryKey || record.pageUid || record.id, attachments: (record.attachments || []).filter(item => !removed.has(item.url)), imagesRemovedAt: new Date().toISOString() });
  return result;
}

export const roamInternals = { flattenTree, uploadedUrl };
