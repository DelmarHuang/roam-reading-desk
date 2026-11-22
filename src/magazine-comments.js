// Native comment side notes. Comments stay native Roam data; this module only
// projects them beside the text. Layout follows the Notion pattern: every note
// is expanded and stacked without overlap; clicking a note (or its paragraph)
// pins that note level with its paragraph and nudges the others around it.
import { currentUid, childrenOf, owningPage, pull, textOf, uidOf, openAt } from "./graph.js";
import { nativeCommentsForTargets, markRanges, highlightCount } from "./annotations.js";
import { FRAGMENT_ARCHIVE } from "./paragraph-repair.js";
import { renderRich } from "./rich-text.js";
import { language, t } from "./i18n.js";

import { publishFeature } from "./coexistence.js";
const KEY = "__readingDeskCommentRail";
const NOTE = "mag-native-comment", BADGE = "mag-comment-fold-count", HOST = "mag-comment-rail-host", ANCHOR = "mag-comment-anchor-active", RAIL = "mag-comment-anchor-rail";
const GAP = 8;
const cssEscape = value => window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
const plural = (count, word) => t(count === 1 ? `{0} ${word}` : `{0} ${word}s`, [count]);

export function foldSummary({ comments = 0, highlights = 0, marks = 0 }) {
  return [comments && plural(comments, "comment"), highlights && plural(highlights, "highlight"), marks && plural(marks, "mark")].filter(Boolean).join(" · ");
}

// Pure stacking used by the renderer and tests. `items` are sorted by desired
// top; returns non-overlapping tops with the active item exactly aligned.
// Delete one native comment; remove its thread block when it was the last.
export async function deleteNativeComment({ uid, refUid }) {
  const api = window.roamAlphaAPI;
  if (!api.data.pull("[:block/uid]", [":block/uid", uid])) return { deleted: false, threadDeleted: false };
  await api.data.block.delete({ block: { uid } });
  let threadDeleted = false;
  const thread = refUid && api.data.pull("[:block/string {:block/children [:block/uid]}]", [":block/uid", refUid]);
  if (thread && /^\s*\(\([^()]+\)\)\s*$/.test(thread[":block/string"] || "") && !(thread[":block/children"] || []).some(child => child[":block/uid"] !== uid)) { await api.data.block.delete({ block: { uid: refUid } }); threadDeleted = true; }
  return { deleted: true, threadDeleted };
}

export function stackNotes(items, activeIndex = -1, gap = GAP) {
  const tops = items.map(item => item.desired);
  if (!items.length) return tops;
  const down = from => { for (let index = from; index < items.length; index++) if (index > 0) tops[index] = Math.max(items[index].desired, tops[index - 1] + items[index - 1].height + gap); };
  if (activeIndex < 0 || activeIndex >= items.length) { tops[0] = Math.max(0, items[0].desired); down(1); return tops; }
  tops[activeIndex] = Math.max(0, items[activeIndex].desired);
  for (let index = activeIndex - 1; index >= 0; index--) tops[index] = Math.min(items[index].desired, tops[index + 1] - gap - items[index].height);
  down(activeIndex + 1);
  return tops;
}

function projection({ enabled, onError, order = () => "oldest" }) {
  if (typeof window[KEY] === "function") window[KEY]();
  document.querySelectorAll(".rei-native-comment,.rei-comment-count").forEach(node => node.remove());
  let disposed = false, loading = false, renderTimer, dataTimer, activeTarget = null, activeComment = null, lastOrder;
  const models = new Map(), cleanups = [], layouts = new Map(), replyCache = new Map(), railMode = new Map(), stickyRails = new Set(), animationTimers = new Map();
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); cleanups.push(() => target.removeEventListener(type, fn, options)); };
  const articles = () => {
    const daily = [...document.querySelectorAll(".roam-main .roam-log-page:not(.roam-log-preview)")];
    return daily.length ? daily : [...document.querySelectorAll(".roam-main .roam-article")];
  };
  // Narrow layout (original Magazine geometry): only the commented paragraph
  // reserves right space via the original mag-comment-anchor-rail class. The
  // class stays between renders unless the layout really changes, so the text
  // does not reflow on every render.
  function releaseRail(block) {
    block.classList.remove(RAIL); block.style.removeProperty("--mag-comment-reserve");
  }
  function applyRail(block, reserve) {
    if (!block.classList.contains(RAIL)) block.classList.add(RAIL);
    if (block.style.getPropertyValue("--mag-comment-reserve") !== `${reserve}px`) block.style.setProperty("--mag-comment-reserve", `${reserve}px`);
  }
  // Cards are reused between renders (same comment, same text, same edit
  // time), so hovering or editing elsewhere never rebuilds them — a rebuilt
  // active card used to replay its border transition again and again.
  const cardPool = new Map();
  function obtainCard(record, mode, targetUid, key, used) {
    const sig = [language(), mode, record.uid, record.text, meta(record.uid).stamp || 0, replies(record.uid).map(line => line.text).join("\u0001")].join("\u0002");
    let card = cardPool.get(key);
    if (!card || card.dataset.sig !== sig) { if (card) { resize?.unobserve(card); card.remove(); } card = makeCard(record, mode, targetUid); card.dataset.sig = sig; cardPool.set(key, card); resize?.observe(card); }
    used.add(key); return card;
  }
  function clearProjection({ keepRails = false, keepCards = false } = {}) {
    document.querySelectorAll(keepCards ? `.${BADGE}` : `.${NOTE},.${BADGE}`).forEach(node => node.remove());
    if (!keepCards) { cardPool.forEach(card => resize?.unobserve(card)); cardPool.clear(); }
    document.querySelectorAll(`.${ANCHOR}`).forEach(node => node.classList.remove(ANCHOR));
    if (!keepRails) { document.querySelectorAll(`.${HOST}`).forEach(node => node.classList.remove(HOST, "rd-notes-gap")); document.querySelectorAll(`.${RAIL}`).forEach(releaseRail); }
    layouts.clear();
  }
  // Author and date for the Notion-style card header (read-only).
  const metaCache = new Map();
  function meta(uid) {
    if (metaCache.has(uid)) return metaCache.get(uid);
    let info = {};
    try {
      const node = window.roamAlphaAPI.data.pull("[:create/time :edit/time {:create/user [:user/display-name {:user/display-page [:node/title]}]} {:edit/user [:user/display-name {:user/display-page [:node/title]}]}]", [":block/uid", uid]) || {};
      const user = node[":create/user"] || node[":edit/user"] || {};
      // Show (and sort by) the last edit time: 2020/01/01 16:08.
      const stamp = node[":edit/time"] || node[":create/time"] || 0;
      const date = stamp ? new Date(stamp) : null, two = value => String(value).padStart(2, "0");
      info = { stamp, name: user[":user/display-name"] || user[":user/display-page"]?.[":node/title"] || "", year: date ? `${date.getFullYear()}/` : "", time: date ? `${date.getFullYear()}/${two(date.getMonth() + 1)}/${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}` : "" };
    } catch { /* header falls back to a generic label */ }
    metaCache.set(uid, info); return info;
  }
  function replies(uid) {
    if (replyCache.has(uid)) return replyCache.get(uid);
    const lines = [];
    const walk = (node, depth) => childrenOf(node).forEach(child => { if (depth < 4) { lines.push({ depth, text: textOf(child) }); walk(child, depth + 1); } });
    try { walk(pull(uid), 1); } catch { /* the note still shows its first line */ }
    replyCache.set(uid, lines); return lines;
  }
  // One card per comment, like Notion.
  function makeCard(record, mode, targetUid) {
    const records = [record];
    const card = document.createElement("aside"); card.className = `${NOTE} ${NOTE}--${mode}`; card.setAttribute("aria-label", t("Native Roam comment")); card.dataset.targetUid = targetUid; card.dataset.commentUid = record.uid; card.dataset.rdCard = "1";
    for (const record of records) {
      const item = document.createElement("div"); item.className = "mag-native-comment__item";
      const info = meta(record.uid);
      const head = document.createElement("div"); head.className = "mag-native-comment__meta";
      // The year is dropped on narrow cards (CSS container query).
      if (info.time) { const time = document.createElement("span"); time.className = "mag-native-comment__time"; time.title = info.time; const year = document.createElement("span"); year.className = "mag-native-comment__year"; year.textContent = info.year; const rest = info.time.slice(info.year.length), clock = document.createElement("span"); clock.className = "mag-native-comment__clock"; clock.textContent = rest.slice(5); time.append(year, rest.slice(0, 5), clock); head.append(time); }
      item.append(head);
      const text = document.createElement("div"); text.className = "mag-native-comment__text"; text.append(renderRich(record.text)); item.append(text);
      for (const reply of replies(record.uid)) {
        const line = document.createElement("div"); line.className = "mag-native-comment__child"; line.style.setProperty("--rd-depth", String(reply.depth)); line.append(renderRich(reply.text)); item.append(line);
      }
      card.append(item);
    }
    const icon = path => { const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("aria-hidden", "true"); const line = document.createElementNS("http://www.w3.org/2000/svg", "path"); line.setAttribute("d", path); svg.append(line); return svg; };
    const open = document.createElement("button"); open.type = "button"; open.className = "mag-native-comment__open"; open.append(icon("M5 11 11 5M6 5h5v5")); open.title = t("Open the native comment thread to edit"); open.setAttribute("aria-label", t("Open native comment thread"));
    open.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); openAt(records[0].refUid, true).catch(onError); });
    // Delete this comment. The reference block that holds the thread
    // ("((paragraph))" under roam/comments) goes too when no other comment is
    // left in it. The paragraph itself is never touched.
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "mag-native-comment__delete"; remove.append(icon("M5 5l6 6M11 5l-6 6")); remove.title = t("Delete this comment"); remove.setAttribute("aria-label", t("Delete comment"));
    remove.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); deleteComment(records[0]).catch(onError); });
    // × and ↗ sit at the end of the header row, after the time, so they can
    // never overlap it.
    const actions = document.createElement("div"); actions.className = "mag-native-comment__actions"; actions.append(remove, open);
    (card.querySelector(".mag-native-comment__meta") || card).append(actions);
    card.addEventListener("click", event => { if (event.target.closest(".mag-native-comment__open,.mag-native-comment__delete")) return; event.preventDefault(); event.stopPropagation(); activate(targetUid, { reveal: true, commentUid: record.uid, sourceCard: card }); });
    return card;
  }
  async function deleteComment(record) {
    const preview = textOf(pull(record.uid)).slice(0, 120);
    if (!window.confirm(t("Delete this comment?\n\n{0}{1}", [preview, replies(record.uid).length ? t("\n\nIts replies are deleted too.") : ""]))) return;
    await deleteNativeComment(record);
    cardPool.forEach((card, key) => { if (card.dataset.commentUid === record.uid) { resize?.unobserve(card); card.remove(); cardPool.delete(key); } });
    await refresh();
  }
  function anchorsFor(article, uid) {
    const escaped = cssEscape(uid), seen = new Set();
    return [...article.querySelectorAll(`.rm-block[data-block-uid="${escaped}"]`), ...article.querySelectorAll(`.rm-block-ref[data-uid="${escaped}"]`)].map(node => {
      const block = node.matches(".rm-block") ? node : node.closest(".rm-block");
      const row = block?.querySelector(":scope > .rm-block-main");
      const main = node.matches(".rm-block-ref") ? node : row;
      if (!block || !main || !row || seen.has(block)) return null;
      seen.add(block); return { block, main, row };
    }).filter(Boolean);
  }
  function collapsedOwner(article, model, uid) {
    const seen = new Set();
    while (uid && !seen.has(uid)) {
      seen.add(uid);
      const block = article.querySelector(`.rm-block[data-block-uid="${cssEscape(uid)}"]`);
      if (block && (block.classList.contains("rm-block--closed") || block.querySelector(":scope > .rm-block-main .rm-caret-closed"))) return block;
      uid = model.parents.get(uid);
    }
    return null;
  }
  // Original Magazine geometry: the text column ends at the article's content
  // edge; notes go in the empty area between it and the main window's right
  // edge when there is room, otherwise inside a reserved strip of the
  // paragraph, otherwise below it. Measured from the article (never from the
  // paragraphs we pad), so applying the layout cannot change the decision.
  const frameOf = article => article.closest(".roam-body-main") || article.parentElement;
  const GAP_CLASS = "rd-notes-gap";
  // Many themes cap the text measure (.rm-block__input max-width) while Roam's
  // block row still spans the whole article, leaving a wide empty strip
  // between the text and the row's right edge (where the reference count
  // sits). Notes use that strip: they start just after the real text edge,
  // and the reference count is pulled next to the text (rd-notes-gap CSS).
  // Folio's margin-note geometry: the note column starts 18px after the
  // article's content edge, in the empty margin, and the text column keeps
  // its width. Only when that margin is too small does the commented
  // paragraph give up a strip on its right (the original Magazine rail), and
  // below 900px notes sit under their paragraph.
  function measure(article) {
    article.classList.remove(GAP_CLASS);
    const articleRect = article.getBoundingClientRect();
    const frameRect = frameOf(article).getBoundingClientRect();
    const contentRight = articleRect.right - (parseFloat(window.getComputedStyle(article).paddingRight) || 0);
    const marginRoom = Math.floor(frameRect.right - contentRight - 8 - 18 - 22);
    // Same 64px threshold as Folio's margin notes: the text never gives up width
    // while the margin has any usable room.
    if (window.innerWidth >= 900 && marginRoom >= 64) return { mode: "margin", width: Math.min(240, marginRoom), left: contentRight - articleRect.left + 18, gap: false };
    if (window.innerWidth >= 900 && articleRect.width >= 600) {
      const width = Math.round(Math.min(164, Math.max(132, articleRect.width * .22)));
      return { mode: "rail", width, reserve: width + 24, left: contentRight - articleRect.left - width, gap: false };
    }
    return { mode: "inline", gap: false };
  }
  // Decide once per available width; applying the layout never re-decides.
  const plans = new WeakMap();
  function decide(article) {
    const frameWidth = Math.round(frameOf(article).getBoundingClientRect().width);
    const cached = plans.get(article);
    if (cached && Math.abs(cached.frameWidth - frameWidth) < 40) return cached.plan;
    article.classList.remove(GAP_CLASS);
    const plan = measure(article);
    plans.set(article, { frameWidth, plan });
    return plan;
  }
  // Layout writes `top` once per render. Moves after a click only change a
  // GPU transform, so the cards glide without re-laying out the page.
  function place(article, { animate = false } = {}) {
    const state = layouts.get(article); if (!state) return;
    // Fonts, wrapping, images and replies can change card height without a
    // data refresh. Measure at placement time, including on every click.
    const items = state.items.map(item => ({ ...item, height: item.card.offsetHeight || 28 }));
    const active = items.findIndex(item => item.targetUid === activeTarget && (!activeComment || item.commentUid === activeComment));
    const tops = stackNotes(items, active);
    items.forEach((item, index) => {
      const top = Math.round(tops[index]); state.items[index].top = top;
      if (animate && state.items[index].base != null) item.card.style.setProperty("transform", `translate3d(0, ${top - state.items[index].base}px, 0)`, "important");
      else { state.items[index].base = top; item.card.style.setProperty("--mag-comment-top", `${top}px`); item.card.style.removeProperty("transform"); }
      item.card.classList.toggle("is-active", index === active);
    });
    state.tops = tops;
  }
  function render() {
    if (disposed || window[KEY] !== cleanup) return;
    // A timer queued BEFORE the click also has to respect the animation.
    // Otherwise it resets top/transform in the middle of the slide.
    if (Date.now() < quietUntil) { schedule(); return; }
    clearProjection({ keepRails: true, keepCards: true });
    publishFeature("comments", enabled());
    if (!enabled()) { clearProjection(); return; }
      const used = new Set();
    // Changing the order only reverses the stack under each paragraph
    // (C1 C2 C3 → C3 C2 C1). Drop any previous click alignment so the first
    // card in the new order sits level with the paragraph, nothing shifts up.
    const currentOrder = order();
    if (currentOrder !== lastOrder) { if (lastOrder !== undefined) { activeTarget = null; activeComment = null; } lastOrder = currentOrder; }
    const railBlocks = new Set();
    for (const article of articles()) {
      const model = models.get(article);
      if (!model?.comments.length && !model?.stats.size) { article.classList.remove(HOST); continue; }
      const grouped = new Map();
      (model.comments || []).forEach(record => { const list = grouped.get(record.targetUid) || []; list.push(record); grouped.set(record.targetUid, list); });
      const newest = currentOrder === "newest";
      grouped.forEach(list => list.sort((a, b) => ((meta(a.uid).stamp || 0) - (meta(b.uid).stamp || 0)) * (newest ? -1 : 1)));
      const visible = new Map();
      for (const targetUid of grouped.keys()) {
        const anchors = anchorsFor(article, targetUid).filter(({ main }) => main.getClientRects().length && main.getBoundingClientRect().height > 0);
        if (anchors.length) visible.set(targetUid, anchors);
      }
      if (visible.size) article.classList.add(HOST); else { article.classList.remove(HOST); article.classList.remove(GAP_CLASS); }
      const items = [];
      if (visible.size) {
        const plan = decide(article);
        article.classList.toggle(GAP_CLASS, Boolean(plan.gap));
        if (plan.mode === "rail") railMode.set(article, plan.reserve); else { railMode.delete(article); stickyRails.forEach(block => { if (article.contains(block)) stickyRails.delete(block); }); }
        const blocks = new Set([...visible.values()].flat().map(anchor => anchor.block));
        if (plan.mode === "rail") blocks.forEach(block => { applyRail(block, plan.reserve); railBlocks.add(block); });
        // Measure only after the reserve is in place (the old code measured
        // first, so notes landed beside the previous paragraph).
        const articleRect = article.getBoundingClientRect();
        for (const [targetUid, anchors] of visible) {
          const records = grouped.get(targetUid);
          for (const anchor of anchors) {
            if (plan.mode === "inline") {
              let after = anchor.block.children[0];
              const index = anchors.indexOf(anchor);
              for (const record of records) { const card = obtainCard(record, "inline", targetUid, `${targetUid}|${record.uid}|${index}|inline`, used); if (after.nextElementSibling !== card) after.after(card); after = card; }
              continue;
            }
            const rect = anchor.main.getBoundingClientRect();
            records.forEach(record => {
              const card = obtainCard(record, "margin", targetUid, `${targetUid}|${record.uid}|${anchors.indexOf(anchor)}|margin`, used);
              card.style.setProperty("--mag-comment-left", `${Math.round(plan.left)}px`);
              card.style.setProperty("--mag-comment-width", `${plan.width}px`);
              card.style.setProperty("--mag-comment-top", `${Math.round(rect.top - articleRect.top)}px`);
              if (card.parentElement !== article) article.append(card);
              items.push({ targetUid, commentUid: record.uid, seq: items.length, card, block: anchor.block, anchorMain: anchor.main, desired: rect.top - articleRect.top });
            });
          }
        }
      }
      items.sort((a, b) => a.desired - b.desired || a.seq - b.seq);
      items.forEach(item => { item.height = item.card.offsetHeight || 28; });
      layouts.set(article, { items });
      place(article);
      // Narrow layout: a long note stacked below its own paragraph must not
      // cover the next paragraphs, so those paragraphs move left as well.
      // Repeat a few times because narrowing text makes it taller.
      if (items.length && article.classList.contains(HOST) && railMode.get(article)) {
        const reserve = railMode.get(article);
        for (let pass = 0; pass < 4; pass++) {
          const articleRect = article.getBoundingClientRect();
          const spans = items.map(item => { const top = item.top ?? (parseFloat(item.card.style.getPropertyValue("--mag-comment-top")) || 0); return [top, top + (item.card.offsetHeight || 28)]; });
          let changed = false;
          for (const main of article.querySelectorAll(".rm-block > .rm-block-main")) {
            const block = main.parentElement;
            if (block.classList.contains(RAIL) || main.closest(`.${NOTE}`)) { if (block.classList.contains(RAIL)) railBlocks.add(block); continue; }
            const rect = main.getBoundingClientRect(); if (!rect.height) continue;
            const top = rect.top - articleRect.top, bottom = rect.bottom - articleRect.top;
            if (spans.some(([a, b]) => top < b && bottom > a)) { applyRail(block, reserve); railBlocks.add(block); stickyRails.add(block); changed = true; }
          }
          if (!changed) break;
          const fresh = article.getBoundingClientRect();
          items.forEach(item => { const anchor = item.anchorMain.getBoundingClientRect(); item.desired = anchor.top - fresh.top; });
          place(article);
        }
      }
      // Folded sections: count comments, highlights and marks that are hidden.
      const folded = new Map();
      const add = (owner, field, count) => { const entry = folded.get(owner) || { comments: 0, highlights: 0, marks: 0 }; entry[field] += count; folded.set(owner, entry); };
      for (const [targetUid, records] of grouped) {
        if (visible.has(targetUid)) continue;
        const owners = new Set([targetUid, ...(model.references.get(targetUid) || [])].map(uid => collapsedOwner(article, model, uid)).filter(Boolean));
        owners.forEach(owner => add(owner, "comments", records.length));
      }
      for (const [uid, stat] of model.stats) {
        const parent = model.parents.get(uid);
        if (!parent) continue;
        const owner = collapsedOwner(article, model, parent);
        if (!owner) continue;
        if (stat.highlights) add(owner, "highlights", stat.highlights);
        if (stat.marks) add(owner, "marks", stat.marks);
      }
      for (const [block, counts] of folded) {
        const main = block.querySelector(":scope > .rm-block-main"); if (!main) continue;
        const badge = document.createElement("button"); badge.type = "button"; badge.className = BADGE; badge.dataset.rdBadge = "1";
        badge.textContent = foldSummary(counts); badge.title = t("Expand this section");
        badge.onclick = event => { event.preventDefault(); event.stopPropagation(); const caret = main.querySelector(".rm-caret-closed"); if (caret) caret.click(); else openAt(block.getAttribute("data-block-uid")).catch(onError); };
        main.append(badge);
      }
    }
    cardPool.forEach((card, key) => { if (!used.has(key)) { resize?.unobserve(card); card.remove(); cardPool.delete(key); } });
    document.querySelectorAll(`.${NOTE}`).forEach(card => { if (![...cardPool.values()].includes(card)) card.remove(); });
    document.querySelectorAll(`.${RAIL}`).forEach(block => { if (!railBlocks.has(block) && !(stickyRails.has(block) && block.isConnected && [...railMode.keys()].some(article => article.contains(block)))) releaseRail(block); });
  }
  // Clicking a note pins that note level with the top of its paragraph (the
  // notes above it move up) and scrolls the paragraph to the top of the view.
  function animateArticle(article) {
    clearTimeout(animationTimers.get(article));
    article.classList.add("rd-comment-animate"); place(article, { animate: true });
    animationTimers.set(article, setTimeout(() => { article.classList.remove("rd-comment-animate"); animationTimers.delete(article); }, 320));
  }
  function activate(targetUid, { reveal = false, commentUid = null, sourceCard = null } = {}) {
    if (activeTarget === targetUid && activeComment === commentUid && !reveal) return;
    activeTarget = targetUid; activeComment = commentUid;
    quietUntil = Date.now() + (reveal ? 1000 : 360);
    // The narrow layout re-checks overlaps once the movement has settled.
    if ([...layouts.keys()].some(article => railMode.get(article))) schedule();
    document.querySelectorAll(`.${ANCHOR}`).forEach(node => node.classList.remove(ANCHOR));
    for (const [article, state] of layouts) {
      animateArticle(article);
      const item = state.items.find(entry => sourceCard ? entry.card === sourceCard : entry.targetUid === targetUid);
      if (!item) continue;
      if (reveal) {
        // Brief, neutral flash on the paragraph; no lasting tint while editing.
        item.block.classList.add(ANCHOR);
        setTimeout(() => item.block.classList.remove(ANCHOR), 1400);
        const main = item.anchorMain || item.block.querySelector(":scope > .rm-block-main") || item.block;
        const previous = main.style.scrollMarginTop; main.style.scrollMarginTop = "88px";
        main.scrollIntoView?.({ behavior: "smooth", block: "start", inline: "nearest" });
        setTimeout(() => { main.style.scrollMarginTop = previous; }, 900);
      }
    }
  }
  function deactivate() {
    if (!activeTarget) return;
    activeTarget = null; activeComment = null;
    quietUntil = Date.now() + 360;
    document.querySelectorAll(`.${ANCHOR}`).forEach(node => node.classList.remove(ANCHOR));
    for (const article of layouts.keys()) animateArticle(article);
  }
  // Hold re-renders and data reloads while a click-triggered scroll runs.
  let quietUntil = 0;
  const schedule = () => { clearTimeout(renderTimer); renderTimer = setTimeout(render, Math.max(180, quietUntil - Date.now())); };
  async function refresh() {
    if (disposed || loading || !enabled()) return;
    if (Date.now() < quietUntil) { scheduleData(); return; }
    loading = true;
    try {
      const mainUid = await currentUid(); if (disposed) return;
      models.clear(); replyCache.clear(); metaCache.clear(); stickyRails.clear();
      for (const article of articles()) {
        const explicit = article.getAttribute("data-page-uid") || article.querySelector("[data-page-uid]")?.getAttribute("data-page-uid");
        const first = article.querySelector(".rm-block[data-block-uid]")?.getAttribute("data-block-uid");
        const pageUid = explicit || (first && owningPage(first)?.uid) || (mainUid && (owningPage(mainUid)?.uid || mainUid));
        if (!pageUid) continue;
        const parents = new Map(), references = new Map(), targets = new Set(), fragmentAliases = new Map(), stats = new Map();
        const walk = (node, parent) => {
          if (!node || textOf(node).trim() === "[[roam/comments]]") return;
          if (textOf(node) === FRAGMENT_ARCHIVE) { childrenOf(node).forEach(fragment => { targets.add(uidOf(fragment)); fragmentAliases.set(uidOf(fragment), parent); }); return; }
          const uid = uidOf(node), text = textOf(node); targets.add(uid); parents.set(uid, parent);
          const highlights = highlightCount(text), marks = markRanges(text).length ? 1 : 0;
          if (highlights || marks) stats.set(uid, { highlights, marks });
          for (const match of text.matchAll(/\(\(([^()\s]+)\)\)/g)) { targets.add(match[1]); const list = references.get(match[1]) || []; list.push(uid); references.set(match[1], list); }
          childrenOf(node).forEach(child => walk(child, uid));
        };
        walk(pull(pageUid), null);
        models.set(article, { parents, references, stats, comments: nativeCommentsForTargets([...targets]).map(comment => ({ ...comment, targetUid: fragmentAliases.get(comment.targetUid) || comment.targetUid })) });
      }
      schedule();
    } catch (error) { onError(error); } finally { loading = false; }
  }
  const scheduleData = () => { clearTimeout(dataTimer); dataTimer = setTimeout(refresh, Math.max(900, quietUntil - Date.now())); };
  const OURS = new RegExp(`(?:^|\\s)(?:${HOST}|${ANCHOR}|${RAIL}|${GAP_CLASS}|rd-comment-animate)(?=\\s|$)`, "g");
  const stripOurs = value => String(value || "").replace(OURS, " ").replace(/\s+/g, " ").trim();
  // Only our own cards and badges are ignored. Cards Folio's copy of this
  // rail adds (no data-rd-card) trigger a render, which removes that copy.
  const OWN = `.${NOTE}[data-rd-card],.${BADGE}[data-rd-badge]`;
  const isOwn = node => node.nodeType !== 1 || node.matches?.(OWN) || Boolean(node.closest?.(OWN));
  const observer = new window.MutationObserver(mutations => {
    const own = mutations.every(mutation => isOwn(mutation.target) || (mutation.type === "attributes" && stripOurs(mutation.oldValue) === stripOurs(mutation.target.getAttribute?.("class"))) || (mutation.type === "childList" && [...mutation.addedNodes, ...mutation.removedNodes].every(isOwn)));
    if (!own) schedule();
    if (mutations.some(mutation => [...mutation.addedNodes].some(node => node.matches?.(".roam-article,.roam-log-page") || node.querySelector?.(".roam-article,.roam-log-page")))) scheduleData();
  });
  const main = document.querySelector(".roam-main"); if (main) observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  const resize = window.ResizeObserver ? new window.ResizeObserver(schedule) : null; if (main) resize?.observe(main);
  on(window, "resize", schedule, { passive: true }); on(window, "hashchange", () => { activeTarget = null; activeComment = null; scheduleData(); });
  on(document, "focusout", event => { if (event.target.matches?.('textarea.rm-block-input,[contenteditable="true"]')) scheduleData(); });
  // Clicking a paragraph that has notes brings its note level with it.
  on(document, "click", event => {
    const target = event.target;
    if (!target?.closest || target.closest(`.${NOTE},.${BADGE},#reading-desk-panel`)) return;
    const block = target.closest(".roam-article .rm-block[data-block-uid],.roam-log-page .rm-block[data-block-uid]");
    if (!block) return;
    const uid = block.getAttribute("data-block-uid");
    const owned = [...layouts.values()].some(state => state.items.some(item => item.targetUid === uid && item.block === block));
    if (owned) activate(uid); else if (activeTarget) deactivate();
  });
  function cleanup() {
    if (disposed) return; disposed = true; clearTimeout(renderTimer); clearTimeout(dataTimer); observer.disconnect(); resize?.disconnect(); cleanups.forEach(fn => fn());
    animationTimers.forEach((timer, article) => { clearTimeout(timer); article.classList.remove("rd-comment-animate"); }); animationTimers.clear();
    if (window[KEY] === cleanup) { clearProjection(); delete window[KEY]; }
    models.clear(); replyCache.clear();
  }
  window[KEY] = cleanup;
  // Read-only view of the current stack, for tests and debugging.
  const snapshot = () => [...layouts.values()].flatMap(state => state.items.map(item => ({ commentUid: item.commentUid, top: item.top, active: item.card.classList.contains("is-active") })));
  return { refresh, render, schedule, cleanup, activate, snapshot, get alive() { return !disposed && window[KEY] === cleanup; } };
}

export function installCommentRail({ enabled = () => true, onError = () => {}, order } = {}) {
  let instance, disposed = false;
  const refresh = () => {
    if (disposed) return;
    publishFeature("comments", enabled());
    if (!enabled()) { if (typeof window[KEY] === "function") window[KEY](); return; }
    if (!instance?.alive) instance = projection({ enabled, onError, ...(order ? { order } : {}) });
    return instance.refresh();
  };
  window.addEventListener("reading-desk-comments-refresh", refresh); refresh();
  return { refresh, relayout() { if (instance?.alive) instance.schedule(); }, get instance() { return instance; }, cleanup() { disposed = true; window.removeEventListener("reading-desk-comments-refresh", refresh); instance?.cleanup(); publishFeature("comments", false); } };
}
