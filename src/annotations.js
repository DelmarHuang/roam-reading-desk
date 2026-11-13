import { api, createBlock, ensurePage, plain } from "./graph.js";
import { t } from "./i18n.js";

export function codeRanges(text) {
  const ranges = [];
  const regex = /`+/g;
  let run;
  while ((run = regex.exec(text))) {
    if (text[run.index - 1] === "\\") continue;
    const end = text.indexOf(run[0], regex.lastIndex);
    if (end < 0) { ranges.push([run.index, text.length]); break; }
    ranges.push([run.index, end + run[0].length]); regex.lastIndex = end + run[0].length;
  }
  return ranges;
}
export function markRanges(text) {
  const protectedRanges = codeRanges(text);
  const regex = /(#?\[\[mark\]\])|(^|\s)(#mark)(?=$|[\s.,!?;:，。！？；：)）])/g;
  const ranges = [];
  let match;
  while ((match = regex.exec(text))) {
    const start = match.index + (match[1] ? 0 : match[2].length);
    if (text[start - 1] !== "\\" && !protectedRanges.some(([a, b]) => start >= a && start < b)) ranges.push([start, start + (match[1] || match[3]).length]);
  }
  return ranges;
}
export function highlightCount(text) {
  const protectedRanges = codeRanges(text);
  let count = 0;
  for (const match of String(text || "").matchAll(/\^\^([^]*?)\^\^/g)) if (text[match.index - 1] !== "\\" && !protectedRanges.some(([a, b]) => match.index >= a && match.index < b)) count++;
  return count;
}
export const isVideoTimestamp = text => /^\s*\{\{\s*(?:\[\[)?video-timestamp(?:\]\])?\s*:/i.test(String(text || ""));
export function nativeCommentsForTargets(targetUids) {
  if (!targetUids.length) return [];
  // Join by native block reference, not by the comment storage page. Comments
  // stay discoverable after a whole book moves or its original page is merged.
  const rows = api().data.q(`[:find ?target-uid ?ref-uid ?reply-uid ?reply-string
    :in $ [?target-uid ...]
    :where [?target :block/uid ?target-uid] [?ref :block/refs ?target]
    [?root :block/string "[[roam/comments]]"] [?ref :block/parents ?root]
    [?ref :block/uid ?ref-uid] [?ref :block/string ?ref-string]
    [(clojure.string/starts-with? ?ref-string "((")]
    [?ref :block/children ?reply] [?reply :block/uid ?reply-uid] [?reply :block/string ?reply-string]]`, targetUids) || [];
  const unique = new Map();
  // Video timestamp notes ({{[[video-timestamp]]: ((video)) 00:00:00}}) are
  // stored like comments but belong to the video player, not the margin.
  rows.filter(([, , , text]) => !isVideoTimestamp(text)).forEach(([targetUid, refUid, uid, text]) => unique.set(`${targetUid}:${uid}`, { type: "comment", id: `comment:${uid}`, uid, targetUid, refUid, text }));
  return [...unique.values()];
}
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Questions: native TODO, a question tag (#question, [[question]]) or a
// question attribute at the start of a block (Question:: …, or any tag::).
export function isQuestion(text, tags = ["question"]) {
  if (/\{\{\[\[DONE\]\]\}\}/.test(text)) return false;
  const clean = codeRanges(text).reduceRight((value, [a, b]) => value.slice(0, a) + " ".repeat(b - a) + value.slice(b), text);
  if (/\{\{\[\[TODO\]\]\}\}/.test(clean)) return true;
  return tags.some(tag => {
    const escaped = escapeRegex(tag);
    return clean.includes(`[[${tag}]]`)
      || new RegExp(`(?:^|\\s)#${escaped}(?=$|[\\s，。！？,.!?])`, "i").test(clean)
      || new RegExp(`^\\s*(?:\\*\\*)?(?:\\[\\[)?${escaped}(?:\\]\\])?::`, "i").test(clean);
  });
}
export function questionAttribute(text, tags = ["question"]) {
  for (const tag of tags) { const match = String(text || "").match(new RegExp(`^\\s*(?:\\[\\[)?${escapeRegex(tag)}(?:\\]\\])?::\\s*`, "i")); if (match) return match[0]; }
  return "";
}
export function collectAnnotations(content, comments = nativeCommentsForTargets([...content.nodes.map(node => node.uid), ...(content.fragmentAliases?.keys() || [])]), questionTags) {
  const result = [];
  content.nodes.forEach(node => {
    const protectedRanges = codeRanges(node.text);
    for (const match of node.text.matchAll(/\^\^([^]*?)\^\^/g)) {
      if (node.text[match.index - 1] === "\\" || protectedRanges.some(([a, b]) => match.index >= a && match.index < b)) continue;
      result.push({ id: `highlight:${node.uid}:${match.index}`, type: "highlight", uid: node.uid, targetUid: node.uid, text: match[1], chapterUid: node.chapterUid });
    }
    if (markRanges(node.text).length) result.push({ id: `mark:${node.uid}`, type: "mark", uid: node.uid, targetUid: node.uid, text: node.text, chapterUid: node.chapterUid });
    if (isQuestion(node.text, questionTags)) result.push({ id: `question:${node.uid}`, type: "question", uid: node.uid, targetUid: node.uid, text: node.text, chapterUid: node.chapterUid, question: true });
  });
  comments.forEach(comment => { const targetUid = content.fragmentAliases?.get(comment.targetUid) || comment.targetUid; result.push({ ...comment, targetUid, chapterUid: content.byUid.get(targetUid)?.chapterUid, question: isQuestion(comment.text, questionTags) }); });
  return result;
}

export const notesTitleFor = content => `${content.record.title}/Reading Notes`;
export const NOTES_PREFIX = "Reading notes · ";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ordinal = day => `${day}${day % 100 >= 11 && day % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][day % 10] || "th"}`;
// Roam's Daily Notes title for a date ("November 7th, 2026").
export function dnpTitle(date) {
  try { const title = api().util?.dateToPageTitle?.(date); if (title) return title; } catch { /* fall back */ }
  return `${MONTHS[date.getMonth()]} ${ordinal(date.getDate())}, ${date.getFullYear()}`;
}
// The notes page, created if needed, linked back to its source pages once so
// the book page lists the notes in its Linked References.
export async function ensureNotesPage(requestedTitle, sourceTitles = []) {
  const title = String(requestedTitle || "").trim();
  if (!title) throw new Error(t("Enter a destination page title."));
  const page = await ensurePage(title);
  const existing = api().data.pull("[{:block/children [:block/string]}]", [":block/uid", page]);
  const firstStrings = (existing?.[":block/children"] || []).map(child => child[":block/string"] || "");
  const sources = [...new Set(sourceTitles.filter(Boolean))].filter(source => source !== title && !firstStrings.some(text => text.includes(`[[${source}]]`)));
  if (sources.length) await createBlock(page, `Source:: ${sources.map(source => `[[${source}]]`).join(" ")}`, 0);
  return page;
}

export async function createNotesDraft(content, selected, requestedTitle, { sourceTitles = [] } = {}) {
  if (!selected.length) throw new Error(t("Select annotations to include first."));
  const title = requestedTitle.trim();
  if (!title) throw new Error(t("Enter a destination page title."));
  const page = await ensureNotesPage(title, sourceTitles);
  // The date links to its Daily Notes Page.
  const now = new Date(), two = value => String(value).padStart(2, "0");
  const root = await createBlock(page, `${NOTES_PREFIX}[[${dnpTitle(now)}]] ${two(now.getHours())}:${two(now.getMinutes())}`);
  const groups = new Map();
  const unique = [...new Map(selected.map(annotation => [annotation.uid, annotation])).values()];
  for (const annotation of unique) {
    const chapter = content.chapters.find(chapter => chapter.uid === annotation.chapterUid);
    const key = chapter?.uid || "other";
    if (!groups.has(key)) groups.set(key, await createBlock(root, chapter?.title || "Annotations"));
    // Reference original native blocks, never replace or duplicate the book.
    const ref = await createBlock(groups.get(key), `((${annotation.uid}))`);
    if (annotation.type === "comment") await createBlock(ref, `Source: ((${annotation.targetUid}))`);
  }
  return { pageUid: page, rootUid: root, title, count: unique.length };
}
