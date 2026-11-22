import { t } from "./i18n.js";
export const api = () => window.roamAlphaAPI;
export const value = (node, field) => node?.[`:block/${field}`] ?? node?.[field];
export const uidOf = node => value(node, "uid");
export const textOf = node => value(node, "string") || "";
export const titleOf = node => node?.[":node/title"] ?? node?.title;
export const childrenOf = node => [...(value(node, "children") || [])].sort((a, b) => (value(a, "order") || 0) - (value(b, "order") || 0));
export const bookKey = book => book.libraryKey || book.pageUid || book.id;
export const pull = uid => api().data.pull("[:block/uid :node/title :block/string :block/order :block/open :block/heading {:block/children ...}]", [":block/uid", uid]);
export const flatten = node => node ? [node, ...childrenOf(node).flatMap(flatten)] : [];
export const updateBlock = block => api().data?.block?.update ? api().data.block.update({ block }) : api().updateBlock({ block });
export const createBlock = (parentUid, string, order = "last") => {
  const uid = api().util.generateUID();
  return api().data.block.create({ location: { "parent-uid": parentUid, order }, block: { uid, string } }).then(() => uid);
};
export async function ensurePage(title) {
  const existing = api().data.pull("[:block/uid]", [":node/title", title]);
  if (uidOf(existing)) return uidOf(existing);
  const uid = api().util.generateUID();
  await api().data.page.create({ page: { uid, title } });
  return uid;
}
export function owningPage(uid) {
  const node = api().data.pull("[:block/uid :node/title {:block/page [:block/uid :node/title]} {:block/parents [:block/uid :node/title]}]", [":block/uid", uid]);
  if (titleOf(node)) return { uid, title: titleOf(node) };
  const page = value(node, "page") || (value(node, "parents") || []).find(titleOf);
  if (page) return { uid: uidOf(page), title: titleOf(page) };
  const rows = api().data.q("[:find ?puid ?title :in $ ?uid :where [?e :block/uid ?uid] [?e :block/parents ?p] [?p :node/title ?title] [?p :block/uid ?puid]]", uid) || [];
  return rows[0] ? { uid: rows[0][0], title: rows[0][1] } : null;
}
export async function currentUid() {
  let open;
  try { open = await api().ui?.mainWindow?.getOpenPageOrBlockUid?.(); } catch { /* Native Desk may not expose a current page. */ }
  if (open) return open;
  const hash = decodeURIComponent(window.location?.hash.match(/\/page\/([^/?]+)/)?.[1] || "");
  if (hash) return hash;
  const explicit = document.querySelector(".roam-main [data-page-uid]")?.getAttribute("data-page-uid");
  if (explicit) return explicit;
  const blockUid = document.querySelector(".roam-main .rm-block[data-block-uid]")?.getAttribute("data-block-uid");
  return blockUid ? owningPage(blockUid)?.uid || blockUid : "";
}
let navigationTicket = 0;
function renderedBlock(uid) {
  return [...document.querySelectorAll('.roam-main [data-block-uid],.roam-main .rm-block-text[id],.roam-main textarea.rm-block-input[id]')]
    .find(node => node.getAttribute('data-block-uid') === uid || node.id?.endsWith(`-${uid}`));
}
function waitForBlock(uid, ticket) {
  return new Promise(resolve => {
    let observer, timer;
    const finish = node => { observer?.disconnect(); clearTimeout(timer); resolve(node); };
    const check = () => { const node = renderedBlock(uid); if (ticket !== navigationTicket || node) finish(ticket === navigationTicket ? node : null); };
    observer = new window.MutationObserver(check); observer.observe(document.body, { childList:true, subtree:true });
    timer = setTimeout(() => finish(null), 4000); check();
  });
}
export async function openAt(uid, sidebar = false) {
  if (!uid || !api().data.pull("[:block/uid]", [":block/uid", uid])) throw new Error(t("This block no longer exists. Refresh the contents or annotations; the book will not be recreated."));
  if (sidebar) {
    await api().ui.rightSidebar.open();
    await api().ui.rightSidebar.addWindow({ window: { type: "block", "block-uid": uid } });
    return;
  }
  const ticket = ++navigationTicket;
  const page = owningPage(uid);
  if (!page) throw new Error(t("Cannot find the page containing this block."));
  // openBlock zooms into one block; reading navigation must retain the page.
  if (await currentUid() !== page.uid) await api().ui.mainWindow.openPage({ page: { uid:page.uid } });
  // Expand only the ancestors that are really collapsed: writing open:true to
  // already-open blocks re-renders them and made the page jump.
  const parents = api().data.pull("[{:block/parents [:block/uid :node/title :block/open]}]", [":block/uid", uid]);
  for (const parent of value(parents, "parents") || []) { if (ticket !== navigationTicket) return; if (!titleOf(parent) && value(parent, "open") === false) await updateBlock({ uid: uidOf(parent), open: true }); }
  const node = await waitForBlock(uid, ticket);
  if (ticket !== navigationTicket) return;
  if (!node) throw new Error(t("The page opened, but this paragraph has not rendered. Expand its chapter and try again."));
  const target = node.closest('.rm-block-main') || node.querySelector('.rm-block-main') || node;
  // Jump instantly, then correct once if images or side notes shift the page
  // while it settles. Any user scroll input cancels the correction.
  let userMoved = false;
  const stop = () => { userMoved = true; };
  const events = ['wheel','touchstart','keydown','pointerdown'];
  events.forEach(name => window.addEventListener(name, stop, { capture:true, passive:true, once:true }));
  // Headings land near the top of the view (like a book's table of contents);
  // other paragraphs land in the middle.
  const heading = Number(value(api().data.pull("[:block/heading]", [":block/uid", uid]), "heading")) > 0;
  const previousMargin = target.style?.scrollMarginTop;
  if (heading && target.style) target.style.scrollMarginTop = "72px";
  const align = () => target.scrollIntoView?.({ behavior:'auto', block: heading ? 'start' : 'center', inline:'nearest' });
  align();
  const anchorTop = target.getBoundingClientRect?.().top;
  target.animate?.([{ backgroundColor:'rgba(222,190,76,.35)' }, { backgroundColor:'transparent' }], { duration:1800 });
  // Images, side notes and lazy blocks can shift the page while it settles:
  // re-align a few times, unless the reader scrolls.
  for (let pass = 0; pass < 3; pass++) {
    await new Promise(resolve => setTimeout(resolve, pass ? 300 : 350));
    if (userMoved || ticket !== navigationTicket || !target.isConnected || anchorTop == null) break;
    if (Math.abs(target.getBoundingClientRect().top - anchorTop) > 24) align();
  }
  events.forEach(name => window.removeEventListener(name, stop, true));
  if (target.style) target.style.scrollMarginTop = previousMargin || "";
}
export const plain = text => String(text || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/#?\[\[([^\]]+)\]\]/g, "$1").replace(/[\^*_`]/g, "").trim();
