import { blockAlias } from "./link-format.js";
import { t } from "./i18n.js";
const IMAGE_PATTERN = /⟦EPUBI:(i\d+)⟧/g;
const LINK_PATTERN = /⟦EPUBL:(l\d+)⟧/g;

function valueOf(record, key) {
  return record?.[`:block/${key}`] ?? record?.[key];
}

// TOC entries (and their supplements) are the book's chapters. They become
// H1/H2/H3 by TOC depth; the fourth level becomes bold text and deeper levels
// stay plain. Body headings that are not TOC entries become bold paragraphs,
// so Contents (H1–H3) shows the EPUB TOC only.
export const chapterNodeKind = (node, parent, book) => node.kind === "toc" || node.kind === "supplement" || !parent || (book?.tocSource === "headings" && node.kind === "heading");
const boldable = text => text && !/\*\*|⟦EPUBI:|\$\$|^\s*```/.test(text);

export function prepareBlockPlan(job, generateUID) {
  if (job.blockPlan) return job.blockPlan;
  const blocks = [];
  const targets = new Map();
  function visit(nodes, parentUid, chapterIndex, depth, parentNode, chapterDepth) {
    nodes.forEach((node, order) => {
      const uid = generateUID();
      if (node.targetMarker) targets.set(node.targetMarker, uid);
      const chapter = chapterNodeKind(node, parentNode, job.book);
      // TOC levels 1–3 → H1–H3; level 4 → bold paragraph; deeper → plain.
      const heading = chapter && chapterDepth < 3 ? chapterDepth + 1 : 0;
      const bold = boldable(node.text) && (chapter ? chapterDepth === 3 : node.kind === "heading");
      blocks.push({ uid, parentUid, order, chapterIndex, depth, node, heading, bold });
      visit(node.children || [], uid, chapterIndex, depth + 1, node, chapterDepth + (chapter ? 1 : 0));
    });
  }
  job.book.chapters.forEach((node, chapterIndex) => visit([node], job.progress.pageUid, chapterIndex, 0, null, 0));
  const links = new Map(job.book.links.map(link => [link.id, link]));
  job.blockPlan = blocks.map(({ node, bold, ...record }) => {
    const source = node.text || "(Empty paragraph)";
    const text = (bold ? `**${source.trim()}**` : source).replace(IMAGE_PATTERN, (_, id) => job.assetEmbeds[id] || `[Missing image: ${id}]`);
    const pendingLinks = /⟦EPUBL:/.test(text);
    const resolveLinks = final => text.replace(LINK_PATTERN, (_, id) => {
      const link = links.get(id);
      if (!link) return "[Unrecognized internal link]";
      const uid = targets.get(link.targetMarker);
      return final && uid ? blockAlias(link.label, uid) : link.label;
    });
    return {
      ...record,
      // Literal block strings preserve numeric paragraphs, image positions and
      // source nesting without a second Markdown parse changing the tree.
      string: resolveLinks(false),
      ...(pendingLinks ? { finalString: resolveLinks(true) } : {}),
      open: record.depth !== 0
    };
  });
  job.progress.blockIndex ||= 0;
  job.progress.linkIndex ||= 0;
  return job.blockPlan;
}

export async function writeBlockPlan(job, api, { checkpoint, onProgress, wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)), intervalMs = 65 } = {}) {
  if (!job.blockPlan) throw new Error(t("The chapter structure has not been prepared."));
  const plan = job.blockPlan;
  job.progress.stage = "chapters";
  for (let index = job.progress.blockIndex || 0; index < plan.length; index += 1) {
    const item = plan[index];
    const existing = api.data.pull("[:block/uid :block/string {:block/parents [:block/uid]}]", [":block/uid", item.uid]);
    if (!valueOf(existing, "uid")) {
      await api.data.block.create({
        location: { "parent-uid": item.parentUid, order: item.depth === 0 ? item.chapterIndex : item.order },
        block: { uid: item.uid, string: item.string, open: item.open, ...(item.heading ? { heading: item.heading } : {}) }
      });
      await wait(intervalMs);
    } else {
      const expected = new Set([item.string, item.finalString].filter(value => value != null));
      const parents = valueOf(existing, "parents");
      if (!expected.has(valueOf(existing, "string")) || !Array.isArray(parents) || !parents.some(parent => valueOf(parent, "uid") === item.parentUid)) {
        throw new Error(t("An imported block was edited or moved. Resume paused to preserve your changes. Select the EPUB to import into a separate page."));
      }
    }
    job.progress.blockIndex = index + 1;
    job.progress.chapterIndex = index + 1 === plan.length || plan[index + 1].chapterIndex !== item.chapterIndex ? item.chapterIndex + 1 : item.chapterIndex;
    if ((index + 1) % 20 === 0 || index + 1 === plan.length) await checkpoint?.(job);
    onProgress?.({ stage: "chapters", current: index + 1, total: plan.length, message: t("Importing chapter {0}/{1} · block {2}/{3}", [item.chapterIndex + 1, job.book.chapters.length, index + 1, plan.length]) });
  }
  const linked = plan.filter(item => item.finalString != null);
  job.progress.stage = "links";
  await checkpoint?.(job);
  for (let index = job.progress.linkIndex || 0; index < linked.length; index += 1) {
    const item = linked[index];
    await api.data.block.update({ block: { uid: item.uid, string: item.finalString } });
    await wait(intervalMs);
    job.progress.linkIndex = index + 1;
    if ((index + 1) % 20 === 0 || index + 1 === linked.length) await checkpoint?.(job);
    onProgress?.({ stage: "links", current: index + 1, total: linked.length, message: t("Resolving internal link {0}/{1}", [index + 1, linked.length]) });
  }
}
