import { plain, value } from './graph.js';
import { chapterNodeKind } from './writer.js';

const key = text => plain(text).replace(/\s+/g, '').replace(/\*\*|__/g, '');
// plain() removes images, so an illustrated caption can otherwise collide
// with a real heading. Keep media-bearing blocks distinct during matching.
const hasImage = text => /!\[[^\]]*\]\(|⟦EPUBI:/.test(text || '');
// Match within the same uniquely identified chapter root. Repeated titles,
// edited text and missing roots are deliberately left unchanged. No moving,
// deleting, or rewriting text is needed to restore heading formatting.
export function matchSourceHeadings(content, book, { navigationOnly = false } = {}) {
  const result = [];
  const linkLabels = new Map((book.links || []).map(link => [link.id, link.label]));
  const sourceKey = node => key(node.text.replace(/⟦EPUBL:([^⟧]+)⟧/g, (_, id) => linkLabels.get(id) || ""));
  const matchesSource = (item, node) => hasImage(item.text) === hasImage(node.text) && key(item.text) === sourceKey(node);
  const roots = (content.catalog?.rootUids || content.record.catalog?.rootUids || []).map(uid => content.byUid.get(uid)).filter(Boolean);
  const under = (item, uid) => {
    const seen = new Set();
    while (item && !seen.has(item.uid)) {
      if (item.uid === uid) return true;
      seen.add(item.uid); item = content.byUid.get(item.parentUid);
    }
    return false;
  };
  for (const root of book.chapters) {
    const matches = roots.filter(item => matchesSource(item, root));
    if (matches.length !== 1 || book.chapters.filter(other => sourceKey(other) === sourceKey(root)).length !== 1) continue;
    const targetRoot = matches[0];
    const source = [];
    const visit = (node, parent, depth) => {
      const heading = chapterNodeKind(node, parent, book);
      if (navigationOnly ? node.kind === "toc" : heading && depth < 3) source.push({ node, parent, level: depth + 1 });
      (node.children || []).forEach(child => visit(child, node, depth + (heading ? 1 : 0)));
    };
    visit(root, null, 0);
    const items = content.nodes.filter(item => under(item, targetRoot.uid));
    const matchedNodes = new Map([[root, targetRoot]]);
    for (const entry of source) {
      if (source.filter(other => sourceKey(other.node) === sourceKey(entry.node) && (!navigationOnly || other.parent === entry.parent)).length !== 1) continue;
      let candidates = items.filter(item => matchesSource(item, entry.node));
      if (navigationOnly && candidates.length > 1 && matchedNodes.has(entry.parent)) {
        // Explicit TOC ancestry distinguishes an entry from a repeated body
        // heading; two matching direct children remain ambiguous.
        candidates = candidates.filter(item => item.parentUid === matchedNodes.get(entry.parent).uid);
      }
      if (navigationOnly && candidates.length > 1) {
        const children = (entry.node.children || []).filter(node => !hasImage(node.text) && sourceKey(node));
        if (children.length) candidates = candidates.filter(item => children.every(child =>
          items.some(candidate => candidate.parentUid === item.uid && matchesSource(candidate, child))));
      }
      if (candidates.length !== 1) continue;
      const item = candidates[0];
      matchedNodes.set(entry.node, item);
      result.push({ ...entry, item });
    }
  }
  return result;
}

export function sourceHeadingChanges(content, book) {
  return matchSourceHeadings(content, book).filter(entry => entry.level <= 3).map(({node, level, item}) => ({
    type: 'chapter', uid: item.uid, text: item.text,
    before: {heading: Number(value(item.node, 'heading')) || 0}, after: {heading: level},
    source: node.headingEvidence || 'EPUB outline'
  }));
}
