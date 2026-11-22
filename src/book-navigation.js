import { matchSourceHeadings } from './source-headings.js';
import { readDocument } from './reader-store.js';

export const hasSourceNavigation = book => ['nav', 'ncx'].includes(book?.tocSource) && book.toc?.length > 0;

// The publisher's directory and the body's heading formatting are distinct.
// Keep only NAV/NCX nodes, retaining all navigation levels and their order.
export function sourceNavigation(book, uidForNode) {
  if (!hasSourceNavigation(book)) return null;
  const chapters = [], unmatched = [];
  const visit = (nodes, parentUid = null, level = 1) => {
    for (const node of nodes) {
      if (node.kind === 'toc') {
        const uid = uidForNode(node);
        if (!uid) unmatched.push(node.text);
        else chapters.push({uid, title: node.text, parentUid, level, progress: !/^(?:封面|目录|版权页|扉页|Cover|Contents|Copyright|Title page)$/i.test(node.text)});
        visit(node.children || [], uid || parentUid, level + 1);
      } else visit(node.children || [], parentUid, level);
    }
  };
  visit(book.chapters);
  return {source: book.tocSource, chapters, unmatched};
}

export function previewNavigationRepair(content, book) {
  if (!hasSourceNavigation(book)) return null;
  const matches = new Map(matchSourceHeadings(content, book, {navigationOnly: true}).map(entry => [entry.node, entry.item.uid]));
  const navigation = sourceNavigation(book, node => matches.get(node));
  // Never replace a complete directory with a partial guessed one.
  if (navigation.unmatched.length || !navigation.chapters.length) return {unmatched: navigation.unmatched, changes: false};
  const before = readDocument('book-navigation', content.key);
  const after = {source: navigation.source, chapters: navigation.chapters};
  const active = before || content.record.catalog?.navigation || null;
  return {before, after, unmatched: [], changes: JSON.stringify(active) !== JSON.stringify(after)};
}
