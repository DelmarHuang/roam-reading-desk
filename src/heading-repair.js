// Heading repair for books imported before 0.4: chapters (the confirmed book
// catalog) become H1/H2/H3 by depth, a body heading that repeats its chapter
// title is removed (its children move up, UIDs unchanged), and other body
// headings become bold paragraphs. Preview first, full backup, undo available.
import { api, childrenOf, plain, pull, textOf, uidOf, updateBlock, value } from "./graph.js";
import { documentHeaders, putDocument, readDocument } from "./reader-store.js";
import { isFootnoteHeading } from "./catalog.js";
import { t } from "./i18n.js";

const key = text => plain(text).replace(/[\s　·•:：.。,，、\-—–_|]/g, "").toLowerCase();
const boldable = text => text && !/\*\*|!\[|\$\$|^\s*```/.test(text);
const move = (uid, parentUid, order) => api().data.block.move({ block: { uid }, location: { "parent-uid": parentUid, order } });
const referencedBy = uid => (api().data.q("[:find ?u :in $ ?uid :where [?t :block/uid ?uid] [?b :block/refs ?t] [?b :block/uid ?u]]", uid) || []).map(row => row[0]).filter(other => other !== uid);
const indexIn = (parentUid, uid) => childrenOf(pull(parentUid)).findIndex(node => uidOf(node) === uid);

export function previewHeadingRepair(content) {
  if (content.ordinaryPage) throw new Error(t("Heading repair is available for managed books only."));
  const chapters = new Map(content.chapters.map(chapter => [chapter.uid, chapter]));
  const depth = uid => { let level = 0, parent = chapters.get(uid)?.parentUid; const seen = new Set(); while (parent && chapters.has(parent) && !seen.has(parent)) { seen.add(parent); level++; parent = chapters.get(parent).parentUid; } return level; };
  const changes = [];
  for (const chapter of content.chapters) {
    const node = content.byUid.get(chapter.uid)?.node; if (!node) continue;
    const before = Number(value(node, "heading")) || 0, after = Math.min(3, depth(chapter.uid) + 1);
    if (before !== after) changes.push({ type: "chapter", uid: chapter.uid, text: textOf(node), before: { heading: before }, after: { heading: after } });
  }
  // Catalog entries below level 3 (folded into their H3 in Contents): the
  // fourth level becomes bold text, deeper levels plain text.
  for (const [uid, target] of content.chapterAliases || []) {
    const item = content.byUid.get(uid); if (!item || chapters.has(uid) || isFootnoteHeading(item.text)) continue;
    let level = depth(target) + 2, parent = content.record.catalog?.chapters?.find(chapter => chapter.uid === uid)?.parentUid; const seen = new Set();
    while (parent && !chapters.has(parent) && !seen.has(parent)) { seen.add(parent); level++; parent = content.record.catalog?.chapters?.find(chapter => chapter.uid === parent)?.parentUid; }
    if (level < 4) continue;
    const heading = Number(value(item.node, "heading")) || 0;
    const string = level === 4 && boldable(item.text) && !/^\s*\*\*[^]*\*\*\s*$/.test(item.text) ? `**${item.text.trim()}**` : item.text;
    if (heading || string !== item.text) changes.push({ type: "demote", uid, text: item.text, before: { heading, string: item.text }, after: { heading: 0, string }, deepEntry: true });
  }
  // Footnote markers split off their heading by old imports: "2.3 Title"
  // followed by a block "[3](((note)))" (often holding the whole section).
  // The marker goes back to the end of its heading, the section's paragraphs
  // move up into the heading, and links to the marker (the footnote's
  // back-link) point at the heading.
  // A lone marker belongs to the end of the text right before it: its
  // parent when it is the first child, otherwise its previous sibling.
  const allChapters = new Set([...(content.record.catalog?.chapters || []).map(chapter => chapter.uid), ...chapters.keys()]);
  const isTitle = uid => { const item = content.byUid.get(uid); return allChapters.has(uid) || Number(value(item?.node, "heading")) > 0 || /^\s*(\*\*|__)[^]*\1\s*$/.test(item?.text || ""); };
  for (const item of content.nodes) {
    if (chapters.has(item.uid) || !isFootnoteHeading(item.text) || !item.parentUid || !content.byUid.has(item.parentUid)) continue;
    const siblings = childrenOf(content.byUid.get(item.parentUid).node).map(uidOf), index = siblings.indexOf(item.uid);
    const previous = index > 0 ? siblings[index - 1] : null;
    const target = previous && !isFootnoteHeading(content.byUid.get(previous)?.text) && content.byUid.get(previous)?.text.trim() ? previous : item.parentUid;
    const targetText = content.byUid.get(target)?.text ?? "";
    if (!targetText.trim() || isFootnoteHeading(targetText)) continue;
    // Paragraphs under the marker (often a whole section) go under the
    // heading it belongs to; under a plain paragraph they stay where they are.
    const intoParent = target === item.parentUid || !isTitle(target);
    changes.push({ type: "footnote", uid: item.uid, text: item.text, heading: Number(value(item.node, "heading")) || 0, open: value(item.node, "open") !== false, parentUid: item.parentUid, order: index, targetUid: target, intoParent, targetText, targetAfter: `${targetText.trimEnd()} ${item.text.trim()}`, childUids: childrenOf(item.node).map(uidOf) });
  }
  const handled = new Set(changes.map(change => change.uid));
  for (const item of content.nodes) {
    if (chapters.has(item.uid) || handled.has(item.uid)) continue;
    const heading = Number(value(item.node, "heading")) || 0; if (!heading) continue;
    const chapter = chapters.get(content.chapterAliases?.get(item.uid) || item.chapterUid);
    const duplicate = chapter && key(item.text) === key(chapter.title);
    if (duplicate && item.parentUid) {
      const blockers = referencedBy(item.uid);
      if (!blockers.length && !/\^\^|#mark|\[\[mark\]\]/.test(item.text)) {
        changes.push({ type: "duplicate", uid: item.uid, text: item.text, parentUid: item.parentUid, heading, open: value(item.node, "open") !== false, childUids: childrenOf(item.node).map(uidOf), chapterTitle: chapter.title });
        continue;
      }
    }
    // Footnote markers formatted as headings become plain text, not bold.
    const footnote = isFootnoteHeading(item.text);
    const string = !footnote && boldable(item.text) ? `**${item.text.trim()}**` : item.text;
    changes.push({ type: "demote", uid: item.uid, text: item.text, before: { heading, string: item.text }, after: { heading: 0, string }, duplicateKept: Boolean(duplicate), footnote });
  }
  return { bookKey: content.key, title: content.record.title, changes, counts: { chapters: changes.filter(change => change.type === "chapter").length, duplicates: changes.filter(change => change.type === "duplicate").length, demoted: changes.filter(change => change.type === "demote").length, footnotes: changes.filter(change => change.type === "footnote").length } };
}

export async function applyHeadingRepair(plan, types = ["chapter", "duplicate", "demote", "footnote"]) {
  const allowed = new Set(types);
  // Footnote merges change their heading's text, so they run last.
  const changes = plan.changes.filter(change => allowed.has(change.type)).sort((a, b) => (a.type === "footnote") - (b.type === "footnote"));
  if (changes.some(change => change.type === "duplicate") && !api().data.block.move) throw new Error(t("This Roam version does not expose block.move. No headings were changed."));
  const backupKey = `${plan.bookKey}:${Date.now()}:${api().util.generateUID()}`;
  const backup = { ...plan, changes, key: backupKey, createdAt: Date.now(), applied: [], skipped: [] };
  await putDocument("heading-repair", backupKey, backup);
  try {
    for (const change of changes) {
      const node = pull(change.uid);
      if (!node || textOf(node) !== change.text) { backup.skipped.push(change.uid); continue; }
      if (change.type === "chapter") await updateBlock({ uid: change.uid, heading: change.after.heading });
      else if (change.type === "demote") await updateBlock({ uid: change.uid, heading: 0, string: change.after.string });
      else if (change.type === "footnote") {
        const target = pull(change.targetUid), children = childrenOf(node).map(uidOf);
        if (!target || textOf(target) !== change.targetText || children.join() !== change.childUids.join()) { backup.skipped.push(change.uid); continue; }
        await updateBlock({ uid: change.targetUid, string: change.targetAfter });
        change.retargeted = [];
        for (const uid of referencedBy(change.uid)) {
          const before = textOf(pull(uid)), after = before.split(`((${change.uid}))`).join(`((${change.targetUid}))`);
          if (after !== before) { await updateBlock({ uid, string: after }); change.retargeted.push({ uid, before, after }); }
        }
        const at = change.intoParent ? indexIn(change.parentUid, change.uid) : childrenOf(target).length;
        for (const [index, child] of children.entries()) await move(child, change.intoParent ? change.parentUid : change.targetUid, at + index);
        await api().data.block.delete({ block: { uid: change.uid } });
      }
      else {
        const children = childrenOf(node).map(uidOf);
        if (children.join() !== change.childUids.join() || referencedBy(change.uid).length) { backup.skipped.push(change.uid); continue; }
        change.order = indexIn(change.parentUid, change.uid);
        if (change.order < 0) { backup.skipped.push(change.uid); continue; }
        for (const [index, child] of children.entries()) await move(child, change.parentUid, change.order + index);
        await api().data.block.delete({ block: { uid: change.uid } });
      }
      backup.applied.push(change.uid);
    }
  } catch (error) { backup.error = error.message; await putDocument("heading-repair", backupKey, backup); throw new Error(t("{0} Use Undo Last Heading Repair to restore what was changed.", [error.message])); }
  await putDocument("heading-repair", backupKey, backup);
  return backup;
}

export function latestHeadingRepair(content) {
  const headers = documentHeaders("heading-repair").filter(header => header.key.startsWith(`${content.key}:`)).sort((a, b) => b.updatedAt - a.updatedAt);
  return headers[0] ? readDocument("heading-repair", headers[0].key) : null;
}

export async function undoHeadingRepair(backupKey) {
  const backup = readDocument("heading-repair", backupKey);
  if (!backup) throw new Error(t("No heading repair backup was found."));
  const result = { restored: [], skipped: [] };
  for (const change of [...backup.changes].reverse()) {
    if (!backup.applied.includes(change.uid)) continue;
    const node = pull(change.uid);
    if (change.type === "footnote") {
      const target = pull(change.targetUid);
      if (node || !target || textOf(target) !== change.targetAfter || !change.childUids.every(uid => childrenOf(target).some(child => uidOf(child) === uid))) { result.skipped.push(change.uid); continue; }
      await api().data.block.create({ location: { "parent-uid": change.parentUid, order: Math.min(change.order, childrenOf(pull(change.parentUid)).length) }, block: { uid: change.uid, string: change.text, heading: change.heading, open: change.open } });
      for (const [index, child] of change.childUids.entries()) await move(child, change.uid, index);
      await updateBlock({ uid: change.targetUid, string: change.targetText });
      for (const item of [...(change.retargeted || [])].reverse()) { const ref = pull(item.uid); if (ref && textOf(ref) === item.after) await updateBlock({ uid: item.uid, string: item.before }); }
      result.restored.push(change.uid); continue;
    }
    if (change.type === "chapter") {
      if (node && (Number(value(node, "heading")) || 0) === change.after.heading) { await updateBlock({ uid: change.uid, heading: change.before.heading }); result.restored.push(change.uid); } else result.skipped.push(change.uid);
    } else if (change.type === "demote") {
      if (node && textOf(node) === change.after.string) { await updateBlock({ uid: change.uid, heading: change.before.heading, string: change.before.string }); result.restored.push(change.uid); } else result.skipped.push(change.uid);
    } else {
      const children = childrenOf(pull(change.parentUid)).map(uidOf);
      const start = children.indexOf(change.childUids[0]);
      const inPlace = !node && (change.childUids.length === 0 ? true : change.childUids.every((uid, index) => children[start + index] === uid));
      if (!inPlace) { result.skipped.push(change.uid); continue; }
      const order = change.childUids.length ? start : Math.min(change.order ?? 0, children.length);
      await api().data.block.create({ location: { "parent-uid": change.parentUid, order }, block: { uid: change.uid, string: change.text, heading: change.heading, open: change.open } });
      for (const [index, child] of change.childUids.entries()) await move(child, change.uid, index);
      result.restored.push(change.uid);
    }
  }
  await putDocument("heading-repair", backupKey, { ...backup, undoneAt: Date.now(), undo: result });
  return result;
}
