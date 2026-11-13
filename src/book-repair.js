// One-step book repair. Runs every safe repair for a managed book in order and
// keeps one combined record, so a single Undo restores everything:
//   1. split paragraphs (only when the original EPUB is supplied)
//   2. numbered links
//   3. paragraph-repair archives (references moved to the repaired paragraph)
//   4. heading levels: chapters H1–H3, duplicate titles removed, other body
//      headings bold, footnote markers back on their heading (or plain text)
import { api } from "./graph.js";
import { documentHeaders, putDocument, readDocument } from "./reader-store.js";
import { applyHeadingRepair, previewHeadingRepair, undoHeadingRepair } from "./heading-repair.js";
import { applyLinkRepair, previewLinkRepair, undoLinkRepair } from "./repair.js";
import { applyArchiveCleanup, applyParagraphRepair, previewArchiveCleanup, previewParagraphRepair, undoArchiveCleanup, undoParagraphRepair } from "./paragraph-repair.js";
import { t } from "./i18n.js";

export function previewBookRepair(content, sourceBook = null) {
  if (content.ordinaryPage) throw new Error(t("Book repair is available for managed books only."));
  const paragraphs = sourceBook ? previewParagraphRepair(content, sourceBook) : null;
  const links = previewLinkRepair(content);
  const archives = previewArchiveCleanup(content);
  const headings = previewHeadingRepair(content);
  const counts = {
    paragraphs: paragraphs?.changes.length || 0,
    links: links.changes.length,
    archives: archives.removable.length,
    references: archives.references || 0,
    keptArchives: archives.archives.length - archives.removable.length,
    chapters: headings.counts.chapters,
    duplicates: headings.counts.duplicates,
    demoted: headings.changes.filter(change => change.type === "demote" && !change.footnote).length,
    footnotes: headings.changes.filter(change => change.footnote).length,
    merged: headings.counts.footnotes || 0
  };
  const total = counts.paragraphs + counts.links + counts.archives + counts.chapters + counts.duplicates + counts.demoted + counts.footnotes + counts.merged;
  return { bookKey: content.key, title: content.record.title, paragraphs, links, archives, headings, counts, total };
}

export function describeRepair(counts) {
  const lines = [];
  if (counts.paragraphs) lines.push(t("Rejoin {0} split paragraph(s) (checked against the original EPUB)", [counts.paragraphs]));
  if (counts.links) lines.push(t("Fix {0} block(s) with broken numbered links", [counts.links]));
  if (counts.archives) lines.push(t("Remove {0} EPUB-READER:paragraph-fragments archive(s){1}", [counts.archives, counts.references ? t("; {0} reference(s) to old fragments (comments, footnote links) move to the repaired paragraph", [counts.references]) : ""]));
  if (counts.chapters) lines.push(t("Set {0} chapter heading(s) to H1/H2/H3 by depth", [counts.chapters]));
  if (counts.duplicates) lines.push(t("Remove {0} heading(s) that repeat their chapter title (paragraphs move up, IDs unchanged)", [counts.duplicates]));
  if (counts.demoted) lines.push(t("Turn {0} other body heading(s) into bold text", [counts.demoted]));
  if (counts.merged) lines.push(t("Put {0} footnote marker(s) back at the end of their heading (e.g. \"2.3 Title [3]\"); the paragraphs under a marker move into the heading", [counts.merged]));
  if (counts.footnotes) lines.push(t("Turn {0} footnote marker heading(s) such as [3] into plain text", [counts.footnotes]));
  return lines;
}

// `reload` returns fresh content after each step (earlier steps change text
// and structure, and every step re-checks before writing).
export async function applyBookRepair(content, reload, { sourceBook = null, onProgress } = {}) {
  const key = `${content.key}:${Date.now()}:${api().util.generateUID()}`;
  const record = { key, bookKey: content.key, createdAt: Date.now(), steps: {}, results: { skipped: 0 } };
  const skipped = result => { record.results.skipped += result.skipped?.length || 0; };
  const save = () => putDocument("book-repair", key, record);
  await save();
  if (sourceBook) {
    onProgress?.(t("Rejoining split paragraphs…"));
    const plan = previewParagraphRepair(content, sourceBook);
    if (plan.changes.length) { const result = await applyParagraphRepair(plan); record.steps.paragraphs = result.key; record.results.paragraphs = result.applied.length; skipped(result); await save(); content = reload(); }
  }
  onProgress?.(t("Fixing numbered links…"));
  const links = previewLinkRepair(content);
  if (links.changes.length) { const result = await applyLinkRepair(links); record.steps.links = result.key; record.results.links = result.applied.length; skipped(result); await save(); content = reload(); }
  onProgress?.(t("Removing paragraph archives…"));
  const archives = previewArchiveCleanup(content);
  if (archives.removable.length) { const result = await applyArchiveCleanup(archives); record.steps.archives = result.key; record.results.archives = result.removed.length; skipped(result); record.results.references = result.retargeted.length; await save(); content = reload(); }
  onProgress?.(t("Fixing heading levels…"));
  const headings = previewHeadingRepair(content);
  if (headings.changes.length) { const result = await applyHeadingRepair(headings); record.steps.headings = result.key; record.results.headings = result.applied.length; skipped(result); await save(); }
  record.finishedAt = Date.now(); await save();
  return record;
}

export function latestBookRepair(content) {
  const headers = documentHeaders("book-repair").filter(header => header.key.startsWith(`${content.key}:`)).sort((a, b) => b.updatedAt - a.updatedAt);
  return headers[0] ? readDocument("book-repair", headers[0].key) : null;
}

export async function undoBookRepair(key) {
  const record = readDocument("book-repair", key);
  if (!record) throw new Error(t("No book repair record was found."));
  const result = { restored: 0, skipped: 0 };
  const add = value => { result.restored += value?.restored?.length || 0; result.skipped += value?.skipped?.length || 0; };
  if (record.steps.headings) add(await undoHeadingRepair(record.steps.headings));
  if (record.steps.archives) add(await undoArchiveCleanup(record.steps.archives));
  if (record.steps.links) add(await undoLinkRepair(record.steps.links));
  if (record.steps.paragraphs) add(await undoParagraphRepair(record.steps.paragraphs));
  await putDocument("book-repair", key, { ...record, undoneAt: Date.now(), undo: result });
  return result;
}
