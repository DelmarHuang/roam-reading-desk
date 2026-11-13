import { parseEpub } from "./epub.js";
import { getJob, listJobs, removeJob, saveJob } from "./storage.js";
import { createImportJob, deleteManagedBook, getManagedBooks, prepareBookDeletion, prepareImageRemoval, removeBookImages, runImport } from "./roam.js";
import { renderFormulaMathML } from "./math.js";
import { findRecoveryPages, recoverExistingBook } from "./library.js";
import { t } from "./i18n.js";

let activeModal = null;
let readerController = null;
export function setReaderController(controller) { readerController = controller; }

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(text, className = "") {
  const node = element("button", `rei-button ${className}`.trim(), text);
  node.type = "button";
  return node;
}

function closeModal() {
  activeModal?.remove();
  activeModal = null;
}

function modal(title) {
  closeModal();
  const backdrop = element("div", "rei-backdrop");
  const panel = element("section", "rei-modal");
  const header = element("header", "rei-header");
  header.append(element("h2", "", title));
  const close = button("×", "rei-close");
  close.setAttribute("aria-label", t("Close"));
  close.onclick = closeModal;
  header.append(close);
  const body = element("div", "rei-body");
  panel.append(header, body);
  backdrop.append(panel);
  backdrop.onclick = event => { if (event.target === backdrop) closeModal(); };
  document.body.append(backdrop);
  activeModal = backdrop;
  return body;
}

function notice(body, text, type = "") {
  const node = element("div", `rei-notice ${type}`.trim(), text);
  body.append(node);
  return node;
}

function progressView(body) {
  const wrap = element("div", "rei-progress-wrap");
  const label = element("div", "rei-progress-label", t("Preparing…"));
  const progress = element("progress", "rei-progress");
  progress.max = 1;
  progress.value = 0;
  wrap.append(label, progress);
  body.append(wrap);
  return update => {
    label.textContent = update.message || t("Processing…");
    progress.max = Math.max(1, update.total || 1);
    progress.value = Math.max(0, update.current || 0);
  };
}

function statsText(book) {
  const { chapters, blocks, images, links } = book.stats;
  return t("{0} TOC entries · {1} top-level nodes · approx. {2} blocks · {3} images · {4} internal links", [book.stats.tocEntries || 0, chapters, blocks, images, links]) + (book.stats.formulas ? t(" · {0} formulas", [book.stats.formulas]) : "");
}

function directoryList(items) {
  const list = element("ul", "rei-directory");
  items.forEach(item => {
    const row = element("li", "");
    row.append(element("span", "", item.text));
    if (item.children?.length) row.append(directoryList(item.children));
    list.append(row);
  });
  return list;
}

async function startJob(job, extensionAPI, body) {
  body.replaceChildren();
  body.append(element("h3", "", job.progress.pageTitle ? t("Resume importing {0}", [job.progress.pageTitle]) : t("Import {0}", [job.requestedTitle])));
  const update = progressView(body);
  const details = notice(body, t("Keep Roam open during import. Progress is saved so interrupted imports can resume."), "rei-muted");
  try {
    const record = await runImport(job, extensionAPI, update);
    details.textContent = t("Created {0}. Images and links are in their original positions.", [record.title]);
    details.className = "rei-notice rei-success";
    const done = button(t("Close"));
    done.onclick = closeModal;
    body.append(done);
  } catch (error) {
    details.textContent = t("Import paused: {0}. Progress was saved; you can resume later.", [error?.message || error]);
    details.className = "rei-notice rei-error";
    const retry = button(t("Retry / Resume"), "rei-primary");
    retry.onclick = async () => startJob(await getJob(job.id), extensionAPI, body);
    body.append(retry);
  }
}

function renderPreview(body, book, extensionAPI) {
  body.replaceChildren();
  const card = element("div", "rei-preview");
  card.append(element("div", "rei-kicker", t("Book Preview")));
  card.append(element("h3", "", book.title));
  if (book.author) card.append(element("p", "rei-muted", t("Author: {0}", [book.author])));
  card.append(element("p", "", statsText(book)));
  body.append(card);

  const label = element("label", "rei-field");
  label.append(element("span", "", t("Roam page title")));
  const titleInput = element("input", "rei-input");
  titleInput.value = book.title;
  label.append(titleInput);
  body.append(label);

  const toc = element("details", "rei-toc");
  toc.open = true;
  toc.append(element("summary", "", book.toc?.length ? t("Original EPUB TOC ({0}, full hierarchy)", [book.tocSource === "ncx" ? "NCX" : "NAV"]) : t("Outline generated from body headings")));
  toc.append(directoryList(book.toc?.length ? book.toc : book.chapters));
  body.append(toc);
  (book.warnings || []).forEach(warning => notice(body, warning, "rei-error"));
  if (book.formulas?.length) {
    const math = element("details", "rei-toc");
    math.append(element("summary", "", t("Formulas: {0} converted{1}", [book.stats.formulasConverted, book.stats.formulasReview ? t("; {0} need review (source retained)", [book.stats.formulasReview]) : ""])));
    math.addEventListener("toggle", () => {
      if (!math.open || math.querySelector(".rei-math-examples")) return;
      const examples = element("div", "rei-math-examples");
      book.formulas.forEach((formula, index) => {
        const row = element("div", "rei-math-example");
        row.append(element("div", "rei-muted", t("Formula {0} · {1}", [index + 1, formula.sourcePath])));
        if (formula.status === "converted") {
          const rendered = new DOMParser().parseFromString(renderFormulaMathML(formula), "text/html").querySelector("math");
          if (rendered) row.append(document.importNode(rendered, true));
        } else row.append(element("pre", "rei-math-source", formula.source));
        examples.append(row);
      });
      math.append(examples);
    });
    body.append(math);
  }

  const preview = element("details", "rei-toc");
  preview.append(element("summary", "", t("Preview text and image order")));
  const images = new Map(book.assets.map(asset => [asset.id, asset]));
  function previewNodes(nodes) {
    const list = element("ul", "rei-directory");
    nodes.forEach(node => {
      const row = element("li", "");
      row.append(element("span", "", node.text.replace(/⟦EPUBI:(i\d+)⟧/g, (_, id) => `[Image: ${images.get(id)?.path || id}]`).replace(/⟦EPUBL:(l\d+)⟧/g, (_, id) => book.links.find(link => link.id === id)?.label || "Internal link")));
      if (node.children?.length) row.append(previewNodes(node.children));
      list.append(row);
    });
    return list;
  }
  // Render the full book on demand, rather than hiding later chapters behind
  // a fixed preview limit or blocking file selection on thousands of nodes.
  preview.addEventListener("toggle", () => {
    if (preview.open && !preview.querySelector("ul")) preview.append(previewNodes(book.chapters));
  });
  body.append(preview);

  notice(body, t("Images are uploaded into their original positions. External links are preserved; internal links become Roam block references."), "rei-muted");
  const start = button(t("Start Import"), "rei-primary");
  start.onclick = async () => {
    if (!titleInput.value.trim()) return titleInput.focus();
    start.disabled = true;
    const job = createImportJob(book, titleInput.value);
    await saveJob(job);
    await startJob(job, extensionAPI, body);
  };
  body.append(start);
}

function resumeSection(body, jobs, extensionAPI) {
  if (!jobs.length) return;
  const section = element("section", "rei-section");
  section.append(element("h3", "", t("Unfinished Imports")));
  jobs.forEach(job => {
    const row = element("div", "rei-row");
    const info = element("div", "rei-grow");
    info.append(element("strong", "", job.progress.pageTitle || job.requestedTitle));
    const chapter = `${job.progress.chapterIndex || 0}/${job.book?.chapters?.length || 0} chapters`;
    info.append(element("div", "rei-muted", `${chapter}${job.error ? ` · Last error: ${job.error}` : ""}`));
    const resume = button(t("Resume"));
    if (![3, 4].includes(job.book?.parserVersion)) {
      resume.disabled = true;
      info.append(element("div", "rei-error", t("This job uses an outdated parser. Select the EPUB again to create a corrected import.")));
    } else if (job.book.parserVersion === 3) {
      info.append(element("div", "rei-muted", t("This legacy job did not check formulas. Select the EPUB again if the book contains formulas.")));
    }
    resume.onclick = () => startJob(job, extensionAPI, body);
    const discard = button(t("Discard Job"), "rei-danger-link");
    discard.onclick = async () => {
      if (job.progress.pageUid) return notice(body, t("A Roam page already exists. Use Manage Imported Books to remove this import."), "rei-error");
      await removeJob(job.id);
      row.remove();
    };
    row.append(info, resume, discard);
    section.append(row);
  });
  body.append(section);
}

export async function openImporter(extensionAPI) {
  const body = modal(t("EPUB Importer"));
  body.append(element("p", "", t("Choose an EPUB. Parsing stays on your device; book images are uploaded to the current Roam graph only after you confirm the import.")));
  const picker = element("input", "rei-file");
  picker.type = "file";
  picker.accept = ".epub,application/epub+zip";
  body.append(picker);
  const status = notice(body, t("No file selected."), "rei-muted");
  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file) return;
    status.textContent = t("Reading contents, text, images, and links…");
    picker.disabled = true;
    try {
      const book = await parseEpub(await file.arrayBuffer(), file.name);
      renderPreview(body, book, extensionAPI);
    } catch (error) {
      status.textContent = t("Cannot read file: {0}", [error?.message || error]);
      status.className = "rei-notice rei-error";
      picker.disabled = false;
    }
  };
  try { resumeSection(body, await listJobs(), extensionAPI); }
  catch (error) { notice(body, t("Cannot read saved jobs: {0}", [error?.message || error]), "rei-error"); }
}

function attachmentSummary(plan) {
  const safe = plan.attachments.filter(item => item.safe).length;
  const preserved = plan.attachments.length - safe;
  return t("This deletes {0} chapter roots, {1} blocks in scope, and {2} exclusive attachments. Pages and native comments are retained.", [plan.rootUids.length, plan.blockCount, safe]) + (preserved ? t(" {0} shared or unverified attachments will be retained.", [preserved]) : "");
}

async function confirmImageRemoval(body, record, extensionAPI) {
  body.replaceChildren();
  body.append(element("h3", "", t("Remove images · {0}", [record.title])));
  const status = notice(body, t("Finding images and checking where their files are used…"), "rei-muted");
  let plan;
  try { plan = await prepareImageRemoval(record, extensionAPI); }
  catch (error) { status.textContent = t("Check failed: {0}", [error?.message || error]); status.className = "rei-notice rei-error"; const back = button(t("Back to Book List")); back.onclick = () => openManager(extensionAPI); body.append(back); return; }
  const safe = plan.files.filter(item => item.safe).length, retained = plan.files.length - safe;
  const emptied = plan.blocks.filter(block => block.remove).length;
  if (!plan.blocks.length && !safe) { status.textContent = t("This book has no images left in its text."); const back = button(t("Back to Book List")); back.onclick = () => openManager(extensionAPI); body.append(back); return; }
  status.textContent = t("{0} blocks contain images. Image embeds are removed from them ({1} image-only blocks are deleted; blocks with text, children or references are kept). The book, its text, headings, comments and highlights stay.", [plan.blocks.length, emptied]);
  const files = element("label", "rei-field");
  const check = element("input"); check.type = "checkbox"; check.checked = true;
  files.append(check, element("span", "", t(" Also delete {0} uploaded image files used only by this book{1}.", [safe, retained ? t(" ({0} shared, outside-referenced or unverified files are kept)", [retained]) : ""])));
  body.append(files);
  const preview = element("details"); preview.append(element("summary", "", t("Preview the first changes")));
  plan.blocks.slice(0, 20).forEach(block => preview.append(element("pre", "", `${block.uid}\n${block.before.slice(0, 200)}\n→ ${block.remove ? "(block deleted)" : block.after.slice(0, 200) || "(empty)"}`)));
  body.append(preview);
  notice(body, t("This cannot be undone: deleted image files are gone from Roam storage."), "rei-error");
  const actions = element("div", "rei-actions");
  const cancel = button(t("Cancel")); cancel.onclick = () => openManager(extensionAPI);
  const go = button(t("Remove Images"), "rei-danger");
  go.onclick = async () => {
    if (!window.confirm(t("Remove images from {0}? The book itself is kept.", [record.title]))) return;
    go.disabled = true; cancel.disabled = true;
    try {
      const result = await removeBookImages(plan, extensionAPI, { deleteFiles: check.checked, onProgress: text => { status.textContent = text; } });
      body.replaceChildren();
      notice(body, t("Removed images from {0} blocks ({1} image-only blocks deleted) and deleted {2} files.{3}{4}", [result.updated + result.deleted, result.deleted, result.filesDeleted, result.skipped ? t(" {0} blocks changed since the preview and were skipped.", [result.skipped]) : "", result.failures.length ? t(" {0} files could not be deleted and remain listed.", [result.failures.length]) : ""]), result.failures.length ? "rei-error" : "rei-muted");
      const done = button(t("Back to Book List")); done.onclick = () => openManager(extensionAPI); body.append(done);
    } catch (error) { status.textContent = t("Image removal failed: {0}", [error?.message || error]); status.className = "rei-notice rei-error"; go.disabled = false; cancel.disabled = false; }
  };
  actions.append(cancel, go); body.append(actions);
}

async function confirmDeletion(body, record, extensionAPI) {
  body.replaceChildren();
  body.append(element("h3", "", t("Delete {0}", [record.title])));
  const status = notice(body, t("Checking attachment references in other pages and books…"), "rei-muted");
  let plan;
  try {
    plan = await prepareBookDeletion(record, extensionAPI);
  } catch (error) {
    status.textContent = t("Check failed: {0}", [error?.message || error]);
    status.className = "rei-notice rei-error";
    if (readerController) body.append(buttonWithReader(record));
    return;
  }
  status.textContent = attachmentSummary(plan);
  if (plan.pages.length) notice(body, t("Affected pages: {0}. Only confirmed book chapters will be deleted; these pages will remain.", [plan.pages.join("; ")]), "rei-muted");
  if (plan.externalBlockReferences) notice(body, t("{0} blocks outside the book reference its content (possibly including native comments). Their references may break after deletion; comments and independent notes will remain.", [plan.externalBlockReferences]), "rei-error");
  if (plan.scanFailed) {
    notice(body, t("Reference checking failed. Attachments will be retained."), "rei-error");
  }
  if (record.status === "recovered") notice(body, t("This recovered book has no original upload ledger. Chapters can be deleted, but detected images will be retained."), "rei-muted");
  const label = element("label", "rei-field");
  label.append(element("span", "", t("Type the full book title to confirm: {0}", [record.title])));
  const input = element("input", "rei-input");
  label.append(input);
  body.append(label);
  const actions = element("div", "rei-actions");
  const cancel = button(t("Cancel"));
  cancel.onclick = () => openManager(extensionAPI);
  const remove = button(t("Delete Permanently"), "rei-danger");
  remove.disabled = true;
  input.oninput = () => { remove.disabled = input.value !== record.title; };
  remove.onclick = async () => {
    remove.disabled = true;
    input.disabled = true;
    try {
      const result = await deleteManagedBook(plan, extensionAPI, text => { status.textContent = text; });
      body.replaceChildren();
      notice(body, t("Deleted book chapters and {0} exclusive attachments. Pages and native comments remain. Retained {1} shared or unverified attachments.{2}", [result.deletedAttachments, result.preservedAttachments, result.failures.length ? t(" {0} failed deletions are saved for retry.", [result.failures.length]) : ""]), result.failures.length ? "rei-error" : "rei-success");
      const done = button(t("Back to Book List"));
      done.onclick = () => openManager(extensionAPI);
      body.append(done);
    } catch (error) {
      status.textContent = t("Deletion failed: {0}", [error?.message || error]);
      status.className = "rei-notice rei-error";
      input.disabled = false;
      remove.disabled = input.value !== record.title;
    }
  };
  actions.append(cancel, remove);
  body.append(actions);
}

export function openBookRecovery(extensionAPI) {
  const body = modal(t("Recover Existing Book"));
  notice(body, t("Enter all or part of the original book page title. Recovery registers the existing book without reimporting, editing text, or uploading images. Attachments without an original upload ledger are marked unverified and retained during deletion."), "rei-muted");
  const input = element("input", "rei-input");
  input.placeholder = t("Page title or book keywords");
  input.setAttribute("aria-label", t("Find an existing book page"));
  const search = button(t("Find Pages"), "rei-primary");
  const results = element("div", "");
  search.onclick = () => {
    results.replaceChildren();
    try {
      const pages = findRecoveryPages(input.value);
      if (!pages.length) notice(results, t("No matching pages. Try a shorter book title."), "rei-muted");
      pages.forEach(page => {
        const row = element("div", "rei-book");
        row.append(element("strong", "rei-grow", page.title));
        const recover = button(t("Register This Book"));
        recover.onclick = async () => {
          recover.disabled = true;
          try {
            await recoverExistingBook(page.pageUid, extensionAPI);
            await openManager(extensionAPI);
          } catch (error) {
            notice(results, t("Recovery failed: {0}", [error?.message || error]), "rei-error");
            recover.disabled = false;
          }
        };
        row.append(recover);
        results.append(row);
      });
    } catch (error) { notice(results, error?.message || String(error), "rei-error"); }
  };
  input.onkeydown = event => { if (event.key === "Enter") search.click(); };
  body.append(input, search, results);
}

export async function openManager(extensionAPI) {
  const body = modal(t("Manage Imported Books"));
  const recovery = button(t("Recover Existing Book"));
  recovery.onclick = () => openBookRecovery(extensionAPI);
  body.append(recovery);
  const status = notice(body, t("Reading the graph's book library…"), "rei-muted");
  let books;
  try { books = await getManagedBooks(extensionAPI); }
  catch (error) {
    status.textContent = t("Cannot read the library: {0}. Existing books are unchanged.", [error?.message || error]);
    status.className = "rei-notice rei-error";
    return;
  }
  if (!body.isConnected) return;
  status.remove();
  if (!books.length) {
    body.append(element("p", "rei-muted", t("The library is empty. Use Recover Existing Book for books missing after an update; no reimport is needed.")));
    return;
  }
  books.sort((a, b) => (b.importedAt || "").localeCompare(a.importedAt || "")).forEach(record => {
    const row = element("div", "rei-book");
    const info = element("div", "rei-grow");
    info.append(element("strong", "", record.title));
    info.append(element("div", "rei-muted", t("{0} · {1} attachments{2}", [record.author || t("Unknown author"), record.attachments?.length || 0, record.status === "cleanup-needed" ? t(" · Cleanup pending") : record.status === "recovered" ? t(" · Recovered (original attachments retained)") : ""])));
    const remove = button(record.status === "cleanup-needed" ? t("Clean Up Attachments") : t("Delete Book"), "rei-danger-link");
    remove.onclick = () => confirmDeletion(body, record, extensionAPI);
    row.append(info);
    if (record.status !== "cleanup-needed") { const images = button(t("Remove Images"), "rei-danger-link"); images.title = t("Delete this book's images but keep the book"); images.onclick = () => confirmImageRemoval(body, record, extensionAPI); row.append(images); }
    row.append(remove);
    if (readerController && record.status !== "cleanup-needed") row.append(buttonWithReader(record));
    body.append(row);
  });
}

function buttonWithReader(record) {
  const read = button(t("Open Reader"), "rei-primary");
  read.onclick = () => { closeModal(); readerController?.open(record); };
  return read;
}

export function unloadUi() {
  closeModal();
}
