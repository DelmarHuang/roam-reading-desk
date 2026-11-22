import { configureMetadataPages } from "./metadata-page.js";
import { cancelImports, enableImports } from "./roam.js";
import { openBookRecovery, openImporter, openManager, setReaderController, unloadUi } from "./ui.js";
import { installReader } from "./reader.js";
import { installMark, MARK_COMMAND, QUESTION_COMMAND } from "./mark.js";
import { installCommentRail } from "./comments.js";
import { installToolbar } from "./toolbar.js";
import { applyAppearance, HIGHLIGHT_COLOURS, removeAppearance } from "./appearance.js";
import { displayCombo, installShortcuts } from "./shortcuts.js";
import { languageName, LANGUAGES, setLanguage, t } from "./i18n.js";

const IMPORT_COMMAND = "Reading Desk: Import EPUB";
const MANAGE_COMMAND = "Reading Desk: Manage Imported Books";
const RECOVER_COMMAND = "Reading Desk: Recover Existing Book";
let cleanup = () => {};

export default {
  async onload({ extensionAPI }) {
    cleanup();
    await configureMetadataPages(extensionAPI);
    enableImports();
    for (const [key, value] of [["reader-auto-progress", true], ["reader-comment-rail", true], ["reader-question-tags", "question"]]) {
      if (extensionAPI.settings.get(key) == null) { try { await extensionAPI.settings.set(key, value); } catch { /* session defaults still work */ } }
    }
    // 0.4.8: the default question tag list is just "question". Only the old
    // untouched default is migrated; customised lists are kept.
    if (extensionAPI.settings.get("reader-question-tags") === "question,疑问,问题") { try { await extensionAPI.settings.set("reader-question-tags", "question"); } catch { /* keep old */ } }
    const reader = installReader(extensionAPI);
    // 0.7.0 stored a language code; Roam's settings select needs the name.
    const storedLanguage = extensionAPI.settings.get("reader-language");
    if (storedLanguage != null && storedLanguage !== languageName(storedLanguage)) { try { await extensionAPI.settings.set("reader-language", languageName(storedLanguage)); } catch { /* the code still works */ } }
    setLanguage(reader.preference("reader-language", "Auto"));
    applyAppearance(reader.preference);
    const toolbar = installToolbar(() => reader.isOpen ? reader.close() : reader.open());
    const comments = installCommentRail({ enabled: () => reader.preference("reader-comment-rail", true), order: () => reader.preference("reader-note-order", "oldest") });
    const mark = installMark(() => { reader.refresh().catch(console.warn); comments.refresh(); }, {getQuestionTag:() => reader.preference('reader-quick-question-tag','question'), getQuestionStyle:() => reader.preference('reader-question-style','tag'), shortcutLabel:() => shortcutLabel('mark')});
    let shortcuts;
    const shortcutLabel = id => { const combo = shortcuts?.comboFor(id); return combo ? displayCombo(combo) : ""; };
    shortcuts = installShortcuts({ get: key => reader.preference(key, null), handlers: {
      mark: () => mark.toggle(),
      question: () => mark.toggleQuestion(),
      panel: () => reader.isOpen ? reader.close() : reader.open(),
      continue: () => reader.continueReading(),
      notes: () => reader.openNotes()
    } });
    reader.setActions({ importEpub:() => openImporter(extensionAPI), manageBooks:() => openManager(extensionAPI), recoverBook:() => openBookRecovery(extensionAPI), toggleMark:uid => mark.toggle(uid), toggleQuestion:uid => mark.toggleQuestion(uid), shortcuts });
    setReaderController(reader);
    const commands = [
      { label: "Reading Desk: Open Reading Panel", callback: () => reader.open() },
      { label: "Reading Desk: Browse Annotations", callback: () => reader.open(null, "Annotations") },
      { label: "Reading Desk: Continue Reading", callback: () => reader.continueReading() },
      { label: "Reading Desk: Preview Book Link Repairs", callback: () => reader.open(null, "Repair") },
      // Shortcuts are Reading Desk's own (Settings → Keyboard Shortcuts), so no
      // default Roam hotkeys: a second binding toggled twice or typed "µ".
      { label: MARK_COMMAND, callback: () => mark.toggle().catch(console.warn) },
      { label: QUESTION_COMMAND, callback: () => mark.toggleQuestion().catch(error => window.alert(error.message)) },
      { label: "Reading Desk: Open Reading Notes", callback: () => reader.openNotes().catch(error => window.alert(error.message)) }
    ];
    cleanup = () => {
      cancelImports();
      toolbar.cleanup(); reader.cleanup(); mark.cleanup(); comments.cleanup(); shortcuts.cleanup(); setReaderController(null); removeAppearance();
      for (const label of [...commands.map(command => command.label), IMPORT_COMMAND, MANAGE_COMMAND, RECOVER_COMMAND]) Promise.resolve(extensionAPI.ui.commandPalette.removeCommand?.({ label })).catch(console.warn);
    };
    for (const command of commands) await extensionAPI.ui.commandPalette.addCommand(command);
    await extensionAPI.ui.commandPalette.addCommand({ label: IMPORT_COMMAND, callback: () => openImporter(extensionAPI) });
    await extensionAPI.ui.commandPalette.addCommand({ label: MANAGE_COMMAND, callback: () => openManager(extensionAPI) });
    await extensionAPI.ui.commandPalette.addCommand({ label: RECOVER_COMMAND, callback: () => openBookRecovery(extensionAPI) });
    // Roam's settings tab is rebuilt whenever the language changes, so it
    // switches together with the panel.
    const panelConfig = () => ({
      tabTitle: "Reading Desk",
      settings: [
        { id: "reader-language", name: t("Language"), description: t("Interface language for Reading Desk (Auto follows your browser)."), action: { type: "select", items: LANGUAGES.map(([value]) => value), onChange: value => setTimeout(() => reader.relanguage(typeof value === "string" ? value : undefined), 0) } },
        { id: "open-importer", name: t("Import EPUB"), description: t("Choose, preview, and import an EPUB book"), action: { type: "button", content: t("Open Importer"), onClick: () => openImporter(extensionAPI) } },
        { id: "manage-books", name: t("Manage Imported Books"), description: t("Manage imported books, recover existing pages, and safely clean up attachments"), action: { type: "button", content: t("Manage Books"), onClick: () => openManager(extensionAPI) } },
        { id: "open-reading-desk", name: t("Reading Desk"), description: t("Open reading tools for books or ordinary pages"), action: { type: "button", content: t("Open Reading Desk"), onClick: () => reader.open() } },
        { id: "reader-auto-progress", name: t("Automatic Browsing Progress"), description: t("Estimate foreground browsing per chapter; never infer comprehension"), action: { type: "switch", onChange: () => reader.refresh().catch(console.warn) } },
        { id: "reader-comment-rail", name: t("Native Comment Side Notes"), description: t("Show native comments in full beside the text throughout the graph"), action: { type: "switch", onChange: () => comments.refresh() } },
        { id: "reader-highlight-colour", name: t("Highlight Colour"), description: t("Colour for native ^^highlights^^ (Theme default keeps your theme's colour)"), action: { type: "select", items: HIGHLIGHT_COLOURS.map(([value]) => value), onChange: () => setTimeout(() => applyAppearance(reader.preference), 0) } },
        { id: "reader-question-tags", name: t("Question Tags"), description: t("Comma-separated existing tags used for unresolved questions. The Toggle Question shortcut adds #question."), action: { type: "input", placeholder: "question", onChange: () => reader.refresh().catch(console.warn) } }
      ]
    });
    const relabel = () => {
      Promise.resolve(extensionAPI.settings.panel.create(panelConfig())).catch(console.warn);
      const button = document.getElementById("reading-desk-topbar-button");
      if (button) { button.title = t("Reading Desk"); button.setAttribute("aria-label", t("Reading Desk")); }
    };
    window.addEventListener("reading-desk-language", relabel);
    const stopRelabel = cleanup; cleanup = () => { window.removeEventListener("reading-desk-language", relabel); stopRelabel(); };
    await extensionAPI.settings.panel.create(panelConfig());
  },
  onunload() {
    cleanup(); cleanup = () => {};
    unloadUi();
  }
};
