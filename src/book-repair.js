import { previewImageRepair, applyImageRepair, undoImageRepair } from "./image-repair.js";
// One-step book repair. Runs every safe repair for a managed book in order and
// keeps one combined record, so a single Undo restores everything:
//   1. split paragraphs (only when the original EPUB is supplied)
//   2. numbered links
//   3. paragraph-repair archives (references moved to the repaired paragraph)
//   4. heading levels: known chapters and uniquely matched source headings;
//      previewed duplicate/footnote cleanup, preserving manual headings
import { api } from "./graph.js";
import { documentHeaders, putDocument, readDocument } from "./reader-store.js";
import { applyHeadingRepair, previewHeadingRepair, undoHeadingRepair } from "./heading-repair.js";
import { applyLinkRepair, previewLinkRepair, undoLinkRepair } from "./repair.js";
import { applyArchiveCleanup, applyParagraphRepair, previewArchiveCleanup, previewParagraphRepair, undoArchiveCleanup, undoParagraphRepair } from "./paragraph-repair.js";
import { t } from "./i18n.js";
import { fingerprint } from "./repair-snapshot.js";
import { previewNavigationRepair } from './book-navigation.js';

export function previewBookRepair(content, sourceBook = null, { splitImages = false } = {}) {
  if (content.ordinaryPage) throw new Error(t("Book repair is available for managed books only."));
  const paragraphs = sourceBook ? previewParagraphRepair(content, sourceBook) : null;
  const links = previewLinkRepair(content);
  const archives = previewArchiveCleanup(content);
  const headings = previewHeadingRepair(content, sourceBook);
  const navigation = previewNavigationRepair(content, sourceBook);
  const images = splitImages ? previewImageRepair(content) : null;
  const counts = {
    images: images?.changes.length || 0,
    navigation: navigation?.changes ? navigation.after.chapters.length : 0,
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
  const total = counts.images + counts.paragraphs + counts.links + counts.archives + counts.chapters + counts.duplicates + counts.demoted + counts.footnotes + counts.merged + counts.navigation;
  const refs = [...headings.changes.flatMap(change => change.referenceChanges || []), ...archives.removable.flatMap(archive => archive.fragments.flatMap(fragment => fragment.referenceChanges || []))];
  const uids = new Set([...content.byUid.keys(), ...content.pages.keys(), ...refs.map(item => item.uid)]);
  const expected = [...uids].map(uid => ({ uid, state: fingerprint(uid) }));
  return { bookKey: content.key, title: content.record.title, paragraphs, links, archives, headings, navigation, images, counts, total, expected };
}

export function describeRepair(counts) {
  const lines = [];
  if (counts.images) lines.push(t("Separate images and text in {0} blocks; keep text IDs and child blocks", [counts.images]));
  if (counts.navigation) lines.push(t("Replace the panel Contents with {0} entries from the original EPUB directory (body headings stay separate)", [counts.navigation]));
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

// Execute only the approved snapshot. Earlier steps may invalidate later
// entries; their preconditions skip those entries instead of replanning.
export async function applyBookRepair(approvedPlan, { onProgress } = {}) {
  const plan = JSON.parse(JSON.stringify(approvedPlan));
  if (!Array.isArray(plan.expected) || plan.expected.some(item => fingerprint(item.uid) !== item.state)) throw Object.assign(new Error(t("Book or referenced content changed since preview. Preview the repair again.")), { code: "STALE_REPAIR_PREVIEW" });
  if (plan.navigation?.changes && JSON.stringify(readDocument('book-navigation', plan.bookKey)) !== JSON.stringify(plan.navigation.before)) throw Object.assign(new Error(t("Book or referenced content changed since preview. Preview the repair again.")), { code: "STALE_REPAIR_PREVIEW" });
  const key = `${plan.bookKey}:${Date.now()}:${api().util.generateUID()}`;
  const record = { key, bookKey: plan.bookKey, createdAt: Date.now(), steps: {}, results: { skipped: 0 } };
  const skipped = result => { record.results.skipped += result.skipped?.length || 0; };
  const save = () => putDocument("book-repair", key, record);
  await save();
  if (plan.paragraphs) {
    onProgress?.(t("Rejoining split paragraphs…"));
    const paragraphs = plan.paragraphs;
    if (paragraphs.changes.length) { const result = await applyParagraphRepair(paragraphs); record.steps.paragraphs = result.key; record.results.paragraphs = result.applied.length; skipped(result); await save(); }
  }
  onProgress?.(t("Fixing numbered links…"));
  const links = plan.links;
  if (links.changes.length) { const result = await applyLinkRepair(links); record.steps.links = result.key; record.results.links = result.applied.length; skipped(result); await save(); }
  onProgress?.(t("Removing paragraph archives…"));
  const archives = plan.archives;
  if (archives.removable.length) { const result = await applyArchiveCleanup(archives); record.steps.archives = result.key; record.results.archives = result.removed.length; skipped(result); record.results.references = result.retargeted.length; await save(); }
  onProgress?.(t("Fixing heading levels…"));
  const headings = plan.headings;
  if (headings.changes.length) { const result = await applyHeadingRepair(headings); record.steps.headings = result.key; record.results.headings = result.applied.length; skipped(result); await save(); }
  if (plan.navigation?.changes) {
    if (plan.navigation.after.chapters.every(chapter => api().data.pull('[:block/uid]', [':block/uid', chapter.uid]))) {
      record.steps.navigation = plan.navigation; await save();
      await putDocument('book-navigation', plan.bookKey, plan.navigation.after);
      record.results.navigation = plan.navigation.after.chapters.length;
    } else record.results.skipped++;
  }
  if (plan.images) await applyImageRepair(plan.images, record, save);
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
  if (record.steps.images) {
    const images = await undoImageRepair(record, () => putDocument("book-repair", key, record));
    result.restored += images.restored; result.skipped += images.skipped;
  }
  if (record.steps.navigation) {
    if (JSON.stringify(readDocument('book-navigation', record.bookKey)) === JSON.stringify(record.steps.navigation.after)) {
      await putDocument('book-navigation', record.bookKey, record.steps.navigation.before); result.restored++;
    } else result.skipped++;
  }
  if (record.steps.headings) add(await undoHeadingRepair(record.steps.headings));
  if (record.steps.archives) add(await undoArchiveCleanup(record.steps.archives));
  if (record.steps.links) add(await undoLinkRepair(record.steps.links));
  if (record.steps.paragraphs) add(await undoParagraphRepair(record.steps.paragraphs));
  await putDocument("book-repair", key, { ...record, undoneAt: Date.now(), undo: result });
  return result;
}
