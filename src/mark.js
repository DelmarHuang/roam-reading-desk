// Adapted from the user's Magazine/Zenith quick-mark script: retain native
// #mark data, IME safeguards, selection restoration, and native-menu entry.
import { api, pull, textOf, updateBlock } from "./graph.js";
import { codeRanges, markRanges, questionAttribute } from "./annotations.js";
import { t } from "./i18n.js";

export const MARK_COMMAND = "Reading Desk: Toggle Mark";
export const QUESTION_COMMAND = "Reading Desk: Toggle Question";
export function normalizeQuestionTag(input) {
  let tag = String(input || '').trim().replace(/^#/,'');
  if (tag.startsWith('[[') && tag.endsWith(']]')) tag = tag.slice(2,-2).trim();
  if (!tag || tag.length > 80 || /[\[\]#\r\n`{}]/.test(tag)) throw new Error(t("Use a nonempty question tag without brackets, #, braces, or line breaks (up to 80 characters)."));
  return tag;
}
export function questionPlan(text, previous, requestedTag = 'question') {
  const tag = normalizeQuestionTag(requestedTag), escaped = tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const protectedRanges = codeRanges(text);
  const ranges = [...text.matchAll(new RegExp(`(^|\\s)(#${escaped}|#?\\[\\[${escaped}\\]\\])(?=$|[\\s.,!?;:，。！？；：)）])`,'g'))]
    .map(match => [match.index + match[1].length, match.index + match[0].length])
    .filter(([start]) => !protectedRanges.some(([a,b]) => start >= a && start < b));
  if (!ranges.length) return { before:text, after:text + (/\s$/.test(text) || !text ? "" : " ") + (/\s/.test(tag) ? `#[[${tag}]]` : `#${tag}`), marked:true };
  if (previous?.after === text) return { before:text, after:previous.before, marked:false };
  let after = text;
  for (let [start,end] of ranges.reverse()) { if (start && /[ \t]/.test(text[start-1])) start--; after = after.slice(0,start) + after.slice(end); }
  return { before:text, after, marked:false };
}
export const attributeName = tag => /^[a-z]/.test(tag) ? tag[0].toUpperCase() + tag.slice(1) : tag;
// Attribute style: "Question:: text". Toggling removes the prefix again.
export function questionAttributePlan(text, requestedTag = 'question') {
  const tag = normalizeQuestionTag(requestedTag);
  const prefix = questionAttribute(text, [tag]);
  if (prefix) return { before:text, after:text.slice(prefix.length), marked:false };
  return { before:text, after:`${attributeName(tag)}:: ${text.replace(/^\s+/, '')}`, marked:true };
}
export function markPlan(text, previous) {
  const ranges = markRanges(text);
  if (!ranges.length) return { before: text, after: text + (/\s$/.test(text) || !text ? "" : " ") + "#mark", marked: true };
  if (previous?.after === text) return { before: text, after: previous.before, marked: false };
  const merged = [];
  for (let [start, end] of ranges) {
    if (start > 0 && /[ \t]/.test(text[start - 1])) start--;
    else if (/[ \t]/.test(text[end] || "")) end++;
    const prior = merged.at(-1);
    if (prior && start <= prior[1]) prior[1] = Math.max(prior[1], end);
    else merged.push([start, end]);
  }
  let after = text;
  for (const [start, end] of merged.reverse()) after = after.slice(0, start) + after.slice(end);
  return { before: text, after, marked: false };
}
function mapCaret(position, before, after) {
  let start = 0, end = before.length, replacementEnd = after.length;
  while (start < end && start < replacementEnd && before[start] === after[start]) start++;
  while (end > start && replacementEnd > start && before[end - 1] === after[replacementEnd - 1]) { end--; replacementEnd--; }
  return position <= start ? position : position >= end ? position + replacementEnd - end : Math.min(position, replacementEnd);
}

// Write through the open editor when the block is being edited. Updating the
// graph while Roam's textarea still holds the old string lets Roam save that
// old string on blur, which made Mark It appear and then disappear.
function writeEditor(editor, value, selection) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(editor, value); else editor.value = value;
  editor.dispatchEvent(new window.Event("input", { bubbles: true }));
  try { editor.setSelectionRange(selection.start, selection.end); } catch { /* caret is cosmetic */ }
}

export function installMark(onChange = () => {}, { getQuestionTag = () => 'question', getQuestionStyle = () => 'tag', shortcutLabel = () => '' } = {}) {
  window.__zenithQuickMark?.cleanup?.();
  window.__magQuickMark?.cleanup?.();
  const history = new Map(), busy = new Set(), cleanups = [];
  let disposed = false, composing = false, menuObserver, menuTimer;
  const on = (target, name, callback, options) => { target.addEventListener(name, callback, options); cleanups.push(() => target.removeEventListener(name, callback, options)); };
  const current = () => api().ui?.getFocusedBlock?.();
  const sync = editor => {
    if (editor?.matches?.("textarea.rm-block-input")) editor.closest(".rm-block-main")?.classList.toggle("mag-marked", markRanges(editor.value).length > 0);
  };
  const editorFor = uid => {
    const active = document.activeElement;
    if (active?.matches?.("textarea.rm-block-input") && (active.id?.endsWith(`-${uid}`) || current()?.["block-uid"] === uid)) return active;
    return null;
  };
  async function toggle(explicitUid, kind = "mark") {
    if (disposed || composing) return;
    const location = current();
    const uid = explicitUid || location?.["block-uid"];
    if (!uid && kind === "question") throw new Error(t("Place the cursor inside a paragraph or native comment first, then toggle the question."));
    if (!uid || busy.has(uid)) return;
    const editor = editorFor(uid);
    const before = editor ? editor.value : textOf(pull(uid));
    if (!before.trim() || /^\s*```/.test(before)) return;
    const tag = kind === 'question' ? normalizeQuestionTag(getQuestionTag()) : 'mark';
    const style = kind === 'question' && getQuestionStyle() === 'attribute' ? 'attribute' : 'tag';
    const historyKey = `${kind}:${style}:${tag}:${uid}`;
    const next = kind === 'question' ? (style === 'attribute' ? questionAttributePlan(before, tag) : questionPlan(before,history.get(historyKey),tag)) : markPlan(before,history.get(historyKey));
    if (next.after === before) return;
    busy.add(uid);
    try {
      if (editor) {
        const selection = { start: mapCaret(editor.selectionStart, before, next.after), end: mapCaret(editor.selectionEnd, before, next.after) };
        writeEditor(editor, next.after, selection);
      } else await updateBlock({ uid, string: next.after });
      if (next.marked) history.set(historyKey, next); else history.delete(historyKey);
      sync(document.activeElement); onChange();
    } finally { busy.delete(uid); }
  }
  on(document, "compositionstart", () => { composing = true; }, true);
  on(document, "compositionend", () => { composing = false; }, true);
  on(document, "input", event => sync(event.target));
  on(document, "focusin", event => sync(event.target));
  on(document, "focusout", event => event.target.closest?.(".rm-block-main")?.classList.remove("mag-marked"));
  const stopWatch = () => { menuObserver?.disconnect(); clearTimeout(menuTimer); };
  const armMenu = event => {
    const bullet = event.target.closest?.(".rm-bullet,.simple-bullet-outer,.simple-bullet-inner");
    if (!bullet) return;
    const row = bullet.closest("[data-block-uid]");
    const uid = row?.getAttribute("data-block-uid") || bullet.closest(".rm-block-main")?.querySelector("[id]")?.id.slice(-9);
    if (!uid) return;
    stopWatch();
    document.querySelectorAll(".mag-mark-menu-entry").forEach(item => item.remove());
    const before = new Set(document.querySelectorAll('[role="menu"],.bp3-menu,.bp4-menu,.bp5-menu'));
    const inject = () => {
      const menus = [...document.querySelectorAll('[role="menu"],.bp3-menu,.bp4-menu,.bp5-menu')].filter(menu => menu.getClientRects().length && !menu.closest(".rm-command-palette,.rm-settings") && /copy block ref|focus on block|open in sidebar|expand all|collapse all/i.test(menu.textContent));
      const menu = menus.find(menu => !before.has(menu)) || menus[0];
      if (!menu || menu.querySelector(".mag-mark-menu-entry")) return;
      const item = document.createElement("li"); item.className = "mag-mark-menu-entry"; item.setAttribute("role", "none");
      const action = document.createElement("a"); action.tabIndex = 0; action.setAttribute("role", "menuitem");
      action.className = menu.classList.contains("bp5-menu") ? "bp5-menu-item" : menu.classList.contains("bp4-menu") ? "bp4-menu-item" : "bp3-menu-item";
      const keys = shortcutLabel();
      action.textContent = (markRanges(textOf(pull(uid))).length ? t("Unmark It") : t("Mark It")) + (keys ? ` · ${keys}` : "");
      action.onpointerdown = event => event.preventDefault();
      action.onclick = async event => {
        event.preventDefault(); event.stopPropagation(); if (action.getAttribute("aria-disabled") === "true") return; action.setAttribute("aria-disabled", "true");
        try {
          await toggle(uid);
          menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
          item.remove(); stopWatch();
        } catch (error) { action.textContent = error.message; action.setAttribute("aria-disabled", "false"); }
      };
      action.onkeydown = event => { if (event.key === "Enter" || event.key === " ") action.onclick(event); };
      item.append(action); menu.prepend(item);
    };
    menuObserver = new window.MutationObserver(inject);
    menuObserver.observe(document.body, { childList: true, subtree: true });
    menuTimer = setTimeout(stopWatch, 1200); inject();
  };
  on(document, "contextmenu", armMenu, true);
  on(document, "dblclick", armMenu, true);
  return { toggle, toggleQuestion: uid => toggle(uid, "question"), cleanup() {
    disposed = true; stopWatch(); cleanups.forEach(fn => fn());
    document.querySelectorAll(".mag-mark-menu-entry").forEach(item => item.remove());
    document.querySelectorAll(".mag-marked").forEach(item => item.classList.remove("mag-marked"));
    history.clear();
  } };
}
