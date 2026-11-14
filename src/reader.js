import { api, bookKey, currentUid, openAt, owningPage, plain, updateBlock } from "./graph.js";
import { getManagedBooks } from "./library.js";
import { confirmCatalog, contentForPage, readBookContent, suggestCatalog } from "./catalog.js";
import { collectAnnotations, createNotesDraft, dnpTitle, ensureNotesPage, NOTES_PREFIX, notesTitleFor } from "./annotations.js";
import { plainText, renderRich } from "./rich-text.js";
import { latestHeadingRepair, undoHeadingRepair } from "./heading-repair.js";
import { applyAppearance, HIGHLIGHT_COLOURS, HIGHLIGHT_SHAPES, MARK_STYLES, NOTE_COLOURS, NOTE_STYLES, TEXT_WIDTHS } from "./appearance.js";
import { ReadingProgress } from "./progress.js";
import { startTracker } from "./tracker.js";
import { latestRepair, undoLinkRepair } from "./repair.js";
import { PANEL_CSS } from "./panel-style.js";
import { parseEpub } from './epub.js';
import { latestArchiveCleanup, latestParagraphRepair, undoArchiveCleanup, undoParagraphRepair } from './paragraph-repair.js';
import { applyBookRepair, describeRepair, latestBookRepair, previewBookRepair, undoBookRepair } from './book-repair.js';
import { normalizeQuestionTag } from './mark.js';
import { startChapterLocator } from './current-chapter.js';
import { comboFromEvent, displayCombo, SHORTCUTS, shortcutKey } from './shortcuts.js';
import { LANGUAGES, setLanguage, t } from "./i18n.js";

const el = (tag, text, cls) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; };
const ALL = "__all__";
const ALL_NOTES_TITLE = "Reading Desk/Annotations";
const ago = time => { const minutes = Math.round((Date.now() - time) / 60000); if (minutes < 1) return t("just now"); if (minutes < 60) return t("{0} min ago", [minutes]); const hours = Math.round(minutes / 60); if (hours < 24) return t("{0} h ago", [hours]); const days = Math.round(hours / 24); return days < 30 ? t("{0} d ago", [days]) : new Date(time).toLocaleDateString(); };
const pageUidByTitle = title => api().data.pull("[:block/uid]", [":node/title", title])?.[":block/uid"] || null;
// "All Books": annotations and questions across managed books plus pages the
// reader explicitly added. Each source becomes one entry in the chapter filter.
export function aggregateContent(sources) {
  const nodes = [], byUid = new Map(), chapters = [], fragmentAliases = new Map(), pages = new Map();
  for (const source of sources) {
    const id = `scope:${source.key}`;
    chapters.push({ uid: id, title: source.record.title, parentUid: null, progress: false, sourceKey: source.key, pageTitle: [...source.pages.values()][0] || source.record.title, ordinaryPage: Boolean(source.ordinaryPage) });
    for (const node of source.nodes) { if (byUid.has(node.uid)) continue; const item = { ...node, chapterUid: id }; nodes.push(item); byUid.set(node.uid, item); }
    source.fragmentAliases?.forEach((target, fragment) => fragmentAliases.set(fragment, target));
    source.pages.forEach((title, uid) => pages.set(uid, title));
  }
  return { key: ALL, aggregate: true, ordinaryPage: true, record: { id: ALL, title: t("All Books"), pageUid: null }, catalog: { confirmed: true, rootUids: [], chapters }, chapters, nodes, byUid, parentByUid: new Map(), pages, missing: [], chapterAliases: new Map(), fragmentAliases, sources };
}
export function installReader(extensionAPI) {
  let host, shadow, panel, body, status, selector, links, scopeFooter, scope = null, tab = "Contents", content, annotations = [], progress, books = [], selectedBook = null;
  let stopTracker = () => {}, disposed = false, generation = 0, routeTimer, refreshTimer, previousChapter;
  let selected = new Set();
  let stopLocator = () => {}, activeChapter = null, updateCatalogCurrent = () => {}, actions = {}, lastActionUid;
  const preferences = new Map();
  const collapsedCatalogs = new Map();
  let panelPosition, drag;
  function placePanel(x, y) {
    if (!host) return;
    const rect = host.getBoundingClientRect();
    panelPosition = { x:Math.max(0, Math.min(x, window.innerWidth - rect.width)), y:Math.max(0, Math.min(y, window.innerHeight - rect.height)) };
    host.style.setProperty('left', `${panelPosition.x}px`, 'important'); host.style.setProperty('top', `${panelPosition.y}px`, 'important'); host.style.setProperty('right', 'auto', 'important');
  }
  const resize = () => { if (panelPosition) placePanel(panelPosition.x, panelPosition.y); };
  const preference = (key, fallback) => preferences.has(key) ? preferences.get(key) : extensionAPI.settings.get(key) ?? fallback;
  const report = error => { if (status?.isConnected) status.textContent = error?.message || String(error); else console.warn("[Reading Desk]", error); };
  const run = action => async event => { clearTimeout(refreshTimer); try { await action(event); } catch (error) { report(error); } };
  const button = (text, action, cls) => { const node = el("button", text, cls); node.type = "button"; node.onclick = run(action); return node; };
  async function setPreference(key, value) {
    preferences.set(key, value);
    try { await extensionAPI.settings.set(key, value); preferences.delete(key); return true; } catch { report("Settings could not sync. They remain active for this session."); return false; }
  }
  function toggleRow(label, key, fallback, changed) {
    const row = el("label", null, "rei-reader-toggle"); const input = el("input"); input.type = "checkbox"; input.checked = preference(key, fallback);
    input.onchange = run(async () => { await setPreference(key, input.checked); await changed?.(); });
    row.append(input, el("span", label)); return row;
  }
  const track = () => {
    stopTracker(); stopTracker = () => {};
    if (progress && !content?.ordinaryPage && content.catalog.confirmed && preference("reader-auto-progress", true)) {
      stopTracker = startTracker(progress, { onChange: updateProgressLabels, onError: report });
    }
  };
  const locate = () => {
    stopLocator(); stopLocator = () => {};
    if (panel?.isConnected && content?.catalog.confirmed) stopLocator = startChapterLocator(content,uid => { activeChapter = uid; updateCatalogCurrent(); });
  };
  function rememberActionTarget(event) {
    if (event && !event.target.matches?.('textarea.rm-block-input,[contenteditable="true"]')) return;
    const uid = event?.target.closest?.('[data-block-uid]')?.getAttribute('data-block-uid') || api().ui?.getFocusedBlock?.()?.['block-uid'];
    if (uid) lastActionUid = uid;
    const label = panel?.querySelector('[data-action-target]');
    if (label) label.textContent = lastActionUid ? t("Selected block: {0}", [plain(api().data.pull('[:block/string]', [':block/uid',lastActionUid])?.[':block/string']).slice(0,100) || lastActionUid]) : t("Click a paragraph or native comment to select an action target.");
  }
  function updateProgressLabels() {
    if (!panel?.isConnected || !progress) return;
    panel.querySelectorAll("[data-progress-uid]").forEach(node => {
      const summary = progress.summary(node.dataset.progressUid);
      node.textContent = `${t(summary.status)}${summary.seenCount && !summary.read ? t(" · approx. {0}%", [summary.percent]) : ""}`;
    });
    panel.querySelectorAll("[data-read-uid]").forEach(node => {
      const read = progress.summary(node.dataset.readUid).read;
      node.setAttribute("aria-pressed", String(read)); node.textContent = read ? "✓" : ""; node.title = read ? t("Read · click to unmark") : t("Mark as read");
      node.closest(".rei-reader-chapter")?.classList.toggle("rei-chapter-read", read);
    });
  }
  async function navigate(uid, sidebar = false) {
    const chapterUid = content?.byUid.get(uid)?.chapterUid || uid;
    // Ordinary pages are only scrolled: never fold or expand the user's own
    // blocks, which shifted the page while it was scrolling.
    const managed = content && !content.ordinaryPage;
    if (managed && !sidebar && preference("reader-auto-fold", true) && previousChapter && previousChapter !== chapterUid && content?.byUid.has(previousChapter)) {
      try { await updateBlock({ uid: previousChapter, open: false }); } catch (error) { report(t("Could not collapse the previous chapter: {0}", [error.message])); }
    }
    // Expand the heading that was clicked if it is collapsed (read fresh: the
    // cached content may predate an automatic fold).
    if (!sidebar && api().data.pull("[:block/open]", [":block/uid", uid])?.[":block/open"] === false) await updateBlock({ uid, open: true });
    await openAt(uid, sidebar);
    if (!sidebar) { previousChapter = chapterUid; activeChapter = chapterUid; updateCatalogCurrent(); }
  }
  async function openBookPage(book) {
    const target = (book.catalog?.rootUids || []).map(uid => owningPage(uid)?.uid).find(Boolean) || book.pageUid;
    if (!target) return;
    const current = await currentUid();
    if ((owningPage(current)?.uid || current) !== target) await api().ui.mainWindow.openPage({ page: { uid: target } });
  }
  async function openPageBy(title, sidebar = false) {
    const uid = pageUidByTitle(title); if (!uid) throw new Error(t("The page {0} does not exist yet.", [title]));
    if (sidebar) { await api().ui.rightSidebar.open(); await api().ui.rightSidebar.addWindow({ window: { type: "outline", "block-uid": uid } }); }
    else await api().ui.mainWindow.openPage({ page: { uid } });
  }
  const notesTitleOf = value => value.aggregate ? ALL_NOTES_TITLE : notesTitleFor(value);
  const sourceTitlesOf = (value, chosen = null) => value.aggregate ? (chosen || []).map(item => value.chapters.find(chapter => chapter.uid === item.chapterUid)?.pageTitle) : [...value.pages.values()];
  // Show a notes page: sidebar (default) or main window. If the sidebar
  // window does not appear, fall back to the main window so the page always
  // opens.
  async function showNotes(uid, sidebar) {
    if (!sidebar) { await api().ui.mainWindow.openPage({ page: { uid } }); return "main window"; }
    try {
      await api().ui.rightSidebar.open?.();
      await api().ui.rightSidebar.addWindow({ window: { type: "outline", "block-uid": uid } });
      await new Promise(resolve => setTimeout(resolve, 250));
      const windows = api().ui.rightSidebar.getWindows?.();
      if (!Array.isArray(windows) || windows.some(item => item?.["block-uid"] === uid || item?.["page-uid"] === uid)) return "sidebar";
    } catch (error) { console.warn("[Reading Desk] sidebar", error); }
    await api().ui.mainWindow.openPage({ page: { uid } }); return "main window";
  }
  async function openNotes(sidebar = false) {
    if (!content) throw new Error(t("Open a book or page first."));
    const title = notesTitleOf(content);
    let uid = pageUidByTitle(title);
    if (!uid) uid = await ensureNotesPage(title, sourceTitlesOf(content));
    await showNotes(uid, sidebar); renderLinks();
  }
  const pinnedPages = () => { try { const value = preference("reader-pinned-pages", []); return Array.isArray(value) ? value : JSON.parse(value || "[]"); } catch { return []; } };
  function renderLinks() {
    if (!links?.isConnected) return;
    links.replaceChildren();
    if (!content) return;
    if (content.ordinaryPage && !content.aggregate) {
      const pinned = pinnedPages(), uid = content.record.pageUid, isPinned = pinned.some(item => item.uid === uid);
      const pin = button(isPinned ? t("Remove from All Books") : t("Include in All Books"), async () => {
        const next = isPinned ? pinned.filter(item => item.uid !== uid) : [...pinned, { uid, title: content.record.title }];
        await setPreference("reader-pinned-pages", next); await refresh(null, { followLocation: true });
      }, "rei-chip"); pin.title = t("Pages you include appear in the All Books scope with your books"); links.append(pin);
    }
    links.hidden = !links.childElementCount;
  }
  function renderCatalogConfirmation(record, suggested) {
    scopeFooter?.remove();
    body.replaceChildren(el("p", t("Confirm which existing chapters belong to this book. Uncheck your own notes. This records block IDs only; existing text, comments, and highlights are preserved.")));
    body.scrollTop = 0;
    const selectedRoots = new Set(suggested.rootUids);
    for (const uid of suggested.rootUids) {
      const chapter = suggested.chapters.find(chapter => chapter.uid === uid);
      const label = el("label", null, "rei-reader-scope"); const checkbox = el("input"); checkbox.type = "checkbox"; checkbox.checked = true;
      checkbox.onchange = () => checkbox.checked ? selectedRoots.add(uid) : selectedRoots.delete(uid);
      label.append(checkbox, el("span", chapter?.title || uid)); body.append(label);
    }
    const confirm = button(t("Confirm Book Scope"), async () => {
      generation++; clearTimeout(refreshTimer); confirm.disabled = true;
      try {
        selectedBook = await confirmCatalog(record, suggested, [...selectedRoots], extensionAPI);
        await refresh(selectedBook);
      } finally { if (confirm.isConnected) confirm.disabled = false; }
    }, "rei-primary");
    scopeFooter = el("footer", null, "rei-scope-actions"); scopeFooter.append(confirm); panel.append(scopeFooter);
  }
  async function relink() {
    if (!selectedBook) return;
    const current = await currentUid(); const page = owningPage(current)?.uid || current;
    renderCatalogConfirmation(selectedBook, suggestCatalog(selectedBook, page));
  }
  function renderSources() {
    body.append(el("p", t("Annotations and questions from every managed book and every page you included. Choose a source to open it."), "rei-muted"));
    for (const chapter of content.chapters) {
      const row = el("div", null, "rei-reader-chapter");
      const slot = el("span", null, "rei-catalog-slot");
      const source = content.sources.find(item => `scope:${item.key}` === chapter.uid);
      const title = button(chapter.title, async () => {
        const book = books.find(item => bookKey(item) === source?.key);
        if (book) { await refresh(book); await openBookPage(book); }
        else if (source?.record.pageUid) { await api().ui.mainWindow.openPage({ page: { uid: source.record.pageUid } }); }
      }, "rei-reader-link");
      const count = annotations.filter(item => item.chapterUid === chapter.uid).length;
      row.append(slot, title, el("small", t("{0} · {1} annotations", [chapter.ordinaryPage ? t("Page") : t("Book"), count]), "rei-row-meta")); body.append(row);
    }
  }
  function renderContents() {
    if (content.aggregate) { renderSources(); return; }
    if (!content.catalog.confirmed) { renderCatalogConfirmation(content.record, content.catalog); return; }
    const latest = progress?.latest();
    if (latest) {
      const chapter = content.chapters.find(item => item.uid === latest[0]);
      const card = el("div", null, "rei-last-read");
      const text = el("div", null, "rei-grow"); text.append(el("small", t("Last read · {0}", [ago(latest[1].updatedAt)]), "rei-muted"), el("div", chapter?.title || t("Body"), "rei-last-title"));
      card.append(text, button(t("Continue"), () => navigate(latest[1].lastBlockUid), "rei-primary")); body.append(card);
    }
    if (!content.chapters.length) {
      body.append(el("p", content.ordinaryPage ? t("No contents on this page. Contents are built from H1, H2 and H3 headings.") : t("No chapters were found."), "rei-muted"));
      return;
    }
    const actions = el("div", null, "rei-reader-actions");
    if (!content.ordinaryPage) actions.append(button(t("Collapse All Chapters"), async () => { for (const chapter of content.chapters) await updateBlock({ uid: chapter.uid, open: false }); }));
    body.append(actions);
    let collapsed = collapsedCatalogs.get(content.key);
    if (!collapsed) { collapsed = new Set(); collapsedCatalogs.set(content.key, collapsed); }
    const chaptersByUid = new Map(content.chapters.map(chapter => [chapter.uid, chapter]));
    const parents = new Set(content.chapters.map(chapter => chapter.parentUid).filter(uid => uid && chaptersByUid.has(uid)));
    const ancestors = chapter => { const path = new Set(); let parent = chapter.parentUid; while (parent && chaptersByUid.has(parent) && !path.has(parent)) { path.add(parent); parent = chaptersByUid.get(parent).parentUid; } return [...path]; };
    const rows = new Map();
    const updateTree = () => rows.forEach((row, uid) => { row.hidden = ancestors(chaptersByUid.get(uid)).some(parent => collapsed.has(parent)); });
    if (parents.size) actions.append(button(t("Collapse Subdirectories"), () => { parents.forEach(uid => collapsed.add(uid)); renderTree(); }), button(t("Expand Subdirectories"), () => { collapsed.clear(); renderTree(); }));
    updateCatalogCurrent = () => {
      let visibleUid = activeChapter; const seen = new Set();
      while (rows.get(visibleUid)?.hidden && !seen.has(visibleUid)) { seen.add(visibleUid); visibleUid = chaptersByUid.get(visibleUid)?.parentUid; }
      rows.forEach((row,uid) => {
        const current = uid === visibleUid;
        row.classList.toggle('rei-current-chapter',current);
        if (current) { row.setAttribute('aria-current','location'); row.title = t("Current section: {0}", [chaptersByUid.get(activeChapter)?.title || '']); }
        else { row.removeAttribute('aria-current'); row.removeAttribute('title'); }
      });
    };
    const renderTree = () => { updateTree(); rows.forEach((row,uid) => { const toggle = row.querySelector('.rei-catalog-toggle'); if (toggle) { toggle.textContent = collapsed.has(uid) ? '▸' : '▾'; toggle.setAttribute('aria-expanded', String(!collapsed.has(uid))); } }); updateCatalogCurrent(); };
    for (const chapter of content.chapters) {
      // Fixed grid: [toggle slot][title][read]. Rows without children keep an
      // empty slot, so sibling titles always line up.
      const row = el("div", null, "rei-reader-chapter"); row.style.setProperty("--rei-indent", `${Math.min(ancestors(chapter).length, 8) * 14}px`); row.dataset.chapterUid = chapter.uid; rows.set(chapter.uid,row);
      if (parents.has(chapter.uid)) { const toggle = button('', () => { if (collapsed.has(chapter.uid)) collapsed.delete(chapter.uid); else collapsed.add(chapter.uid); renderTree(); }, 'rei-catalog-toggle'); toggle.setAttribute('aria-label', t("Toggle subdirectory: {0}", [chapter.title])); row.append(toggle); }
      else row.append(el("span", null, "rei-catalog-slot"));
      const title = button(chapter.title, event => navigate(chapter.uid, event.shiftKey), "rei-reader-link");
      row.append(title);
      const tracked = progress?.states.has(chapter.uid);
      if (tracked) {
        const read = button("", async () => { const next = !progress.summary(chapter.uid).read; await progress.markRead(chapter.uid, next); updateProgressLabels(); }, "rei-read-toggle");
        read.dataset.readUid = chapter.uid; read.title = t("Mark as read"); row.append(read);
        const meta = el("div", null, "rei-row-meta"); const summary = el("span", ""); summary.dataset.progressUid = chapter.uid;
        meta.append(summary, button(t("Resume"), () => navigate(progress.summary(chapter.uid).lastBlockUid || chapter.uid), "rei-text-button"), button(t("Reset"), async () => {
          if (window.confirm(t("Reset browsing progress for {0}? Text and annotations will be preserved.", [chapter.title]))) { await progress.reset(chapter.uid); updateProgressLabels(); }
        }, "rei-text-button"), button(t("Fold"), () => updateBlock({ uid: chapter.uid, open: false }), "rei-text-button"));
        row.append(meta);
      } else if (!content.ordinaryPage) {
        const meta = el("div", null, "rei-row-meta"); meta.append(button(t("Fold"), () => updateBlock({ uid: chapter.uid, open: false }), "rei-text-button")); row.append(meta);
      }
      body.append(row);
    }
    renderTree();
    if (content.missing.length) body.append(el("p", t("{0} chapter entries are missing. Use the action below to link their current location.", [content.missing.length]), "rei-error"));
    if (!content.ordinaryPage) body.append(button(t("Link Current Page to This Book"), relink));
    body.append(el("p", content.ordinaryPage ? t("Contents come from H1, H2 and H3 headings. Clicking a heading only scrolls; nothing on the page is folded or changed.") : t("Unvisited chapters are not tasks. Coverage estimates paragraphs viewed, not words read or comprehension. Use ✓ to mark a chapter as read yourself."), "rei-muted"));
    updateProgressLabels();
  }
  function annotationCard(annotation, choose = true) {
    const row = el("div", null, "rei-reader-annotation");
    if (choose) {
      const check = el("input"); check.type = "checkbox"; check.checked = selected.has(annotation.id); check.setAttribute("aria-label", t("Include in notes draft"));
      check.onchange = () => check.checked ? selected.add(annotation.id) : selected.delete(annotation.id); row.append(check);
    }
    const info = el("div", null, "rei-grow");
    const chapter = content.chapters.find(chapter => chapter.uid === annotation.chapterUid);
    info.append(el("small", `${t({ highlight: "highlight", comment: "comment", mark: "mark", question: "question" }[annotation.type] || annotation.type)} · ${chapter?.title || t("This page")}`, "rei-muted"));
    info.append(button(plainText(annotation.text) || t("(Empty annotation)"), event => navigate(annotation.targetUid, event.shiftKey), "rei-reader-link rei-annotation-text"));
    info.append(button(annotation.type === "comment" ? t("Open Native Comment") : t("Open in Sidebar"), () => openAt(annotation.refUid || annotation.targetUid, true)));
    row.append(info); return row;
  }
  function renderAnnotations(questionsOnly = false) {
    const filters = el("div", null, "rei-reader-filters");
    const search = el("input"); search.type = "search"; search.placeholder = t("Search annotations");
    const type = el("select");
    for (const kind of ["all", "highlight", "comment", "mark", "question"]) { const option = el("option", t({ all: "All types", highlight: "Highlights", comment: "Comments", mark: "Marks", question: "Questions" }[kind])); option.value = kind; type.append(option); }
    const chapter = el("select"); chapter.append(el("option", content.aggregate ? t("All sources") : t("All chapters"))); chapter.firstChild.value = "";
    content.chapters.forEach(item => { const option = el("option", item.title); option.value = item.uid; chapter.append(option); });
    const list = el("div"); const count = el("p", "", "rei-muted");
    let limit = 40;
    const draw = () => {
      const query = search.value.toLowerCase();
      const items = annotations.filter(item => (!questionsOnly || item.question) && (type.value === "all" || item.type === type.value) && (!chapter.value || item.chapterUid === chapter.value) && (!query || plainText(item.text).toLowerCase().includes(query)));
      count.textContent = t("{0} items · Click to locate in context; Shift+click for sidebar.", [items.length]);
      list.replaceChildren(...items.slice(0, limit).map(item => annotationCard(item)));
      if (items.length > limit) list.append(button(t("Load More"), () => { limit += 40; draw(); }));
    };
    search.oninput = () => { limit = 40; draw(); }; type.onchange = chapter.onchange = () => { limit = 40; draw(); };
    filters.append(search, type, chapter); body.append(filters, count, list);
    if (questionsOnly) body.append(el("p", t("Questions collects everything still open: native TODO, your question tags, and question attributes (for example {0}). DONE items are excluded. Alt+Q toggles one on the current block; choose tag or attribute style in Settings.", [preference('reader-question-style','tag') === 'attribute' ? t("Question:: …") : '#' + preference('reader-quick-question-tag','question')]), "rei-muted"));
    else body.append(el("p", t("Annotations collects highlights, native comments, marks and questions. Tick items to build a reading-notes page that references the originals."), "rei-muted"));
    const title = el("input"); title.value = content.aggregate ? ALL_NOTES_TITLE : notesTitleFor(content); title.setAttribute("aria-label", t("Destination page for notes draft"));
    const draft = button(t("Create Notes Draft from Selection"), async () => {
      draft.disabled = true;
      try {
        const chosen = annotations.filter(item => selected.has(item.id));
        const sourceTitles = sourceTitlesOf(content, chosen);
        const result = await createNotesDraft(content, chosen, title.value, { sourceTitles });
        const where = await showNotes(result.pageUid, preference("reader-notes-open", "sidebar") !== "main");
        status.textContent = t("Appended {0} referenced notes to {1}, linked to the source page. Opened in the {2}.", [result.count, result.title, t(where)]);
        renderLinks();
      } finally { draft.disabled = false; }
    });
    body.append(title, draft);
    draw();
  }
  // Book repair is one step: every safe fix runs together and one Undo
  // restores all of it. The original EPUB is optional (split paragraphs).
  // Reading notes for the current book or page: an entry to the notes page,
  // then every generated draft, folded by the day it was created.
  function renderNotes() {
    const title = notesTitleOf(content), pageUid = pageUidByTitle(title);
    if (!pageUid) {
      body.append(el('p', t("No reading notes yet for {0}. In Annotations, tick items and choose Create Notes Draft; the notes page ({1}) opens in the sidebar.", [content.record.title, title]), 'rei-muted'));
      body.append(button(t("Create Notes Page"), async () => { await openNotes(true); draw(); }));
      return;
    }
    const entry = el('div', null, 'rei-notes-entry');
    const open = button(`${title} ↗`, event => openNotes(event.shiftKey), 'rei-primary'); open.title = `${title}\n${t("Open the notes page (Shift+click: sidebar)")}`;
    entry.append(open, button(t("Sidebar"), () => openNotes(true), 'rei-chip')); body.append(entry);
    const page = api().data.pull("[:block/uid :block/string :block/order :create/time {:block/children ...}]", [":block/uid", pageUid]);
    const roots = [...(page?.[":block/children"] || [])].sort((a, b) => (a[":block/order"] || 0) - (b[":block/order"] || 0));
    const drafts = roots.filter(node => String(node[":block/string"] || "").startsWith(NOTES_PREFIX));
    const others = roots.length - drafts.length - roots.filter(node => /^Source::/.test(node[":block/string"] || "")).length;
    if (!drafts.length) { body.append(el('p', t("No generated drafts on this page yet. Create one from the Annotations tab."), 'rei-muted')); return; }
    const dayOf = node => {
      const text = String(node[":block/string"] || "").slice(NOTES_PREFIX.length);
      const linked = text.match(/\[\[([^\]]+)\]\]/)?.[1];
      if (linked) return linked;
      const stamp = node[":create/time"] || Date.parse(text);
      return Number.isFinite(stamp) ? dnpTitle(new Date(stamp)) : t('Earlier');
    };
    const days = new Map();
    for (const node of drafts) { const day = dayOf(node); if (!days.has(day)) days.set(day, []); days.get(day).push(node); }
    const count = node => { let n = 0; const walk = item => (item[":block/children"] || []).forEach(child => { if (/^\s*\(\([^()]+\)\)\s*$/.test(child[":block/string"] || "")) n++; walk(child); }); walk(node); return n; };
    const line = (node, depth) => {
      const text = node[":block/string"] || "";
      const row = el('div', null, depth === 1 ? 'rei-note-group' : 'rei-note-line'); row.style.setProperty('--rd-depth', String(Math.max(0, depth - 1)));
      row.append(renderRich(text));
      const target = text.match(/^\s*(?:Source:\s*)?\(\(([^()]+)\)\)\s*$/)?.[1];
      if (target) { row.classList.add('rei-note-link'); row.title = t("Show in the book (Shift+click: sidebar)"); row.onclick = run(event => navigate(target, event.shiftKey)); }
      return row;
    };
    const list = el('div', null, 'rei-notes-days');
    [...days.entries()].reverse().forEach(([day, nodes]) => {
      const box = el('details', null, 'rei-notes-day');
      const total = nodes.reduce((sum, node) => sum + count(node), 0);
      box.append(el('summary', t("{0} · {1} draft{2} · {3} note{4}", [day, nodes.length, nodes.length === 1 ? '' : 's', total, total === 1 ? '' : 's'])));
      box.addEventListener('toggle', () => {
        if (!box.open || box.dataset.filled) return; box.dataset.filled = '1';
        for (const node of [...nodes].reverse()) {
          const head = el('div', null, 'rei-note-draft'); head.append(renderRich(String(node[":block/string"] || "").slice(NOTES_PREFIX.length)));
          head.title = t("Open this draft (Shift+click: sidebar)"); head.onclick = run(event => openAt(node[":block/uid"], event.shiftKey));
          box.append(head);
          const walk = (item, depth) => [...(item[":block/children"] || [])].sort((a, b) => (a[":block/order"] || 0) - (b[":block/order"] || 0)).forEach(child => { box.append(line(child, depth)); if (depth < 4) walk(child, depth + 1); });
          walk(node, 1);
        }
      });
      list.append(box);
    });
    body.append(list);
    if (others > 0) body.append(el('p', t("The notes page also has {0} block(s) you wrote yourself; open the page to see them.", [others]), 'rei-muted'));
  }
  function renderRepair() {
    body.append(button(t("Back to Settings"),() => {tab='Settings';draw();}),el('h4',t("Repair This Book")));
    if (content.ordinaryPage) { body.append(el("p", t("Book repair is available for managed books only. Select a book in the scope menu. Ordinary pages are never changed automatically."))); return; }
    const repairContent = content;
    let sourceBook = null;
    const summary = el('div');
    const show = () => {
      const plan = previewBookRepair(repairContent, sourceBook);
      const lines = describeRepair(plan.counts);
      summary.replaceChildren();
      if (!lines.length) summary.append(el('p', t("Nothing to repair in this book."), 'rei-muted'));
      else { const list = el('ul', null, 'rei-repair-list'); lines.forEach(line => list.append(el('li', line))); summary.append(el('p', t("This repair will:")), list); }
      if (plan.counts.keptArchives) summary.append(el('p', t("{0} archive(s) stay because an old fragment has its own child blocks.", [plan.counts.keptArchives]), 'rei-muted'));
      const preview = el('details'); preview.append(el('summary', t("Preview the changes")));
      const out = [];
      plan.paragraphs?.changes.slice(0, 40).forEach(change => out.push(`paragraph  ${plain(change.after).slice(0, 90)}`));
      plan.links.changes.slice(0, 60).forEach(change => out.push(`link  ${plain(change.before).slice(0, 50)} → ${plain(change.after).slice(0, 50)}`));
      plan.archives.removable.slice(0, 40).forEach(archive => out.push(`archive  ${plain(archive.fragments[0]?.text || '').slice(0, 80)}${archive.references ? ` (${archive.references} reference(s) moved)` : ''}`));
      plan.headings.changes.slice(0, 200).forEach(change => out.push(change.type === 'chapter' ? `H${change.before.heading || 0} → H${change.after.heading}  ${plain(change.text).slice(0, 80)}` : change.type === 'duplicate' ? `remove duplicate H${change.heading}  ${plain(change.text).slice(0, 80)}` : change.type === 'footnote' ? `footnote ${plain(change.text)} → end of “${plain(change.targetText).slice(0, 60)}” (${change.childUids.length} paragraphs move up)` : `H${change.before.heading} → ${change.footnote ? 'plain' : 'bold'}  ${plain(change.text).slice(0, 80)}`));
      preview.append(el('pre', out.join('\n') || t("Nothing to change.")));
      const apply = button(t("Repair This Book"), async () => {
        if (!window.confirm(t("Repair {0}?\n\n{1}\n\nEverything is backed up; one Undo restores it all.", [repairContent.record.title, lines.map(line => `• ${line}`).join('\n')]))) return;
        apply.disabled = true;
        try {
          const record = await applyBookRepair(repairContent, () => readBookContent(repairContent.record, { allowSuggested: false }), { sourceBook, onProgress: text => { status.textContent = text; } });
          await refresh(selectedBook);
          const r = record.results;
          status.textContent = t("Repaired: {0}.{1} Undo is available.", [[r.paragraphs && t("{0} paragraphs", [r.paragraphs]), r.links && t("{0} link blocks", [r.links]), r.archives && t("{0} archives ({1} references moved)", [r.archives, r.references || 0]), r.headings && t("{0} headings", [r.headings])].filter(Boolean).join(', ') || t("nothing needed"), r.skipped ? t(" {0} block(s) changed since the preview were skipped; run the repair again.", [r.skipped]) : '']);
        } finally { if (apply.isConnected) apply.disabled = false; }
      }, 'rei-primary');
      apply.disabled = !plan.total;
      summary.append(preview, apply);
    };
    body.append(el('p', t("Fixes everything that can be fixed safely in one step: heading levels for Contents, footnote markers shown as headings, broken numbered links, and leftover EPUB-READER:paragraph-fragments archives. Text, comments and highlights are kept."), 'rei-muted'));
    const fileLabel = el('label', null, 'rei-setting'); fileLabel.append(el('span', t("Optional: choose the original EPUB to also rejoin paragraphs split by old imports (read locally, nothing is uploaded)")));
    const file = el('input'); file.type = 'file'; file.accept = '.epub,application/epub+zip'; file.setAttribute('aria-label', t("Original EPUB for paragraph repair")); fileLabel.append(file);
    file.onchange = run(async () => {
      const sourceFile = file.files?.[0]; if (!sourceFile) return;
      summary.replaceChildren(el('p', t("Checking the original EPUB…"), 'rei-muted'));
      sourceBook = await parseEpub(await sourceFile.arrayBuffer(), sourceFile.name);
      if (file.isConnected && content === repairContent) show();
    });
    body.append(fileLabel, summary);
    show();
    const last = latestBookRepair(content);
    if (last && !last.undoneAt) body.append(button(t("Undo Last Repair"), async () => {
      if (!window.confirm(t("Undo the last book repair? Blocks edited since then are left as they are."))) return;
      const result = await undoBookRepair(last.key); await refresh(selectedBook);
      status.textContent = t("Restored {0} items; skipped {1} edited items.", [result.restored, result.skipped]);
    }));
    // Repairs made with earlier versions (separate steps) can still be undone.
    const combined = new Set(Object.values(last?.steps || {}));
    const legacy = [['Heading repair', latestHeadingRepair(content), undoHeadingRepair], ['Link repair', latestRepair(content), undoLinkRepair], ['Paragraph repair', latestParagraphRepair(content), undoParagraphRepair], ['Archive removal', latestArchiveCleanup(content), undoArchiveCleanup]]
      .filter(([, backup]) => backup && !backup.undoneAt && !combined.has(backup.key) && (backup.applied?.length || backup.removed?.length));
    if (legacy.length) {
      const older = el('details'); older.append(el('summary', t("Undo a repair made with an earlier version")));
      legacy.forEach(([label, backup, undo]) => older.append(button(t("Undo {0}", [t(label)]), async () => { const result = await undo(backup.key); await refresh(selectedBook); status.textContent = t("Restored {0} items; skipped {1}.", [result.restored.length, result.skipped.length]); })));
      body.append(older);
    }
  }
  function selectRow(label, key, fallback, options, changed) {
    const row = el('label',null,'rei-setting'); row.append(el('span',label));
    const select = el('select'); for (const [value,text] of options) { const option = el('option',t(text)); option.value = value; select.append(option); }
    select.value = preference(key, fallback); if (select.selectedIndex < 0 || !options.some(([value]) => value === select.value)) select.value = fallback; select.setAttribute('aria-label', label);
    select.onchange = run(async () => { await setPreference(key, select.value); await changed?.(); });
    row.append(select); return row;
  }
  const keyName = id => { const combo = actions.shortcuts?.comboFor(id); return combo ? displayCombo(combo) : t('its shortcut (not set)'); };
  // Click a shortcut, press the new keys. Existing shortcuts are paused while
  // recording so the keys reach the recorder.
  function shortcutEditor() {
    const list = el('div',null,'rei-shortcuts');
    for (const spec of SHORTCUTS) {
      const row = el('div',null,'rei-setting rei-shortcut'); row.append(el('span',t(spec.label)));
      const keys = button(displayCombo(actions.shortcuts?.comboFor(spec.id) || ''),() => {
        if (keys.dataset.recording) return;
        keys.dataset.recording = '1'; keys.textContent = t("Press keys…"); actions.shortcuts?.pause(true);
        const stop = () => { delete keys.dataset.recording; actions.shortcuts?.pause(false); window.removeEventListener('keydown', onKey, true); };
        const onKey = async event => {
          event.preventDefault(); event.stopImmediatePropagation();
          if (event.key === 'Escape') { stop(); keys.textContent = displayCombo(actions.shortcuts?.comboFor(spec.id) || ''); return; }
          if (event.key === 'Backspace' || event.key === 'Delete') { stop(); await setPreference(shortcutKey(spec.id), ''); keys.textContent = displayCombo(''); status.textContent = t("{0}: shortcut cleared.", [t(spec.label)]); return; }
          const combo = comboFromEvent(event); if (!combo) return;
          stop();
          const clash = actions.shortcuts?.conflicts(spec.id, combo) || [];
          if (clash.length) { keys.textContent = displayCombo(actions.shortcuts?.comboFor(spec.id) || ''); status.textContent = t("{0} is already used by {1}.", [displayCombo(combo), clash.join(', ')]); return; }
          await setPreference(shortcutKey(spec.id), combo); keys.textContent = displayCombo(combo); status.textContent = `${t(spec.label)}: ${displayCombo(combo)}.`;
        };
        window.addEventListener('keydown', onKey, true);
      }, 'rei-chip');
      keys.title = t("Click, then press the new shortcut");
      const reset = button('↺',async () => { await setPreference(shortcutKey(spec.id), null); keys.textContent = displayCombo(actions.shortcuts?.comboFor(spec.id) || ''); },'rei-chip'); reset.title = t("Reset to {0}", [displayCombo(spec.fallback)]);
      row.append(keys, reset); list.append(row);
    }
    return list;
  }
  function renderSettings() {
    body.append(el('h4',t("Language")),selectRow(t('Interface language'),'reader-language','Auto',LANGUAGES,() => relanguage()));
    body.append(el('h4',t("Library")));
    for (const [label,key] of [['Import EPUB','importEpub'],['Manage Imported Books','manageBooks'],['Recover Existing Book','recoverBook']]) {
      const entry = button(t(label),async () => { close(); await actions[key](); }); entry.disabled = !actions[key]; body.append(entry);
    }
    body.append(el('h4',t("Reading")),toggleRow(t("Collapse the previous chapter when navigating"),'reader-auto-fold',true),toggleRow(t("Track browsing automatically (estimated, not comprehension)"),'reader-auto-progress',true,track),el('p',t("Automatic progress applies to managed books only. Panel subdirectory folding does not change the book itself."),'rei-muted'),selectRow(t("Text width"),'reader-text-width','fill',TEXT_WIDTHS,() => { applyAppearance(preference); window.dispatchEvent(new window.Event('reading-desk-comments-refresh')); }),el('p',t("Fill the line: paragraphs run to the end of their row, so wide windows have no empty strip before the reference count. Side notes go in the margin outside the text, as in Folio."),'rei-muted'));
    body.append(el('h4',t("Native Comments")),toggleRow(t("Native comment side notes (graph-wide)"),'reader-comment-rail',true,() => window.dispatchEvent(new window.Event('reading-desk-comments-refresh'))),el('p',t("Notes are shown in full and stacked beside the text. Click a note or its paragraph to line them up; ↗ opens the native thread for editing."),'rei-muted'));
    const appearance = () => applyAppearance(preference);
    const noteAppearance = () => { applyAppearance(preference); window.dispatchEvent(new window.Event('reading-desk-comments-refresh')); };
    body.append(selectRow(t("Side note style"),'reader-note-style','notion',NOTE_STYLES,noteAppearance),selectRow(t("Side note colour"),'reader-note-colour','gold',NOTE_COLOURS,noteAppearance),selectRow(t("Side note order"),'reader-note-order','oldest',[['oldest','Oldest first'],['newest','Newest first']],noteAppearance));
    body.append(el('h4',t("Highlights")),selectRow(t("Highlight colour"),'reader-highlight-colour','coral',HIGHLIGHT_COLOURS,appearance),selectRow(t("Highlight style"),'reader-highlight-shape','marker',HIGHLIGHT_SHAPES,appearance),el('p',t("Applies to native ^^highlights^^ everywhere. Theme default keeps your theme colour."),'rei-muted'));
    body.append(el('h4',t("Mark It")),selectRow(t("Mark style"),'reader-mark-style','dot',MARK_STYLES,appearance),el('p',t("{0} or the block menu toggles #mark; the tag stays in the text and is hidden while reading.", [keyName('mark')]),'rei-muted'));
    body.append(el('h4',t("Questions")));
    const tagsLabel = el('label',null,'rei-setting'); tagsLabel.append(el('span',t("Recognized question tags (comma-separated)")));
    const tags = el('input'); tags.value = preference('reader-question-tags','question'); tags.setAttribute('aria-label',t("Recognized question tags")); tagsLabel.append(tags);
    const quickLabel = el('label',null,'rei-setting'); quickLabel.append(el('span',t("Quick question tag ({0})", [keyName('question')])));
    const quick = el('input'); quick.value = preference('reader-quick-question-tag','question'); quick.setAttribute('aria-label',t("Quick question tag")); quickLabel.append(quick);
    body.append(tagsLabel,quickLabel,selectRow(t("Toggle Question inserts"),'reader-question-style','tag',[['tag','A tag at the end (#question)'],['attribute','An attribute at the start (Question::)']]),el('p',t("Enter tag names without #. The quick question tag is always recognized, including in native comments. Mark It retains #mark for compatibility with your original style."),'rei-muted'),button(t("Save Question Settings"),async () => {
      const tag = normalizeQuestionTag(quick.value);
      const recognized = tags.value.split(/[,，]/).map(item => item.trim()).filter(Boolean).map(normalizeQuestionTag);
      const savedQuick = await setPreference('reader-quick-question-tag',tag); const savedTags = await setPreference('reader-question-tags',[...new Set(recognized)].join(','));
      await refresh(selectedBook); status.textContent = savedQuick && savedTags ? t("Question settings saved. Toggle Question uses your quick question tag.") : t("Question settings are active for this session; settings storage could not sync.");
    }),el('h4',t("Keyboard Shortcuts")),shortcutEditor(),el('p',t("Click a shortcut, then press the new keys (with Ctrl, Cmd/⌘ or Alt/⌥). Esc cancels, Backspace clears. Reading Desk handles these keys before Roam, so Option+M no longer types “µ”. Drag the title bar to move this panel. Shift+click opens content in the sidebar."),'rei-muted'),el('h4',t("Reading Notes")),selectRow(t("Open new reading notes in"),'reader-notes-open','sidebar',[['sidebar','The right sidebar'],['main','The main window']]),el('h4',t("Maintenance")),button(t("Repair This Book"),() => {tab='Repair';draw();}),el('p',t("One step for imported books: heading levels, footnote headings, broken links and leftover paragraph archives (optionally split paragraphs). Shows what will change first; one Undo restores it."),'rei-muted'));
    const quickActions = el('div',null,'rei-reader-actions');
    for (const [label,key] of [['Toggle Mark','toggleMark'],['Toggle Question','toggleQuestion']]) {
      const entry = button(t(label),async () => { if (!lastActionUid || !api().data.pull('[:block/uid]', [':block/uid',lastActionUid])) throw new Error(t("Click a paragraph or native comment first, then use this action.")); await actions[key](lastActionUid); });
      entry.disabled = !actions[key]; entry.onpointerdown = event => event.preventDefault(); quickActions.append(entry);
    }
    const target = el('p',null,'rei-muted'); target.dataset.actionTarget = '';
    const shortcuts = [...body.querySelectorAll('h4')].find(node => node.textContent === t('Keyboard Shortcuts'));
    shortcuts.after(quickActions,target); rememberActionTarget();
  }
  function draw() {
    if (!body?.isConnected || !content) return;
    scopeFooter?.remove(); scopeFooter = null;
    body.replaceChildren();
    body.scrollTop = 0;
    updateCatalogCurrent = () => {};
    try {
      if (tab === "Contents") renderContents();
      else if (tab === "Annotations") renderAnnotations();
      else if (tab === "Questions") renderAnnotations(true);
      else if (tab === "Notes") renderNotes();
      else if (tab === "Settings") renderSettings();
      else renderRepair();
    } catch (error) { report(error); }
    panel.querySelectorAll("[data-reader-tab]").forEach(button => button.setAttribute("aria-selected", String(button.dataset.readerTab === (tab === 'Repair' ? 'Settings' : tab))));
    renderLinks();
  }
  async function refresh(book, { followLocation = false } = {}) {
    const ticket = ++generation;
    stopTracker(); stopTracker = () => {};
    stopLocator(); stopLocator = () => {}; activeChapter = null;
    await progress?.flush();
    const loadedBooks = await getManagedBooks(extensionAPI);
    const uid = await currentUid();
    const page = uid && (owningPage(uid)?.uid || uid);
    if (ticket !== generation || disposed) return;
    books = loadedBooks;
    if (book === ALL) scope = ALL; else if (book || followLocation) scope = null;
    if (scope !== ALL && followLocation) {
      const parents = uid ? api().data.pull("[{:block/parents [:block/uid]}]", [":block/uid", uid])?.[":block/parents"] || [] : [];
      const path = new Set([uid, ...parents.map(parent => parent[":block/uid"] || parent.uid)]);
      const onPage = item => item.pageUid === page || item.catalog?.rootUids.some(root => owningPage(root)?.uid === page);
      book = books.find(item => item.catalog?.rootUids.some(root => path.has(root)))
        || books.find(item => selectedBook && bookKey(item) === bookKey(selectedBook) && onPage(item))
        || books.find(onPage);
    }
    if (scope === ALL) book = null;
    if (book) book = books.find(item => bookKey(item) === bookKey(book)) || book;
    selectedBook = book || null;
    if (!book && scope !== ALL && !panel?.isConnected) { content = null; progress = null; return; }
    const priorKey = content?.key;
    if (!uid && !book && scope !== ALL) { content = null; progress = null; if (body?.isConnected) body.replaceChildren(el("p", t("Open a page or book, then click Refresh."))); return; }
    try {
      if (scope === ALL) {
        const sources = [];
        for (const item of books) { try { sources.push(readBookContent(item, { allowSuggested: false })); } catch { /* unconfirmed or moved books are listed in the menu only */ } }
        for (const pinned of pinnedPages()) { try { if (api().data.pull("[:block/uid]", [":block/uid", pinned.uid])) sources.push(contentForPage(pinned.uid)); } catch { /* removed page */ } }
        content = aggregateContent(sources);
      } else content = book ? readBookContent(book) : contentForPage(uid);
    }
    catch (error) {
      content = null; progress = null;
      scopeFooter?.remove(); scopeFooter = null;
      if (body?.isConnected) { body.replaceChildren(el("p", error.message)); if (book) body.append(button(t("Link Current Page to This Book"), relink)); }
      return;
    }
    const tags = [...new Set(['question', preference('reader-quick-question-tag','question'), ...String(preference("reader-question-tags", "question")).split(/[,，]/).map(tag => tag.trim()).filter(Boolean)])];
    annotations = collectAnnotations(content, undefined, tags);
    progress = !content.ordinaryPage && content.catalog.confirmed ? new ReadingProgress(content).load() : null;
    selected = priorKey === content.key ? new Set([...selected].filter(id => annotations.some(item => item.id === id))) : new Set();
    if (selector?.isConnected) {
      selector.replaceChildren(); const pageOption = el("option", t("Current Page")); pageOption.value = ""; selector.append(pageOption);
      const all = el("option", t("All Books")); all.value = ALL; selector.append(all);
      const group = el("optgroup"); group.label = t("Books");
      books.forEach(item => { const option = el("option", item.title); option.value = bookKey(item); group.append(option); });
      if (books.length) selector.append(group);
      const pins = pinnedPages();
      if (pins.length) { const pages = el("optgroup"); pages.label = t("Included pages"); pins.forEach(item => { const option = el("option", item.title); option.value = `page:${item.uid}`; pages.append(option); }); selector.append(pages); }
      selector.value = scope === ALL ? ALL : book ? bookKey(book) : pins.some(item => item.uid === page) ? `page:${page}` : "";
    }
    if (status?.isConnected) status.textContent = content.aggregate ? t("All Books · {0} sources · {1} annotations", [content.sources.length, annotations.length]) : content.ordinaryPage ? t("Page · {0} headings · {1} annotations · progress is tracked for books only", [content.chapters.length, annotations.length]) : t("{0} · {1} blocks · {2} annotations · {3} pages", [content.record.title, content.nodes.length, annotations.length, content.pages.size]);
    draw(); track(); locate();
  }
  async function open(book, requestedTab = "Contents") {
    clearTimeout(refreshTimer);
    tab = requestedTab === "Recap" ? "Contents" : requestedTab;
    if (!panel?.isConnected) {
      host = el("div"); host.id = "reading-desk-panel";
      for (const [key, val] of Object.entries({ all:"initial", position:"fixed", top:"54px", right:"12px", width:"min(410px, calc(100vw - 24px))", display:"block", "z-index":"2000" })) host.style.setProperty(key, val, "important");
      shadow = host.attachShadow({ mode:"open" }); shadow.append(el("style", PANEL_CSS));
      panel = el("section", null, "rei-reader"); panel.setAttribute("aria-label", t("Reading Desk")); panel.setAttribute("role", "dialog");
      shadow.addEventListener("pointerdown", () => clearTimeout(refreshTimer)); shadow.addEventListener("focusin", () => clearTimeout(refreshTimer));
      const header = el("header"); header.append(el("strong", t("Reading Desk")), button(t("Close"), close));
      header.title = t("Drag to move Reading Desk");
      header.onpointerdown = event => {
        if (event.button !== 0 || event.target.closest('button,input,select,a')) return;
        const rect = host.getBoundingClientRect(); drag = { id:event.pointerId, x:event.clientX, y:event.clientY, left:rect.left, top:rect.top };
        header.setPointerCapture?.(event.pointerId); event.preventDefault();
      };
      header.onpointermove = event => { if (drag?.id === event.pointerId) placePanel(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y); };
      const endDrag = () => { drag = null; }; header.onpointerup = endDrag; header.onpointercancel = endDrag; header.onlostpointercapture = endDrag;
      selector = el("select"); selector.setAttribute("aria-label", t("Reading scope")); selector.onchange = run(async () => {
        const value = selector.value;
        if (value === ALL) { await refresh(ALL); return; }
        if (value.startsWith("page:")) { scope = null; await api().ui.mainWindow.openPage({ page: { uid: value.slice(5) } }); await refresh(null, { followLocation: true }); return; }
        const book = books.find(item => bookKey(item) === value);
        // Switching books also brings the page to that book.
        scope = null; await refresh(book || null);
        if (book) await openBookPage(book);
      });
      links = el("div", null, "rei-reader-links"); links.hidden = true;
      const toolbar = el("div", null, "rei-reader-toolbar"); toolbar.append(selector, button(t("Refresh"), () => refresh(scope === ALL ? ALL : selectedBook)), links);
      const tabs = el("nav"); tabs.setAttribute("role", "tablist");
      for (const name of ["Contents", "Annotations", "Questions", "Notes", "Settings"]) { const item = button(t(name), () => { tab = name; draw(); }); item.dataset.readerTab = name; item.setAttribute("role", "tab"); item.title = t(name); tabs.append(item); }
      status = el("div", t("Loading…"), "rei-reader-status"); status.setAttribute("aria-live", "polite");
      body = el("div", null, "rei-reader-body"); body.setAttribute("role", "tabpanel"); panel.append(header, toolbar, tabs, status, body); shadow.append(panel); (document.querySelector(".roam-app") || document.body).append(host);
      resize();
      document.getElementById("reading-desk-topbar-button")?.setAttribute("aria-expanded", "true");
      panel.onkeydown = event => { if (event.key === "Escape") { event.stopPropagation(); close(); } };
    }
    await refresh(book || (scope === ALL ? ALL : null), { followLocation: !book && scope !== ALL });
  }
  // Switch the interface language and rebuild the open panel in it.
  async function relanguage(value) {
    setLanguage(value ?? preference("reader-language", "Auto"));
    window.dispatchEvent(new window.Event("reading-desk-comments-refresh"));
    window.dispatchEvent(new window.Event("reading-desk-language"));
    if (!panel?.isConnected) return;
    const keepTab = tab, position = panelPosition; close(); await open(null, keepTab);
    if (position) placePanel(position.x, position.y);
  }
  function close() { clearTimeout(refreshTimer); links = null; stopLocator(); stopLocator = () => {}; updateCatalogCurrent = () => {}; drag = null; host?.remove(); host = null; panel = null; document.getElementById("reading-desk-topbar-button")?.setAttribute("aria-expanded", "false"); }
  const route = () => {
    // All Books stays put while the reader follows annotations across pages.
    clearTimeout(routeTimer); routeTimer = setTimeout(() => { if (scope === ALL) { renderLinks(); return; } refresh(null, { followLocation: true }).catch(report); }, 400);
  };
  const focusout = event => {
    if (!panel?.isConnected || event.composedPath().includes(host) || !event.target.matches?.('textarea.rm-block-input,[contenteditable="true"]')) return;
    clearTimeout(refreshTimer); refreshTimer = setTimeout(() => {
      if (document.activeElement === host) { if (status?.isConnected) status.textContent = t("Text or comments changed. Click Refresh to update without interrupting your work."); return; }
      refresh(scope === ALL ? ALL : selectedBook).catch(report);
    }, 1400);
  };
  window.addEventListener("hashchange", route); window.addEventListener('resize',resize); document.addEventListener("focusout", focusout);
  document.addEventListener('focusin',rememberActionTarget); rememberActionTarget();
  refresh(null, { followLocation: true }).catch(report);
  return {
    open, close, relanguage, openNotes: (sidebar = false) => openNotes(sidebar), setActions(value) { actions = value; if (panel?.isConnected && tab === 'Settings') draw(); }, async continueReading() { scope = null; await open(null,'Contents'); const last = progress?.latest(); if (last) await navigate(last[1].lastBlockUid); }, get isOpen() { return Boolean(panel?.isConnected); }, get root() { return shadow; }, refresh: () => refresh(scope === ALL ? ALL : selectedBook), preference,
    cleanup() {
      disposed = true; generation++; stopTracker(); progress?.flush().catch(report); clearTimeout(routeTimer); clearTimeout(refreshTimer);
      window.removeEventListener("hashchange", route); window.removeEventListener('resize',resize); document.removeEventListener("focusout", focusout); document.removeEventListener('focusin',rememberActionTarget); close();
    }
  };
}
