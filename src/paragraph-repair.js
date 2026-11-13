import { api, childrenOf, pull, textOf, uidOf, updateBlock, value } from './graph.js';
import { documentHeaders, putDocument, readDocument } from './reader-store.js';
import { t } from "./i18n.js";

export const FRAGMENT_ARCHIVE = 'EPUB-READER:paragraph-fragments';
const move = (uid,parentUid,order) => api().data.block.move({ block:{uid}, location:{'parent-uid':parentUid,order} });
const isChild = (uid,parentUid) => childrenOf(pull(parentUid)).some(node => uidOf(node) === uid);
const clean = text => text.replace(/\[\\\[\s*(\d+)\s*\\\]\]\(\(\([^()]+\)\)\)/g,'$1')
  .replace(/\[([^\]]+)\]\(\(\([^()]+\)\)\)/g,'$1').replace(/\[\s*(\d+)\s*\]/g,'$1')
  .replace(/\^\^|\*\*|__/g,'').replace(/\s+/g,' ').trim();
const compact = text => clean(text).replace(/\s/g,'');
const startsNote = text => /^\s*(?:\[\d+\]\(\(\([^()]+\)\)\)|\[\\\[\s*\d+\s*\\\]\]\(\(\([^()]+\)\)\))/.test(text.trimStart().replace(/^(?:\^\^|\*\*|__)+/,''));

// Require a complete paragraph from the original EPUB. Adjacency plus a
// numbered link alone cannot distinguish a broken paragraph from a real one.
export function previewParagraphRepair(content, book) {
  const links = new Map(book.links.map(link => [link.id,link.label]));
  const source = [];
  const walk = nodes => nodes.forEach(node => { if (node.kind !== 'toc' && !/⟦EPUBI:/.test(node.text)) source.push(clean(node.text.replace(/⟦EPUBL:([^⟧]+)⟧/g,(_,id) => links.get(id) || ''))); walk(node.children || []); });
  walk(book.chapters);
  const paragraphs = new Map(); source.forEach(text => { const key = compact(text); paragraphs.set(key,(paragraphs.get(key) || []).concat(text)); });
  const chapterUids = new Set(content.chapters.map(chapter => chapter.uid));
  const groups = new Map(); content.nodes.forEach(node => { if (node.parentUid) { if (!groups.has(node.parentUid)) groups.set(node.parentUid,[]); groups.get(node.parentUid).push(node); } });
  const changes = [];
  for (const siblings of groups.values()) {
    siblings.sort((a,b) => (value(a.node,'order') || 0) - (value(b.node,'order') || 0));
    for (let i = 0; i < siblings.length - 1; i++) {
      const first = siblings[i];
      if (chapterUids.has(first.uid) || value(first.node,'heading') || childrenOf(first.node).length || !first.text.trim() || /```|!\[|\$\$/.test(first.text)) continue;
      const parts = [first]; let joined = first.text;
      for (let j = i+1; j < siblings.length && j < i+8; j++) {
        const next = siblings[j];
        if (chapterUids.has(next.uid) || value(next.node,'heading') || childrenOf(next.node).length || next.chapterUid !== first.chapterUid || !startsNote(next.text) || /```|!\[|\$\$/.test(next.text)) break;
        parts.push(next); joined += next.text;
        const matches = paragraphs.get(compact(joined));
        if (matches?.length === 1) {
          const original = matches[0]; let after = first.text.trimEnd(); let prefix = clean(first.text);
          for (const part of parts.slice(1)) {
            const start = original.replace(/\s/g,'').indexOf(compact(prefix));
            let consumed = 0, at = 0;
            while (at < original.length && consumed < compact(prefix).length + Math.max(start,0)) { if (!/\s/.test(original[at])) consumed++; at++; }
            after += (/\s/.test(original[at] || '') ? ' ' : '') + part.text.trimStart(); prefix += part.text;
          }
          changes.push({ uid:first.uid, parentUid:first.parentUid, before:first.text, after, open:value(first.node,'open') ?? true,
            fragments:parts.slice(1).map(part => ({uid:part.uid, text:part.text, order:value(part.node,'order') || 0})), source:original });
          i = j; break;
        }
      }
    }
  }
  return { bookKey:content.key, title:content.record.title, sourceTitle:book.title, changes };
}

function unchanged(change) {
  const siblings = childrenOf(pull(change.parentUid));
  const index = siblings.findIndex(node => uidOf(node) === change.uid);
  return index >= 0 && textOf(siblings[index]) === change.before && !childrenOf(siblings[index]).length
    && change.fragments.every((fragment,i) => uidOf(siblings[index+i+1]) === fragment.uid && textOf(siblings[index+i+1]) === fragment.text && !childrenOf(siblings[index+i+1]).length);
}
export async function applyParagraphRepair(plan) {
  if (!api().data.block.move) throw new Error(t("This Roam version does not expose block.move. No paragraphs were changed."));
  const key = `${plan.bookKey}:${Date.now()}:${api().util.generateUID()}`;
  const backup = { ...plan, changes:plan.changes.map(change => ({...change,fragments:change.fragments.map(fragment => ({...fragment})),archiveUid:api().util.generateUID()})), key, createdAt:Date.now(), applied:[], skipped:[] };
  await putDocument('paragraph-repair',key,backup);
  try {
    for (const change of backup.changes) {
      if (!unchanged(change)) { backup.skipped.push(change.uid); continue; }
      // Every archive identity is already committed in the initial backup.
      await api().data.block.create({ location:{'parent-uid':change.uid,order:'last'}, block:{uid:change.archiveUid,string:FRAGMENT_ARCHIVE,open:false} });
      for (const fragment of change.fragments) await move(fragment.uid,change.archiveUid,'last');
      await updateBlock({uid:change.uid,string:change.after,open:false});
      backup.applied.push(change.uid);
    }
  } catch (error) { backup.error = error.message; await putDocument('paragraph-repair',key,backup); throw new Error(t("{0} Original fragment IDs are retained. Use Undo Last Paragraph Repair for interrupted changes.", [error.message])); }
  await putDocument('paragraph-repair',key,backup); return backup;
}
export function latestParagraphRepair(content) {
  const headers = documentHeaders('paragraph-repair').filter(header => header.key.startsWith(`${content.key}:`)).sort((a,b) => b.updatedAt-a.updatedAt);
  return headers[0] ? readDocument('paragraph-repair',headers[0].key) : null;
}
export async function undoParagraphRepair(key) {
  const backup = readDocument('paragraph-repair',key);
  if (!backup) throw new Error(t("Paragraph repair backup is missing."));
  const result = { restored:[], skipped:[] };
  for (const change of backup.changes) {
    if (!change.archiveUid || !pull(change.archiveUid)) continue;
    const current = pull(change.uid), archive = pull(change.archiveUid);
    const valid = current && [change.before,change.after].includes(textOf(current)) && isChild(change.uid,change.parentUid)
      && childrenOf(current).every(child => uidOf(child) === change.archiveUid)
      && textOf(archive) === FRAGMENT_ARCHIVE && isChild(change.archiveUid,change.uid)
      && childrenOf(archive).every(child => change.fragments.some(fragment => fragment.uid === uidOf(child)))
      && change.fragments.every(fragment => { const node = pull(fragment.uid); return node && textOf(node) === fragment.text && !childrenOf(node).length && (isChild(fragment.uid,change.archiveUid) || isChild(fragment.uid,change.parentUid)); });
    if (!valid) { result.skipped.push(change.uid); continue; }
    const order = childrenOf(pull(change.parentUid)).findIndex(node => uidOf(node) === change.uid);
    for (const [index,fragment] of change.fragments.entries()) await move(fragment.uid,change.parentUid,order+index+1);
    await updateBlock({uid:change.uid,string:change.before,open:change.open});
    await api().data.block.delete({block:{uid:change.archiveUid}});
    result.restored.push(change.uid);
  }
  await putDocument('paragraph-repair',key,{...backup, ...(result.skipped.length ? {} : {undoneAt:Date.now()}), undo:result});
  return result;
}

// Recovery archives left by Repair Split Paragraphs. They only exist to keep
// the original fragment UIDs reachable. The repaired paragraph already holds
// the fragment text, so references to a fragment (native comment threads,
// footnote back-links "[↩](((fragment)))") are pointed at the repaired
// paragraph and the archive is removed. Fragments with child blocks are kept.
const fragmentRefs = uid => (api().data.q('[:find ?u :in $ ?uid :where [?t :block/uid ?uid] [?b :block/refs ?t] [?b :block/uid ?u]]', uid) || []).map(row => row[0]).filter(other => other !== uid);
const retargetText = (text, from, to) => String(text || '').split(`((${from}))`).join(`((${to}))`);
export function previewArchiveCleanup(content) {
  const archives = [], seen = new Set();
  const consider = (child, parentUid, repaired) => {
    const uid = uidOf(child); if (seen.has(uid)) return; seen.add(uid);
    const fragments = childrenOf(child).map(fragment => ({ uid: uidOf(fragment), text: textOf(fragment), children: childrenOf(fragment).length, refs: fragmentRefs(uidOf(fragment)) }));
    const blocked = fragments.filter(fragment => fragment.children || (!repaired && fragment.refs.length));
    const references = fragments.reduce((sum, fragment) => sum + fragment.refs.length, 0);
    archives.push({ uid, parentUid, repaired, order: value(child, 'order') ?? 0, fragments, references, safe: !blocked.length, reason: blocked.length ? `${blocked.length} fragment(s) have child blocks${repaired ? '' : ' or references'}` : '' });
  };
  for (const item of content.nodes) for (const child of childrenOf(item.node)) if (textOf(child) === FRAGMENT_ARCHIVE) consider(child, item.uid, true);
  // Archives left directly on a book page (outside any paragraph).
  for (const pageUid of content.pages?.keys?.() || []) for (const child of childrenOf(pull(pageUid))) if (textOf(child) === FRAGMENT_ARCHIVE) consider(child, pageUid, false);
  return { bookKey: content.key, archives, removable: archives.filter(archive => archive.safe), references: archives.filter(archive => archive.safe).reduce((sum, archive) => sum + archive.references, 0) };
}
export async function applyArchiveCleanup(plan) {
  const key = `${plan.bookKey}:${Date.now()}:${api().util.generateUID()}`;
  const backup = { bookKey: plan.bookKey, archives: plan.removable, key, createdAt: Date.now(), removed: [], skipped: [], retargeted: [] };
  await putDocument('archive-cleanup', key, backup);
  for (const archive of plan.removable) {
    const node = pull(archive.uid);
    const current = node && childrenOf(node).map(fragment => uidOf(fragment));
    if (!node || textOf(node) !== FRAGMENT_ARCHIVE || current.join() !== archive.fragments.map(fragment => fragment.uid).join() || childrenOf(node).some(fragment => childrenOf(fragment).length)) { backup.skipped.push(archive.uid); continue; }
    const refs = archive.fragments.flatMap(fragment => fragmentRefs(fragment.uid).map(uid => [uid, fragment.uid]));
    if (refs.length && !archive.repaired) { backup.skipped.push(archive.uid); continue; }
    for (const [uid, fragmentUid] of refs) {
      const before = textOf(pull(uid)), after = retargetText(before, fragmentUid, archive.parentUid);
      if (after === before) continue;
      await updateBlock({ uid, string: after });
      backup.retargeted.push({ uid, before, after });
      await putDocument('archive-cleanup', key, backup);
    }
    await api().data.block.delete({ block: { uid: archive.uid } });
    backup.removed.push(archive.uid);
  }
  await putDocument('archive-cleanup', key, backup);
  return backup;
}
export function latestArchiveCleanup(content) {
  const headers = documentHeaders('archive-cleanup').filter(header => header.key.startsWith(`${content.key}:`)).sort((a,b) => b.updatedAt-a.updatedAt);
  return headers[0] ? readDocument('archive-cleanup', headers[0].key) : null;
}
export async function undoArchiveCleanup(key) {
  const backup = readDocument('archive-cleanup', key);
  if (!backup) throw new Error(t("Archive cleanup backup is missing."));
  const result = { restored: [], skipped: [] };
  for (const archive of backup.archives) {
    if (!backup.removed.includes(archive.uid) || pull(archive.uid) || !pull(archive.parentUid)) { result.skipped.push(archive.uid); continue; }
    await api().data.block.create({ location: { 'parent-uid': archive.parentUid, order: 'last' }, block: { uid: archive.uid, string: FRAGMENT_ARCHIVE, open: false } });
    for (const fragment of archive.fragments) await api().data.block.create({ location: { 'parent-uid': archive.uid, order: 'last' }, block: { uid: fragment.uid, string: fragment.text } });
    result.restored.push(archive.uid);
  }
  // Point references back at the original fragments.
  for (const change of [...(backup.retargeted || [])].reverse()) {
    const node = pull(change.uid);
    if (node && textOf(node) === change.after) { await updateBlock({ uid: change.uid, string: change.before }); result.restored.push(change.uid); } else result.skipped.push(change.uid);
  }
  await putDocument('archive-cleanup', key, { ...backup, undoneAt: Date.now(), undo: result });
  return result;
}
