import { api, bookKey, childrenOf, owningPage, plain, pull, textOf, titleOf, uidOf, value } from "./graph.js";
import { saveManagedBook } from "./library.js";
import { FRAGMENT_ARCHIVE } from './paragraph-repair.js';
import { chapterNodeKind } from "./writer.js";
import { t } from "./i18n.js";
import { readDocument } from './reader-store.js';
import { sourceNavigation } from './book-navigation.js';
export { chapterNodeKind };

export const isCommentRoot = node => textOf(node).trim() === "[[roam/comments]]";
const chapterTitle = text => plain(text).replace(/\s+/g, "");
const isMetadata = node => isCommentRoot(node) || /^#?\[\[Book\]\]$|^#Book\s*$/i.test(textOf(node).trim()) || /^EPUB-(?:IMPORTER|READER):/.test(textOf(node));
// Contents are recognised from Roam headings only: H1, H2 and H3.
// Footnote markers that books format as headings ("[3](((uid)))" shows as
// "3¹", "[12]", "Note 3", "*") are not chapters and never appear in Contents.
export function isFootnoteHeading(text) {
  const bare = String(text || "").replace(/\\([\[\]])/g, "$1")
    .replace(/\[\[([^\]]*)\]\]\(/g, "[$1](")
    .replace(/\[([^\]]*)\]\((?:\(\([^()]*\)\)|[^()]*)\)/g, "$1")
    .replace(/\(\([^()]*\)\)/g, "")
    .replace(/<\/?su[pb]>|\^\^|\*\*|__|~~/g, "")
    .replace(/[\s\u00a0]/g, "");
  if (!/^[\[\(（【〔]?(?:\u6ce8|\u8a3b|note|fn)?[\[\(（【〔]?(?:\d{1,4}|[ivxlc]{1,6}|[*†‡§]{1,3}|[①-⑳])[\]\)）】〕.、:：]*$/i.test(bare)) return false;
  // A bare "3" or "IV" can be a real chapter title; it is a footnote only
  // when it links to a block or page, or is bracketed, prefixed or a symbol.
  return /\]\(|\(\(/.test(String(text)) || /^[\[\(（【〔]|^(?:\u6ce8|\u8a3b|note|fn)|^[*†‡§①-⑳]/i.test(bare);
}
export const headingLevel = node => { const level = Number(value(node, "heading")) || 0; return level >= 1 && level <= 3 && !isFootnoteHeading(textOf(node)) ? level : 0; };
const isHeading = node => headingLevel(node) > 0;
const SKIP_PROGRESS = /^(?:封面|目录|版权页|前置图文|扉页|Cover|Contents|Copyright|Front matter|Title page|Before contents)$/i;

// Document-order outline from H1–H3. A heading covers its own children and the
// following siblings until a heading of the same or higher level. Works for
// nested outlines and for flat pages where paragraphs follow a heading.
export function headingOutline(roots, { rootsAreChapters = false, progress = false } = {}) {
  const chapters = [], chapterOf = new Map(), aliases = new Map();
  // One stack across all top-level blocks: on flat pages a heading covers the
  // following top-level paragraphs too.
  const stack = [], path = new Set(["#root"]);
  for (const root of roots) {
    const visit = (node, parentUid) => {
      if (!node || isMetadata(node) || textOf(node) === FRAGMENT_ARCHIVE) return;
      const uid = uidOf(node);
      while (stack.length && !path.has(stack.at(-1).scope)) stack.pop();
      const level = node === root && rootsAreChapters ? 0 : headingLevel(node);
      if (node === root && rootsAreChapters) {
        const title = plain(textOf(node)).slice(0, 150) || "(Untitled)";
        chapters.push({ uid, title, parentUid: null, level: 0, progress: progress && !SKIP_PROGRESS.test(textOf(node)) });
        stack.push({ uid, level: 0, scope: "#root", title });
      } else if (level) {
        while (stack.length && stack.at(-1).level >= level) stack.pop();
        const parent = stack.at(-1), title = plain(textOf(node)).slice(0, 150) || "(Untitled)";
        if (parent && chapterTitle(title) === chapterTitle(parent.title)) aliases.set(uid, parent.uid);
        else { chapters.push({ uid, title, parentUid: parent?.uid ?? null, level, progress: progress && !SKIP_PROGRESS.test(title) }); stack.push({ uid, level, scope: parentUid ?? "#root", title }); }
      }
      chapterOf.set(uid, stack.at(-1)?.uid ?? null);
      path.add(uid); childrenOf(node).forEach(child => visit(child, uid)); path.delete(uid);
    };
    visit(root, null);
  }
  return { chapters, chapterOf, aliases };
}

// Called before finishing new imports. Only chapter entry UIDs are recorded;
// paragraph strings, comments and highlights are never copied or rewritten.
export function catalogFromPlan(job) {
  const byNode = new Map();
  let index = 0;
  const walk = nodes => nodes.forEach(node => { byNode.set(node, job.blockPlan[index++].uid); walk(node.children || []); });
  walk(job.book.chapters);
  const chapters = [];
  // Only TOC levels 1–3 (written as H1–H3) are chapters in Contents.
  const visit = (nodes, parent = null, level = 0) => nodes.forEach(node => {
    const uid = byNode.get(node);
    const chapter = chapterNodeKind(node, parent, job.book) && level < 3;
    if (chapter) chapters.push({ uid, title: plain(node.text) || node.text, parentUid: parent, progress: !SKIP_PROGRESS.test(node.text) });
    visit(node.children || [], chapter ? uid : parent, chapter ? level + 1 : level);
  });
  visit(job.book.chapters);
  const navigation = sourceNavigation(job.book, node => byNode.get(node));
  return { version: 1, confirmed: true, source: "import", headings: true, rootUids: job.book.chapters.map(node => byNode.get(node)), chapters,
    ...(navigation && !navigation.unmatched.length ? {navigation: {source: navigation.source, chapters: navigation.chapters}} : {}) };
}

export function suggestCatalog(record, pageUid = record.pageUid) {
  const page = pull(pageUid);
  if (!page) throw new Error(t("The original page no longer exists. Open the book's current page, select this book, and link its chapters. No reimport is needed."));
  const roots = childrenOf(page).filter(node => !isMetadata(node));
  const { chapters } = headingOutline(roots, { rootsAreChapters: true, progress: true });
  return { version: 1, confirmed: false, source: "legacy", rootUids: roots.map(uidOf), chapters: chapters.map(({ level, ...chapter }) => chapter) };
}

export async function confirmCatalog(record, proposed, selectedRootUids, extensionAPI) {
  const selected = new Set(selectedRootUids);
  const allowed = new Set(proposed.rootUids);
  if (!selected.size || [...selected].some(uid => !allowed.has(uid) || !pull(uid))) throw new Error(t("Select at least one existing book chapter."));
  const keep = new Set();
  proposed.chapters.forEach(chapter => { if ((!chapter.parentUid && selected.has(chapter.uid)) || keep.has(chapter.parentUid)) keep.add(chapter.uid); });
  const catalog = { ...proposed, confirmed: true, rootUids: [...selected], chapters: proposed.chapters.filter(chapter => keep.has(chapter.uid)) };
  const updated = { ...record, catalog };
  await saveManagedBook(extensionAPI, updated);
  return updated;
}

export function readBookContent(record, { allowSuggested = true } = {}) {
  let catalog = record.catalog?.confirmed ? record.catalog : allowSuggested ? suggestCatalog(record) : null;
  if (!catalog) throw new Error(t("Confirm this book's chapter scope in the reading panel first. No reimport or text changes are required."));
  const rootTrees = new Map(catalog.rootUids.map(uid => [uid, pull(uid)]));
  const navigation = String(record.id || '').startsWith('page:') ? null : readDocument('book-navigation', bookKey(record)) || catalog.navigation;
  // Imported scope stays fixed, while Contents follows current H1–H3.
  // A source-assisted repair need not rewrite the old import catalog.
  if (navigation) catalog = {...catalog, chapters: navigation.chapters};
  else if (catalog.headings || catalog.source === "legacy") {
    // Older linked/recovered books have no `headings` flag. Their confirmed
    // roots remain chapters even without H1, but descendants must also follow
    // current headings instead of the stale chapter list saved when linked.
    const outline = headingOutline([...rootTrees.values()].filter(Boolean), {
      rootsAreChapters: !catalog.headings && catalog.source === "legacy",
      progress: !String(record.id || "").startsWith("page:")
    });
    catalog = { ...catalog, chapters: outline.chapters };
  }
  const chapterByUid = new Map(catalog.chapters.map(chapter => [chapter.uid, chapter]));
  const nodes = [];
  const byUid = new Map();
  const parentByUid = new Map();
  const pages = new Map();
  const missing = [];
  const fragmentAliases = new Map();
  // A chapter covers its children and, on flat pages, the following siblings
  // until the next chapter of the same or higher level.
  const levels = new Map();
  const levelOf = uid => { if (levels.has(uid)) return levels.get(uid); let level = 1, parent = chapterByUid.get(uid)?.parentUid; const seen = new Set(); while (parent && chapterByUid.has(parent) && !seen.has(parent)) { seen.add(parent); level++; parent = chapterByUid.get(parent).parentUid; } levels.set(uid, level); return level; };
  const stack = [], path = new Set(["#root"]);
  const visit = (node, parentUid) => {
    if (!node || isCommentRoot(node)) return;
    if (textOf(node) === FRAGMENT_ARCHIVE) { childrenOf(node).forEach(fragment => fragmentAliases.set(uidOf(fragment),parentUid)); return; }
    const uid = uidOf(node);
    if (byUid.has(uid)) return;
    while (stack.length && !path.has(stack.at(-1).scope)) stack.pop();
    if (chapterByUid.has(uid)) { const level = levelOf(uid); while (stack.length && stack.at(-1).level >= level) stack.pop(); stack.push({ uid, level, scope: parentUid ?? "#root" }); }
    const chapterUid = stack.at(-1)?.uid ?? null;
    const item = { uid, text: textOf(node), chapterUid, parentUid, node };
    nodes.push(item); byUid.set(uid, item); parentByUid.set(uid, parentUid);
    path.add(uid); childrenOf(node).forEach(child => visit(child, uid)); path.delete(uid);
  };
  for (const uid of catalog.rootUids) {
    const root = rootTrees.get(uid);
    if (!root) { missing.push(uid); continue; }
    if (titleOf(root)) throw new Error(t("Chapter scope cannot include an entire page. Confirm the book chapters again; the page will be retained."));
    const page = owningPage(uid);
    if (page) pages.set(page.uid, page.title);
    visit(root, null);
  }
  const chapterAliases = new Map(), visibleChapters = [], seenChapters = new Set();
  const resolve = uid => { const visited = new Set(); while (chapterAliases.has(uid) && !visited.has(uid)) { visited.add(uid); uid = chapterAliases.get(uid); } return uid; };
  for (const chapter of catalog.chapters) {
    if (seenChapters.has(chapter.uid) || !byUid.has(chapter.uid)) continue;
    seenChapters.add(chapter.uid);
    const parentUid = resolve(chapter.parentUid);
    const parent = visibleChapters.find(candidate => candidate.uid === parentUid);
    let depth = 0, ancestor = parent; const chain = new Set();
    while (ancestor && !chain.has(ancestor.uid)) { chain.add(ancestor.uid); depth++; ancestor = visibleChapters.find(candidate => candidate.uid === ancestor.parentUid); }
    // Contents stop at three levels (H1–H3); deeper entries fold into theirs.
    // Footnote markers stored as chapters by older catalogs ("[3](((uid)))").
    if (!navigation && isFootnoteHeading(byUid.get(chapter.uid).text)) chapterAliases.set(chapter.uid, parent?.uid ?? null);
    else if (!navigation && depth >= 3 && parent) chapterAliases.set(chapter.uid, parent.uid);
    else if (!navigation && catalog.source !== "import" && parent && isHeading(byUid.get(chapter.uid).node) && chapterTitle(chapter.title) === chapterTitle(parent.title)) chapterAliases.set(chapter.uid, parent.uid);
    else visibleChapters.push({ ...chapter, parentUid });
  }
  nodes.forEach(node => { node.chapterUid = resolve(node.chapterUid); });
  catalog = { ...catalog, chapters: visibleChapters };
  return { key: bookKey(record), record, catalog, nodes, byUid, parentByUid, pages, missing, chapterAliases, fragmentAliases, chapters: visibleChapters };
}

export function contentForPage(uid) {
  const tree = pull(uid);
  if (!tree) throw new Error(t("The current page or block cannot be read."));
  const roots = childrenOf(tree).filter(node => !isMetadata(node));
  const { chapters } = headingOutline(roots);
  const catalog = { confirmed: true, headings: true, rootUids: roots.map(uidOf), chapters: chapters.map(({ level, ...chapter }) => ({ ...chapter, progress: false })) };
  // Reuse the same traversal without registering an ordinary page as a book.
  const record = { id: `page:${uid}`, pageUid: uid, catalog, title: tree[":node/title"] || plain(textOf(tree)).slice(0, 60) };
  if (!roots.length && textOf(tree)) { catalog.rootUids = [uid]; catalog.chapters = headingLevel(tree) ? [{ uid, title: plain(textOf(tree)).slice(0, 60), parentUid: null, progress: false }] : []; }
  return { ...readBookContent(record), ordinaryPage: true };
}

export function safeRootTrees(content) {
  const all = new Set(content.catalog.rootUids);
  return content.catalog.rootUids.filter(uid => {
    const root = api().data.pull("[:block/uid {:block/parents [:block/uid]}]", [":block/uid", uid]);
    return root && !(value(root, "parents") || []).some(parent => all.has(uidOf(parent)));
  });
}
