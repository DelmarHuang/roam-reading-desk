> **0.7.17:** Repair checkboxes now sit beside their wrapping labels. Drag the panel’s bottom-right corner to resize, or focus the corner and use arrow keys. Dimensions are retained while the extension remains loaded. The extracted folder is always `reading-desk`.

> **0.7.5 safety update:** Repair applies the previewed plan only; new/changed content requires a new preview. Delete Book is blocked by external references. Disabling the extension pauses imports. Folio compatibility is handled by Folio 1.4.26 or later.
>
> Metadata pages are read directly. Their UIDs are remembered on first load. If these pages were renamed *before* this upgrade and no UID has been recorded, restore the original names `roam/epub-importer/library` and `roam/epub-importer/reader` before loading; they may be renamed again afterwards. No full-graph discovery runs during progress saves.

<a id="top"></a>

# Reading Desk

Navigate long Roam pages with a table of contents, then annotate and revisit what matters. · 用目录读懂长页面，用批注与回顾留下思考。

[English](#en) · [中文](#zh) · [Italiano](#it) · [Deutsch](#de) · [Français](#fr) · [Español](#es)

| Section · 章节 | English | 中文 | Italiano | Deutsch | Français | Español |
| --- | --- | --- | --- | --- | --- | --- |
| Overview · 概览 | [Overview](#en-overview) | [概览](#zh-overview) | [Panoramica](#it-overview) | [Überblick](#de-overview) | [Présentation](#fr-overview) | [Presentación](#es-overview) |
| Getting started · 快速上手 | [Getting started](#en-start) | [快速上手](#zh-start) | [Per iniziare](#it-start) | [Erste Schritte](#de-start) | [Prise en main](#fr-start) | [Primeros pasos](#es-start) |
| Features · 功能指南 | [Features](#en-features) | [功能指南](#zh-features) | [Funzionalità](#it-features) | [Funktionen](#de-features) | [Fonctionnalités](#fr-features) | [Funciones](#es-features) |
| Commands & shortcuts · 命令与快捷键 | [Commands & shortcuts](#en-shortcuts) | [命令与快捷键](#zh-shortcuts) | [Comandi e scorciatoie](#it-shortcuts) | [Befehle und Tastenkürzel](#de-shortcuts) | [Commandes et raccourcis](#fr-shortcuts) | [Comandos y atajos](#es-shortcuts) |
| Settings · 设置 | [Settings](#en-settings) | [设置](#zh-settings) | [Impostazioni](#it-settings) | [Einstellungen](#de-settings) | [Réglages](#fr-settings) | [Ajustes](#es-settings) |
| Data & usage · 数据与使用说明 | [Data & usage](#en-data) | [数据与使用说明](#zh-data) | [Dati e utilizzo](#it-data) | [Daten und Nutzung](#de-data) | [Données et utilisation](#fr-data) | [Datos y uso](#es-data) |
| Frequently asked questions · 常见问题 | [Frequently asked questions](#en-faq) | [常见问题](#zh-faq) | [Domande frequenti](#it-faq) | [Häufige Fragen](#de-faq) | [Questions fréquentes](#fr-faq) | [Preguntas frecuentes](#es-faq) |
| More plugins · 同系列插件 | [More plugins](#en-more) | [同系列插件](#zh-more) | [Altri plugin](#it-more) | [Weitere Plugins](#de-more) | [Autres plugins](#fr-more) | [Otros plugins](#es-more) |
| Credits · 致谢 | [Credits](#en-credits) | [致谢](#zh-credits) | [Ringraziamenti](#it-credits) | [Danksagung](#de-credits) | [Remerciements](#fr-credits) | [Agradecimientos](#es-credits) |

---

<a id="en"></a>

## English

<a id="en-overview"></a>

### Overview

Reading Desk gives your existing Roam pages a table of contents, making long notes easier to scan and navigate. See the structure formed by H1–H3 headings and jump straight to the section you need, then read, annotate and gather questions in the same workspace.

- See a page’s heading structure in one place and jump between sections.
- Keep comments, marks and highlights beside the text.
- Review annotations and questions in one panel.

<a id="en-start"></a>

### Getting started

1. Open **Settings → Roam Depot**, find **Reading Desk** and install it.
2. Open an existing Roam page. Click the book icon in the top bar or run **Reading Desk: Open Reading Panel**.
3. Use **Contents** to navigate, or mark a paragraph with **Alt+M** and add a question with **Alt+Q**. These tools are available without importing a book.

<a id="en-features"></a>

### Features

[Page contents & navigation](#en-contents) · [Reading panel](#en-panel) · [Margin notes from native comments](#en-margin-notes) · [Mark It & highlights](#en-marks) · [Questions](#en-questions) · [Reading notes](#en-reading-notes) · [EPUB import](#en-import) · [Book maintenance](#en-maintenance)

<a id="en-contents"></a>

#### Page contents & navigation

Make long pages easier to explore with a table of contents built from their existing **H1–H3 headings**.

- **For ordinary Roam pages:** use it with research notes, meeting records and long articles, without importing a book.
- **See the structure:** browse the heading hierarchy in the **Contents** tab instead of scrolling through the whole page.
- **Jump to a section:** click a heading to navigate to it; a collapsed heading opens.
- **For imported books too:** use the same contents panel to navigate chapters.

<a id="en-panel"></a>

#### Reading panel

- Five tabs: **Contents**, **Annotations**, **Questions**, **Notes** and **Settings**.
- Reading progress is estimated per chapter, and you can mark chapters as read yourself.
- **All Books** gathers annotations from every book and from pages you choose to include.

<a id="en-margin-notes"></a>

#### Margin notes from native comments

- Roam's own comments appear in full beside their paragraph, in the empty margin, the way Folio places margin notes. The text keeps its width.
- When the margin is too narrow, only the commented paragraph makes room for its note.
- Choose **Cards** or **Minimal**, a colour, and oldest or newest first. Each card shows its date.
- Click a note to line it up with its paragraph. **×** deletes the comment (and its empty thread block); **↗** opens the native thread.
- Comments written as block references show the referenced text. Video timestamp notes are never shown.

<a id="en-marks"></a>

#### Mark It & highlights

- **Mark It** (Alt+M) tags a paragraph with #mark. The tag stays in the text and is hidden while reading.
- Six mark styles: margin dot + bold (default), bookmark ribbon, gold highlighter, pull quote, sticky note, ink emphasis.
- Native ^^highlights^^ get a colour and style that stay readable on warm paper themes.

<a id="en-questions"></a>

#### Questions

- **Toggle Question** (Alt+Q) adds #question at the end of a block, or a `Question::` attribute at its start.
- The Questions tab collects #question tags, your own question tags, question attributes and native TODOs. DONE items are left out.

<a id="en-reading-notes"></a>

#### Reading notes

- In Annotations, tick items and create a notes draft: a page that references the original blocks and links back to the book.
- The draft's date links to its Daily Notes page. The new notes open in the right sidebar (or the main window).
- The **Notes** tab opens the notes page and lists every draft folded by day.

<a id="en-import"></a>

#### EPUB import

If you want to read a book in Roam, run **Reading Desk: Import EPUB**, choose an EPUB file and confirm the preview.

- Text, images, footnotes, internal links and formulas are imported in their original order.
- The book's table of contents becomes H1–H3 headings; a fourth level becomes bold text.
- The EPUB is parsed on your device. Images are uploaded to your graph only after you confirm the preview.
- Interrupted imports can be resumed.

<a id="en-maintenance"></a>

#### Book maintenance

- **Repair This Book** previews repairs to heading levels, footnote markers and numbered links. Repairs can be undone.
- **Remove Images** deletes a book’s images while keeping its text.
- **Delete Book** removes its chapters and files used only by that book; page containers and native comments remain.

<a id="en-shortcuts"></a>

### Commands & shortcuts

| Command | Default |
| --- | --- |
| Reading Desk: Open Reading Panel | customisable |
| Reading Desk: Browse Annotations | — |
| Reading Desk: Toggle Mark | Alt+M |
| Reading Desk: Toggle Question | Alt+Q |
| Reading Desk: Open Reading Notes | customisable |
| Reading Desk: Continue Reading | customisable |
| Reading Desk: Import EPUB | — |
| Reading Desk: Manage Imported Books | — |
| Reading Desk: Recover Existing Book | — |
| Reading Desk: Preview Book Link Repairs | — |

Command names remain in English. Configure shortcuts in **Reading Desk → Settings → Keyboard Shortcuts**. On macOS, use Option for Alt.

<a id="en-settings"></a>

### Settings

- **Language:** Auto (browser language), English, 中文, Italiano, Deutsch, Français, Español.
- **Reading:** collapse the previous chapter, automatic progress, text width (fill the line or keep the theme's line length).
- **Native comments:** margin notes on or off, style, colour, order.
- **Highlights and Mark It**, **Questions**, **Keyboard shortcuts**, where new reading notes open, and **Maintenance**.
- Language, import, book management, progress, margin notes, highlight colour and question tags are also in Roam's Settings → Reading Desk.

<a id="en-data"></a>

### Data & usage

- Books are ordinary Roam pages and blocks. Uninstalling the extension leaves them, your comments and your highlights untouched.
- The book library is kept on `roam/epub-importer/library`, reading progress and repair backups on `roam/epub-importer/reader`. Unfinished imports are cached in your browser.
- Destructive actions show a preview first. Repairs can be undone, and shared or unverified attachments are never deleted.

<a id="en-faq"></a>

### Frequently asked questions

**Why is a heading missing from Contents?** The contents panel uses Roam’s H1–H3 heading blocks. Format section headings as H1, H2 or H3; bold text alone does not create a heading entry.

**Do I need to import a book?** No. Page contents, margin comments, marks, highlights and questions can be used on ordinary Roam pages. Chapter progress and book management apply to imported books.

- **A heading or footnote marker looks wrong:** panel → Settings → Repair This Book.
- **Margin notes cover text in a narrow window:** widen the window or close a sidebar; until then only the commented paragraph makes room.
- **A book is missing after an update:** run Reading Desk: Recover Existing Book.

Reading Desk works with Roam themes, including Folio. When both plugins are enabled, Reading Desk handles the paragraph-mark shortcut to avoid applying it twice.

<a id="en-more"></a>

### More plugins

- **Folio** — Warm, magazine-inspired typography and modular tools for your Roam workspace.
- **Version Studio** — Compare note versions, follow your thinking and rewrite with confidence.

Install each plugin separately from Roam Depot.

<a id="en-credits"></a>

### Credits

Thanks to Roam Research and the Roam community.

[↑ Back to top](#top)

---

<a id="zh"></a>

## 中文

<a id="zh-overview"></a>

### 概览

Reading Desk 为已有的 Roam 页面提供清晰的目录，让长笔记更容易浏览和定位。通过 H1–H3 标题看清页面结构，点击即可跳到需要的章节，再在同一阅读空间中批注、标记和整理疑问。

- 在目录中看清页面标题层级，点击跳转到需要的章节。
- 在正文旁查看评论，标记与高亮重点。
- 在同一面板中回顾批注和疑问。

<a id="zh-start"></a>

### 快速上手

1. 打开 **Settings → Roam Depot**，搜索并安装 **Reading Desk**。
2. 打开一个已有的 Roam 页面，点击顶部书本图标，或运行 **Reading Desk: Open Reading Panel**。
3. 用**目录**跳转标题，用 **Alt+M** 标记段落，用 **Alt+Q** 添加疑问。这些功能无需导入书籍即可使用。

<a id="zh-features"></a>

### 功能指南

[页面目录与导航](#zh-contents) · [阅读面板](#zh-panel) · [原生评论旁注](#zh-margin-notes) · [Mark It 与高亮](#zh-marks) · [疑问](#zh-questions) · [读书笔记](#zh-reading-notes) · [导入 EPUB](#zh-import) · [书籍维护](#zh-maintenance)

<a id="zh-contents"></a>

#### 页面目录与导航

从页面已有的 **H1–H3 标题**生成目录，先看清结构，再深入内容。

- **普通页面直接用：** 研究笔记、会议记录和长篇文章都可以按标题浏览，无需导入书籍。
- **看清标题层级：** 在**目录**标签页集中浏览各级标题，减少在长页面中反复滚动。
- **点击即可定位：** 点击标题跳转到对应位置；折叠着的标题会展开。
- **同样适用于书籍：** 导入 EPUB 后，也可以通过目录浏览和跳转章节。

<a id="zh-panel"></a>

#### 阅读面板

- 五个标签：**目录**、**批注**、**疑问**、**笔记**、**设置**。
- 按章节估算阅读进度，也可以自己把章节标为已读。
- **全部书籍** 汇总所有书和你选择加入的页面里的批注。

<a id="zh-margin-notes"></a>

#### 原生评论旁注

- Roam 自带的评论完整显示在对应段落旁的页边留白里，和 Folio 的页边旁注一样，正文宽度不变。
- 页边太窄时，只有被评论的那一段会让出位置给旁注。
- 可选 **卡片** 或 **简洁** 样式、颜色，以及旧的在前或新的在前。每张卡片显示日期。
- 点击旁注会与段落对齐。**×** 删除评论（评论线程空了会一并删除）；**↗** 打开原生评论线程。
- 用块引用写的评论会显示被引用的内容。视频时间戳笔记不会显示为旁注。

<a id="zh-marks"></a>

#### Mark It 与高亮

- **Mark It**（Alt+M）给段落加上 #mark。标签留在文字里，阅读时隐藏。
- 六种标记样式：页边金点 + 加粗（默认）、书签丝带、金色荧光笔、引文、便签、深墨强调。
- 原生 ^^高亮^^ 可选颜色和样式，在纸色主题上也清晰可见。

<a id="zh-questions"></a>

#### 疑问

- **切换疑问**（Alt+Q）在块末尾加 #question，或在开头加 `Question::` 属性。
- “疑问”标签汇总 #question 标签、你自定义的疑问标签、疑问属性和原生 TODO，DONE 不计入。

<a id="zh-reading-notes"></a>

#### 读书笔记

- 在“批注”中勾选条目，生成笔记草稿：一个引用原文块并链接回书的页面。
- 笔记的日期链接到当天的 Daily Notes。新笔记会在右侧边栏（或主窗口）打开。
- **笔记** 标签可进入笔记页面，并按天折叠列出每一份笔记。

<a id="zh-import"></a>

#### 导入 EPUB

需要在 Roam 中阅读电子书时，运行 **Reading Desk: Import EPUB**，选择 EPUB 文件并确认预览。

- 正文、图片、脚注、内部链接和公式按原书顺序导入。
- 书的目录变成 H1–H3 标题；第四层变为加粗文字。
- EPUB 只在你的设备上解析。确认预览后，图片才会上传到图谱。
- 导入中断后可以继续。

<a id="zh-maintenance"></a>

#### 书籍维护

- **修复这本书**：预览并修复标题层级、脚注标记和编号链接，支持撤销。
- **移除图片**：移除书中的图片，保留正文。
- **删除书籍**：删除章节和仅本书使用的文件，保留页面容器与原生评论。

<a id="zh-shortcuts"></a>

### 命令与快捷键

| 命令 | 默认快捷键 |
| --- | --- |
| Reading Desk: Open Reading Panel | 可自定义 |
| Reading Desk: Browse Annotations | — |
| Reading Desk: Toggle Mark | Alt+M |
| Reading Desk: Toggle Question | Alt+Q |
| Reading Desk: Open Reading Notes | 可自定义 |
| Reading Desk: Continue Reading | 可自定义 |
| Reading Desk: Import EPUB | — |
| Reading Desk: Manage Imported Books | — |
| Reading Desk: Recover Existing Book | — |
| Reading Desk: Preview Book Link Repairs | — |

命令名称保持英文。快捷键在 **Reading Desk → 设置 → 键盘快捷键** 中调整。macOS 上 Alt 对应 Option。

<a id="zh-settings"></a>

### 设置

- **语言：** 自动（跟随浏览器）、English、Français、Italiano、Deutsch、Español、中文。
- **阅读：** 跳转时折叠上一章、自动进度、正文宽度（铺满整行或保留主题行宽）。
- **原生评论：** 开关页边旁注，设置样式、颜色和顺序。
- **高亮与 Mark It**、**疑问**、**键盘快捷键**、新读书笔记的打开位置，以及 **维护**。
- 语言、导入、书籍管理、进度、页边旁注、高亮颜色和疑问标签，也可以在 Roam 的 Settings → Reading Desk 中设置。

<a id="zh-data"></a>

### 数据与使用说明

- 书就是普通的 Roam 页面和块。卸载插件不会动这些书，也不会动你的评论和高亮。
- 书库保存在 `roam/epub-importer/library`，阅读进度和修复备份保存在 `roam/epub-importer/reader`。未完成的导入缓存在浏览器中。
- 有破坏性的操作都会先显示预览。修复可以撤销，共用或未验证的附件永远不会被删除。

<a id="zh-faq"></a>

### 常见问题

**为什么有的标题没有出现在目录里？** 目录读取 Roam 的 H1–H3 标题块。请将章节标题设为 H1、H2 或 H3；仅加粗文字不会生成目录条目。

**必须先导入书籍吗？** 不需要。页面目录、评论旁注、标记、高亮和疑问可直接用于普通 Roam 页面。章节进度与书籍管理用于已导入的书籍。

- **标题或脚注标记显示不对：** 面板 → 设置 → 修复这本书。
- **窗口较窄时旁注挡住正文：** 拉宽窗口或收起一侧边栏；在此之前只有被评论的那一段会让出位置。
- **更新后书籍不见了：** 运行 Reading Desk: Recover Existing Book。

Reading Desk 可搭配 Roam 主题使用，包括 Folio。两款同时启用时，段落标记快捷键由 Reading Desk 处理，避免重复触发。

<a id="zh-more"></a>

### 同系列插件

- **Folio** — 用温暖的杂志式排版和可独立启停的组件，打造自己的 Roam 知识空间。
- **Version Studio** — 对比笔记版本，追踪思路变化，放心改写每一个想法。

各插件在 Roam Depot 中独立安装。

<a id="zh-credits"></a>

### 致谢

感谢 Roam Research 与 Roam 社区。

[↑ 返回顶部](#top)

---

<a id="it"></a>

## Italiano

<a id="it-overview"></a>

### Panoramica

Reading Desk aggiunge un indice alle pagine Roam che hai già, rendendo più semplice esplorare le note lunghe. Consulta la struttura dei titoli H1–H3 e raggiungi subito la sezione desiderata, poi leggi, annota e raccogli domande nello stesso spazio.

- Consulta la gerarchia dei titoli e passa direttamente alla sezione desiderata.
- Tieni commenti, segni ed evidenziazioni accanto al testo.
- Rivedi annotazioni e domande nello stesso pannello.

<a id="it-start"></a>

### Per iniziare

1. Apri **Settings → Roam Depot**, cerca **Reading Desk** e installalo.
2. Apri una pagina Roam esistente. Fai clic sul libro nella barra superiore o esegui **Reading Desk: Open Reading Panel**.
3. Naviga con **Indice**, segna un paragrafo con **Alt+M** e aggiungi una domanda con **Alt+Q**. Puoi usare questi strumenti senza importare un libro.

<a id="it-features"></a>

### Funzionalità

[Indice della pagina e navigazione](#it-contents) · [Pannello di lettura](#it-panel) · [Note a margine dai commenti nativi](#it-margin-notes) · [Segni ed evidenziazioni](#it-marks) · [Domande](#it-questions) · [Note di lettura](#it-reading-notes) · [Importazione EPUB](#it-import) · [Manutenzione dei libri](#it-maintenance)

<a id="it-contents"></a>

#### Indice della pagina e navigazione

Esplora le pagine lunghe con un indice basato sui loro **titoli H1–H3**.

- **Per le normali pagine Roam:** usalo con note di ricerca, verbali e articoli lunghi, senza importare libri.
- **Vedi la struttura:** consulta la gerarchia dei titoli nella scheda **Indice**, invece di scorrere tutta la pagina.
- **Raggiungi una sezione:** fai clic su un titolo per andare al punto corrispondente; un titolo compresso si apre.
- **Anche per i libri importati:** usa lo stesso pannello per navigare tra i capitoli.

<a id="it-panel"></a>

#### Pannello di lettura

- Cinque schede: **Indice**, **Annotazioni**, **Domande**, **Note** e **Impostazioni**.
- L’avanzamento è stimato per capitolo e puoi segnare tu stesso i capitoli come letti.
- **Tutti i libri** raccoglie le annotazioni di tutti i libri e delle pagine che scegli di includere.

<a id="it-margin-notes"></a>

#### Note a margine dai commenti nativi

- I commenti di Roam compaiono per intero accanto al loro paragrafo, nel margine vuoto, come le note a margine di Folio. Il testo mantiene la sua larghezza.
- Quando il margine è troppo stretto, solo il paragrafo commentato fa spazio alla sua nota.
- Scegli **Schede** o **Minimale**, un colore e l’ordine (prima le più vecchie o le più recenti). Ogni scheda mostra la sua data.
- Fai clic su una nota per allinearla al suo paragrafo. **×** elimina il commento (e il blocco del thread rimasto vuoto); **↗** apre il thread nativo.
- I commenti scritti come riferimenti a blocchi mostrano il testo citato. Le note con marca temporale video non vengono mai mostrate.

<a id="it-marks"></a>

#### Segni ed evidenziazioni

- **Segna** (Alt+M) aggiunge #mark a un paragrafo. Il tag resta nel testo ed è nascosto durante la lettura.
- Sei stili di segno: punto a margine + grassetto (predefinito), nastro segnalibro, evidenziatore dorato, citazione in evidenza, post-it, inchiostro marcato.
- Le ^^evidenziazioni^^ native ricevono un colore e uno stile che restano leggibili sui temi color carta.

<a id="it-questions"></a>

#### Domande

- **Domanda** (Alt+Q) aggiunge #question alla fine di un blocco, oppure un attributo `Question::` all’inizio.
- La scheda Domande raccoglie i tag #question, i tuoi tag di domanda, gli attributi di domanda e i TODO nativi. Gli elementi DONE sono esclusi.

<a id="it-reading-notes"></a>

#### Note di lettura

- In Annotazioni, spunta gli elementi e crea una bozza di note: una pagina che rimanda ai blocchi originali e al libro.
- La data della bozza rimanda alla sua pagina Daily Notes. Le nuove note si aprono nella barra laterale destra (o nella finestra principale).
- La scheda **Note** apre la pagina delle note ed elenca ogni bozza, raggruppata per giorno.

<a id="it-import"></a>

#### Importazione EPUB

Per leggere un libro in Roam, esegui **Reading Desk: Import EPUB**, scegli un file EPUB e conferma l’anteprima.

- Testo, immagini, note, collegamenti interni e formule vengono importati nell’ordine originale.
- L’indice del libro diventa titoli H1–H3; un quarto livello diventa testo in grassetto.
- L’EPUB viene analizzato sul tuo dispositivo. Le immagini vengono caricate nel grafo solo dopo che confermi l’anteprima.
- Le importazioni interrotte possono essere riprese.

<a id="it-maintenance"></a>

#### Manutenzione dei libri

- **Ripara questo libro** mostra un’anteprima delle correzioni a titoli, richiami di nota e collegamenti numerati. Le riparazioni si possono annullare.
- **Rimuovi immagini** elimina le immagini e conserva il testo.
- **Elimina libro** rimuove capitoli e file usati solo dal libro; le pagine contenitrici e i commenti nativi restano.

<a id="it-shortcuts"></a>

### Comandi e scorciatoie

| Comando | Predefinita |
| --- | --- |
| Reading Desk: Open Reading Panel | personalizzabile |
| Reading Desk: Browse Annotations | — |
| Reading Desk: Toggle Mark | Alt+M |
| Reading Desk: Toggle Question | Alt+Q |
| Reading Desk: Open Reading Notes | personalizzabile |
| Reading Desk: Continue Reading | personalizzabile |
| Reading Desk: Import EPUB | — |
| Reading Desk: Manage Imported Books | — |
| Reading Desk: Recover Existing Book | — |
| Reading Desk: Preview Book Link Repairs | — |

I nomi dei comandi restano in inglese. Configura le scorciatoie in **Reading Desk → Impostazioni → Scorciatoie da tastiera**. Su macOS Alt corrisponde a Option.

<a id="it-settings"></a>

### Impostazioni

- **Lingua:** Auto (lingua del browser), English, 中文, Italiano, Deutsch, Français, Español.
- **Lettura:** comprimere il capitolo precedente, avanzamento automatico, larghezza del testo (riempire la riga o mantenere la lunghezza di riga del tema).
- **Commenti nativi:** note a margine attive o no, stile, colore, ordine.
- **Evidenziazioni e segni**, **Domande**, **Scorciatoie da tastiera**, dove si aprono le nuove note di lettura e **Manutenzione**.
- Lingua, importazione, gestione dei libri, avanzamento, note a margine, colore di evidenziazione e tag delle domande si trovano anche in Roam, Settings → Reading Desk.

<a id="it-data"></a>

### Dati e utilizzo

- I libri sono normali pagine e blocchi Roam. Disinstallare l’estensione non tocca né loro, né i tuoi commenti, né le tue evidenziazioni.
- La biblioteca è conservata in `roam/epub-importer/library`, l’avanzamento e i backup delle riparazioni in `roam/epub-importer/reader`. Le importazioni non completate sono memorizzate nel browser.
- Le azioni distruttive mostrano prima un’anteprima. Le riparazioni si possono annullare e gli allegati condivisi o non verificati non vengono mai eliminati.

<a id="it-faq"></a>

### Domande frequenti

**Perché un titolo manca nell’indice?** L’indice usa i blocchi titolo H1–H3 di Roam. Imposta i titoli delle sezioni come H1, H2 o H3; il solo grassetto non crea una voce nell’indice.

**Devo prima importare un libro?** No. Indice della pagina, commenti a margine, segni, evidenziazioni e domande funzionano sulle normali pagine Roam. Progresso dei capitoli e gestione dei libri riguardano i libri importati.

- **Un titolo o un richiamo di nota sembra sbagliato:** pannello → Impostazioni → Ripara questo libro.
- **Le note a margine coprono il testo in una finestra stretta:** allarga la finestra o chiudi una barra laterale; nel frattempo solo il paragrafo commentato fa spazio.
- **Un libro manca dopo un aggiornamento:** esegui Reading Desk: Recover Existing Book.

Reading Desk funziona con i temi Roam, incluso Folio. Se entrambi sono attivi, Reading Desk gestisce la scorciatoia dei segni per evitare una doppia attivazione.

<a id="it-more"></a>

### Altri plugin

- **Folio** — Tipografia calda in stile rivista e strumenti modulari per il tuo spazio Roam.
- **Version Studio** — Confronta le versioni delle note, segui le tue idee e riscrivi con fiducia.

Installa ogni plugin separatamente da Roam Depot.

<a id="it-credits"></a>

### Ringraziamenti

Grazie a Roam Research e alla comunità Roam.

[↑ Torna su](#top)

---

<a id="de"></a>

## Deutsch

<a id="de-overview"></a>

### Überblick

Reading Desk gibt deinen vorhandenen Roam-Seiten ein Inhaltsverzeichnis und macht lange Notizen leichter zugänglich. Erkenne die Struktur anhand der H1–H3-Überschriften, springe direkt zum gewünschten Abschnitt und lies, kommentiere und sammle Fragen im selben Arbeitsbereich.

- Sieh die Überschriftenhierarchie auf einen Blick und springe direkt zu Abschnitten.
- Lies Kommentare, Markierungen und Hervorhebungen direkt am Text.
- Sieh Anmerkungen und Fragen in einem Panel durch.

<a id="de-start"></a>

### Erste Schritte

1. Öffne **Settings → Roam Depot**, suche **Reading Desk** und installiere es.
2. Öffne eine vorhandene Roam-Seite. Klicke oben auf das Buchsymbol oder führe **Reading Desk: Open Reading Panel** aus.
3. Navigiere über **Inhalt**, markiere einen Absatz mit **Alt+M** und füge mit **Alt+Q** eine Frage hinzu. Diese Werkzeuge funktionieren ohne Buchimport.

<a id="de-features"></a>

### Funktionen

[Seiteninhaltsverzeichnis und Navigation](#de-contents) · [Lesepanel](#de-panel) · [Randnotizen aus nativen Kommentaren](#de-margin-notes) · [Markieren und Hervorheben](#de-marks) · [Fragen](#de-questions) · [Lesenotizen](#de-reading-notes) · [EPUB-Import](#de-import) · [Buchpflege](#de-maintenance)

<a id="de-contents"></a>

#### Seiteninhaltsverzeichnis und Navigation

Erschließe lange Seiten mit einem Inhaltsverzeichnis aus ihren vorhandenen **H1–H3-Überschriften**.

- **Für normale Roam-Seiten:** nutze es für Forschungsnotizen, Besprechungsprotokolle und lange Artikel, ohne ein Buch zu importieren.
- **Struktur erkennen:** sieh die Überschriftenhierarchie im Tab **Inhalt**, statt durch die ganze Seite zu scrollen.
- **Zum Abschnitt springen:** klicke auf eine Überschrift; eine eingeklappte Überschrift wird geöffnet.
- **Auch für importierte Bücher:** navigiere mit demselben Panel durch die Kapitel.

<a id="de-panel"></a>

#### Lesepanel

- Fünf Tabs: **Inhalt**, **Anmerkungen**, **Fragen**, **Notizen** und **Einstellungen**.
- Der Lesefortschritt wird pro Kapitel geschätzt, und du kannst Kapitel selbst als gelesen markieren.
- **Alle Bücher** sammelt Anmerkungen aus allen Büchern und aus Seiten, die du aufnimmst.

<a id="de-margin-notes"></a>

#### Randnotizen aus nativen Kommentaren

- Roams eigene Kommentare erscheinen vollständig neben ihrem Absatz im freien Rand, so wie Folio Randnotizen setzt. Der Text behält seine Breite.
- Ist der Rand zu schmal, macht nur der kommentierte Absatz Platz für seine Notiz.
- Wähle **Karten** oder **Minimal**, eine Farbe und die Reihenfolge (älteste oder neueste zuerst). Jede Karte zeigt ihr Datum.
- Klicke auf eine Notiz, um sie an ihrem Absatz auszurichten. **×** löscht den Kommentar (und seinen leer gewordenen Thread-Block); **↗** öffnet den nativen Thread.
- Kommentare, die als Blockverweis geschrieben sind, zeigen den verwiesenen Text. Video-Zeitstempelnotizen werden nie angezeigt.

<a id="de-marks"></a>

#### Markieren und Hervorheben

- **Markieren** (Alt+M) versieht einen Absatz mit #mark. Der Tag bleibt im Text und wird beim Lesen ausgeblendet.
- Sechs Markierungsstile: Randpunkt + fett (Standard), Lesezeichenband, goldener Textmarker, herausgestelltes Zitat, Haftnotiz, kräftige Tinte.
- Native ^^Hervorhebungen^^ erhalten eine Farbe und einen Stil, die auf papierfarbenen Themes lesbar bleiben.

<a id="de-questions"></a>

#### Fragen

- **Frage** (Alt+Q) fügt #question am Ende eines Blocks oder ein `Question::`-Attribut am Anfang hinzu.
- Der Tab Fragen sammelt #question-Tags, deine eigenen Frage-Tags, Frage-Attribute und native TODOs. DONE-Einträge werden ausgelassen.

<a id="de-reading-notes"></a>

#### Lesenotizen

- Hake unter Anmerkungen Einträge an und erstelle einen Notizentwurf: eine Seite, die auf die Originalblöcke verweist und zum Buch zurückverlinkt.
- Das Datum des Entwurfs verlinkt auf seine Daily-Notes-Seite. Neue Notizen öffnen sich in der rechten Seitenleiste (oder im Hauptfenster).
- Der Tab **Notizen** öffnet die Notizenseite und listet jeden Entwurf, nach Tag eingeklappt.

<a id="de-import"></a>

#### EPUB-Import

Wenn du ein Buch in Roam lesen möchtest, führe **Reading Desk: Import EPUB** aus, wähle eine EPUB-Datei und bestätige die Vorschau.

- Text, Bilder, Fußnoten, interne Links und Formeln werden in ihrer ursprünglichen Reihenfolge importiert.
- Das Inhaltsverzeichnis des Buchs wird zu H1–H3-Überschriften; eine vierte Ebene wird zu Fettdruck.
- Das EPUB wird auf deinem Gerät eingelesen. Bilder werden erst hochgeladen, nachdem du die Vorschau bestätigt hast.
- Unterbrochene Importe lassen sich fortsetzen.

<a id="de-maintenance"></a>

#### Buchpflege

- **Dieses Buch reparieren** zeigt Korrekturen an Überschriften, Fußnotenzeichen und nummerierten Links vorab an. Reparaturen lassen sich rückgängig machen.
- **Bilder entfernen** entfernt Bilder und behält den Text.
- **Buch löschen** entfernt Kapitel und nur von diesem Buch verwendete Dateien; die umgebenden Seiten und nativen Kommentare bleiben.

<a id="de-shortcuts"></a>

### Befehle und Tastenkürzel

| Befehl | Standard |
| --- | --- |
| Reading Desk: Open Reading Panel | anpassbar |
| Reading Desk: Browse Annotations | — |
| Reading Desk: Toggle Mark | Alt+M |
| Reading Desk: Toggle Question | Alt+Q |
| Reading Desk: Open Reading Notes | anpassbar |
| Reading Desk: Continue Reading | anpassbar |
| Reading Desk: Import EPUB | — |
| Reading Desk: Manage Imported Books | — |
| Reading Desk: Recover Existing Book | — |
| Reading Desk: Preview Book Link Repairs | — |

Befehlsnamen bleiben englisch. Konfiguriere Kürzel unter **Reading Desk → Einstellungen → Tastenkürzel**. Unter macOS entspricht Alt der Option-Taste.

<a id="de-settings"></a>

### Einstellungen

- **Sprache:** Auto (Browsersprache), English, 中文, Italiano, Deutsch, Français, Español.
- **Lesen:** vorheriges Kapitel einklappen, automatischer Fortschritt, Textbreite (Zeile füllen oder Zeilenlänge des Themes behalten).
- **Native Kommentare:** Randnotizen ein oder aus, Stil, Farbe, Reihenfolge.
- **Hervorhebungen und Markierungen**, **Fragen**, **Tastenkürzel**, wo neue Lesenotizen öffnen, und **Wartung**.
- Sprache, Import, Bücherverwaltung, Fortschritt, Randnotizen, Hervorhebungsfarbe und Frage-Tags stehen auch in Roam unter Settings → Reading Desk.

<a id="de-data"></a>

### Daten und Nutzung

- Bücher sind normale Roam-Seiten und -Blöcke. Wenn du die Erweiterung deinstallierst, bleiben sie, deine Kommentare und deine Hervorhebungen unberührt.
- Die Bibliothek liegt auf `roam/epub-importer/library`, Fortschritt und Reparatursicherungen auf `roam/epub-importer/reader`. Unvollständige Importe werden im Browser zwischengespeichert.
- Zerstörende Aktionen zeigen zuerst eine Vorschau. Reparaturen lassen sich rückgängig machen, und geteilte oder nicht geprüfte Anhänge werden nie gelöscht.

<a id="de-faq"></a>

### Häufige Fragen

**Warum fehlt eine Überschrift im Inhaltsverzeichnis?** Das Verzeichnis verwendet Roams H1–H3-Überschriftenblöcke. Formatiere Abschnittstitel als H1, H2 oder H3; Fettdruck allein erzeugt keinen Eintrag.

**Muss ich zuerst ein Buch importieren?** Nein. Seiteninhalt, Randkommentare, Markierungen, Hervorhebungen und Fragen funktionieren auf normalen Roam-Seiten. Kapitelfortschritt und Buchverwaltung gelten für importierte Bücher.

- **Eine Überschrift oder ein Fußnotenzeichen sieht falsch aus:** Panel → Einstellungen → Dieses Buch reparieren.
- **Randnotizen verdecken in einem schmalen Fenster den Text:** Fenster verbreitern oder eine Seitenleiste schließen; bis dahin macht nur der kommentierte Absatz Platz.
- **Ein Buch fehlt nach einem Update:** Reading Desk: Recover Existing Book ausführen.

Reading Desk lässt sich mit Roam-Themes wie Folio nutzen. Sind beide aktiv, verarbeitet Reading Desk das Markierungskürzel, damit es nur einmal ausgelöst wird.

<a id="de-more"></a>

### Weitere Plugins

- **Folio** — Warme Typografie im Magazinstil und einzeln schaltbare Werkzeuge für Roam.
- **Version Studio** — Vergleiche Notizversionen, verfolge deine Gedanken und überarbeite mit Zuversicht.

Installiere die Plugins einzeln aus Roam Depot.

<a id="de-credits"></a>

### Danksagung

Danke an Roam Research und die Roam-Community.

[↑ Nach oben](#top)

---

<a id="fr"></a>

## Français

<a id="fr-overview"></a>

### Présentation

Reading Desk ajoute un sommaire à vos pages Roam existantes pour faciliter la lecture des longues notes. Repérez leur structure grâce aux titres H1–H3 et accédez directement à la section souhaitée, puis lisez, annotez et rassemblez vos questions dans le même espace.

- Consultez la hiérarchie des titres et accédez directement à chaque section.
- Gardez commentaires, marques et surlignages près du texte.
- Retrouvez annotations et questions dans un même panneau.

<a id="fr-start"></a>

### Prise en main

1. Ouvrez **Settings → Roam Depot**, recherchez **Reading Desk** et installez-le.
2. Ouvrez une page Roam existante. Cliquez sur le livre dans la barre du haut ou lancez **Reading Desk: Open Reading Panel**.
3. Naviguez avec **Sommaire**, marquez un paragraphe avec **Alt+M** et ajoutez une question avec **Alt+Q**. Ces outils fonctionnent sans importer de livre.

<a id="fr-features"></a>

### Fonctionnalités

[Sommaire des pages et navigation](#fr-contents) · [Panneau de lecture](#fr-panel) · [Notes en marge à partir des commentaires natifs](#fr-margin-notes) · [Marquer et surligner](#fr-marks) · [Questions](#fr-questions) · [Notes de lecture](#fr-reading-notes) · [Import EPUB](#fr-import) · [Entretien des livres](#fr-maintenance)

<a id="fr-contents"></a>

#### Sommaire des pages et navigation

Explorez les longues pages avec un sommaire construit à partir de leurs **titres H1–H3**.

- **Pour les pages Roam ordinaires :** utilisez-le avec vos notes de recherche, comptes rendus et longs articles, sans importer de livre.
- **Voir la structure :** parcourez la hiérarchie des titres dans l’onglet **Sommaire**, sans faire défiler toute la page.
- **Accéder à une section :** cliquez sur un titre pour le rejoindre ; un titre replié s’ouvre.
- **Pour les livres importés aussi :** utilisez le même panneau pour naviguer entre les chapitres.

<a id="fr-panel"></a>

#### Panneau de lecture

- Cinq onglets : **Sommaire**, **Annotations**, **Questions**, **Notes** et **Réglages**.
- La progression est estimée par chapitre, et vous pouvez marquer vous-même un chapitre comme lu.
- **Tous les livres** réunit les annotations de tous les livres et des pages que vous choisissez d’inclure.

<a id="fr-margin-notes"></a>

#### Notes en marge à partir des commentaires natifs

- Les commentaires de Roam s’affichent en entier à côté de leur paragraphe, dans la marge vide, comme les notes en marge de Folio. Le texte garde sa largeur.
- Quand la marge est trop étroite, seul le paragraphe commenté fait de la place à sa note.
- Choisissez **Cartes** ou **Minimal**, une couleur, et l’ordre (plus anciennes ou plus récentes d’abord). Chaque carte affiche sa date.
- Cliquez sur une note pour l’aligner sur son paragraphe. **×** supprime le commentaire (et son bloc de fil devenu vide) ; **↗** ouvre le fil natif.
- Les commentaires écrits comme références de bloc affichent le texte référencé. Les notes d’horodatage vidéo ne s’affichent jamais.

<a id="fr-marks"></a>

#### Marquer et surligner

- **Marquer** (Alt+M) ajoute #mark à un paragraphe. Le tag reste dans le texte et est masqué pendant la lecture.
- Six styles de marque : point en marge + gras (par défaut), ruban signet, surligneur doré, citation en exergue, note adhésive, encre appuyée.
- Les ^^surlignages^^ natifs reçoivent une couleur et un style qui restent lisibles sur les thèmes couleur papier.

<a id="fr-questions"></a>

#### Questions

- **Question** (Alt+Q) ajoute #question à la fin d’un bloc, ou un attribut `Question::` au début.
- L’onglet Questions réunit les tags #question, vos propres tags de question, les attributs de question et les TODO natifs. Les éléments DONE sont exclus.

<a id="fr-reading-notes"></a>

#### Notes de lecture

- Dans Annotations, cochez des éléments et créez un brouillon de notes : une page qui renvoie aux blocs d’origine et au livre.
- La date du brouillon renvoie à sa page Daily Notes. Les nouvelles notes s’ouvrent dans la barre latérale droite (ou la fenêtre principale).
- L’onglet **Notes** ouvre la page de notes et liste chaque brouillon, replié par jour.

<a id="fr-import"></a>

#### Import EPUB

Pour lire un livre dans Roam, lancez **Reading Desk: Import EPUB**, choisissez un fichier EPUB et validez l’aperçu.

- Texte, images, notes, liens internes et formules sont importés dans leur ordre d’origine.
- La table des matières du livre devient des titres H1–H3 ; un quatrième niveau devient du texte en gras.
- L’EPUB est analysé sur votre appareil. Les images ne sont envoyées dans votre graphe qu’après validation de l’aperçu.
- Un import interrompu peut être repris.

<a id="fr-maintenance"></a>

#### Entretien des livres

- **Réparer ce livre** présente les corrections des titres, appels de note et liens numérotés avant application. Les réparations peuvent être annulées.
- **Retirer les images** supprime les images et conserve le texte.
- **Supprimer le livre** retire les chapitres et fichiers utilisés uniquement par ce livre ; les pages conteneurs et commentaires natifs restent.

<a id="fr-shortcuts"></a>

### Commandes et raccourcis

| Commande | Par défaut |
| --- | --- |
| Reading Desk: Open Reading Panel | personnalisable |
| Reading Desk: Browse Annotations | — |
| Reading Desk: Toggle Mark | Alt+M |
| Reading Desk: Toggle Question | Alt+Q |
| Reading Desk: Open Reading Notes | personnalisable |
| Reading Desk: Continue Reading | personnalisable |
| Reading Desk: Import EPUB | — |
| Reading Desk: Manage Imported Books | — |
| Reading Desk: Recover Existing Book | — |
| Reading Desk: Preview Book Link Repairs | — |

Les noms des commandes restent en anglais. Réglez les raccourcis dans **Reading Desk → Réglages → Raccourcis clavier**. Sur macOS, Alt correspond à Option.

<a id="fr-settings"></a>

### Réglages

- **Langue :** Auto (langue du navigateur), English, 中文, Italiano, Deutsch, Français, Español.
- **Lecture :** replier le chapitre précédent, progression automatique, largeur du texte (remplir la ligne ou garder la longueur de ligne du thème).
- **Commentaires natifs :** notes en marge activées ou non, style, couleur, ordre.
- **Surlignages et marques**, **Questions**, **Raccourcis clavier**, emplacement des nouvelles notes de lecture et **Maintenance**.
- Langue, import, gestion des livres, progression, notes en marge, couleur de surlignage et tags de question se trouvent aussi dans Roam, Settings → Reading Desk.

<a id="fr-data"></a>

### Données et utilisation

- Les livres sont des pages et des blocs Roam ordinaires. Désinstaller l’extension ne touche ni à eux, ni à vos commentaires, ni à vos surlignages.
- La bibliothèque est conservée sur `roam/epub-importer/library`, la progression et les sauvegardes de réparation sur `roam/epub-importer/reader`. Les imports inachevés sont mis en cache dans votre navigateur.
- Les actions destructrices montrent d’abord un aperçu. Les réparations peuvent être annulées, et les pièces jointes partagées ou non vérifiées ne sont jamais supprimées.

<a id="fr-faq"></a>

### Questions fréquentes

**Pourquoi un titre manque-t-il dans le sommaire ?** Le sommaire utilise les blocs de titre H1–H3 de Roam. Définissez les titres de section comme H1, H2 ou H3 ; le gras seul ne crée pas d’entrée.

**Faut-il importer un livre ?** Non. Sommaire, commentaires en marge, marques, surlignages et questions fonctionnent sur les pages Roam ordinaires. La progression par chapitre et la gestion des livres concernent les livres importés.

- **Un titre ou un appel de note semble faux :** panneau → Réglages → Réparer ce livre.
- **Les notes en marge couvrent le texte dans une fenêtre étroite :** élargissez la fenêtre ou fermez une barre latérale ; d’ici là, seul le paragraphe commenté fait de la place.
- **Un livre manque après une mise à jour :** lancez Reading Desk: Recover Existing Book.

Reading Desk fonctionne avec les thèmes Roam, dont Folio. Lorsque les deux sont actifs, Reading Desk gère le raccourci de marquage pour éviter un double déclenchement.

<a id="fr-more"></a>

### Autres plugins

- **Folio** — Une typographie chaleureuse inspirée des magazines et des outils modulaires pour Roam.
- **Version Studio** — Comparez les versions de vos notes, suivez vos idées et réécrivez en confiance.

Installez chaque plugin séparément depuis Roam Depot.

<a id="fr-credits"></a>

### Remerciements

Merci à Roam Research et à la communauté Roam.

[↑ Retour en haut](#top)

---

<a id="es"></a>

## Español

<a id="es-overview"></a>

### Presentación

Reading Desk añade un índice a tus páginas actuales de Roam para que las notas largas sean más fáciles de explorar. Consulta su estructura mediante los títulos H1–H3 y salta a la sección que necesitas; después lee, anota y reúne preguntas en el mismo espacio.

- Consulta la jerarquía de títulos y salta directamente a cada sección.
- Mantén comentarios, marcas y resaltados junto al texto.
- Revisa anotaciones y preguntas en un mismo panel.

<a id="es-start"></a>

### Primeros pasos

1. Abre **Settings → Roam Depot**, busca **Reading Desk** e instálalo.
2. Abre una página existente de Roam. Pulsa el libro en la barra superior o ejecuta **Reading Desk: Open Reading Panel**.
3. Navega con **Contenido**, marca un párrafo con **Alt+M** y añade una pregunta con **Alt+Q**. Estas herramientas funcionan sin importar libros.

<a id="es-features"></a>

### Funciones

[Índice de la página y navegación](#es-contents) · [Panel de lectura](#es-panel) · [Notas al margen con los comentarios nativos](#es-margin-notes) · [Marcas y resaltados](#es-marks) · [Preguntas](#es-questions) · [Notas de lectura](#es-reading-notes) · [Importación de EPUB](#es-import) · [Mantenimiento de libros](#es-maintenance)

<a id="es-contents"></a>

#### Índice de la página y navegación

Explora páginas largas con un índice generado a partir de sus **títulos H1–H3**.

- **Para páginas normales de Roam:** úsalo con notas de investigación, actas y artículos largos, sin importar libros.
- **Consulta la estructura:** recorre la jerarquía de títulos en la pestaña **Índice**, sin desplazarte por toda la página.
- **Salta a una sección:** pulsa un título para llegar a él; un título plegado se abre.
- **También para libros importados:** usa el mismo panel para navegar entre capítulos.

<a id="es-panel"></a>

#### Panel de lectura

- Cinco pestañas: **Índice**, **Anotaciones**, **Preguntas**, **Notas** y **Ajustes**.
- El progreso se estima por capítulo y puedes marcar tú mismo los capítulos como leídos.
- **Todos los libros** reúne las anotaciones de todos los libros y de las páginas que decidas incluir.

<a id="es-margin-notes"></a>

#### Notas al margen con los comentarios nativos

- Los comentarios propios de Roam aparecen completos junto a su párrafo, en el margen vacío, igual que Folio coloca sus notas al margen. El texto conserva su ancho.
- Cuando el margen es demasiado estrecho, solo el párrafo comentado deja espacio para su nota.
- Elige **Tarjetas** o **Mínimo**, un color y el orden (primero las más antiguas o las más recientes). Cada tarjeta muestra su fecha.
- Haz clic en una nota para alinearla con su párrafo. **×** elimina el comentario (y su bloque de hilo vacío); **↗** abre el hilo nativo.
- Los comentarios escritos como referencias de bloque muestran el texto referenciado. Las notas de marca de tiempo de vídeo nunca se muestran.

<a id="es-marks"></a>

#### Marcas y resaltados

- **Marcar** (Alt+M) añade #mark a un párrafo. La etiqueta queda en el texto y se oculta al leer.
- Seis estilos de marca: punto al margen + negrita (predeterminado), cinta marcapáginas, rotulador dorado, cita destacada, nota adhesiva, tinta intensa.
- Los ^^resaltados^^ nativos reciben un color y un estilo que siguen siendo legibles en temas color papel.

<a id="es-questions"></a>

#### Preguntas

- **Pregunta** (Alt+Q) añade #question al final de un bloque, o un atributo `Question::` al principio.
- La pestaña Preguntas reúne las etiquetas #question, tus propias etiquetas de pregunta, los atributos de pregunta y los TODO nativos. Los elementos DONE se excluyen.

<a id="es-reading-notes"></a>

#### Notas de lectura

- En Anotaciones, marca elementos y crea un borrador de notas: una página que remite a los bloques originales y enlaza con el libro.
- La fecha del borrador enlaza con su página Daily Notes. Las notas nuevas se abren en la barra lateral derecha (o en la ventana principal).
- La pestaña **Notas** abre la página de notas y lista cada borrador, plegado por día.

<a id="es-import"></a>

#### Importación de EPUB

Para leer un libro en Roam, ejecuta **Reading Desk: Import EPUB**, elige un archivo EPUB y confirma la vista previa.

- El texto, las imágenes, las notas, los enlaces internos y las fórmulas se importan en su orden original.
- El índice del libro se convierte en títulos H1–H3; un cuarto nivel pasa a negrita.
- El EPUB se analiza en tu dispositivo. Las imágenes solo se suben a tu grafo después de confirmar la vista previa.
- Las importaciones interrumpidas se pueden reanudar.

<a id="es-maintenance"></a>

#### Mantenimiento de libros

- **Reparar este libro** muestra una vista previa de las correcciones de títulos, llamadas de nota y enlaces numerados. Las reparaciones se pueden deshacer.
- **Quitar imágenes** elimina las imágenes y conserva el texto.
- **Eliminar libro** quita capítulos y archivos exclusivos del libro; las páginas contenedoras y los comentarios nativos permanecen.

<a id="es-shortcuts"></a>

### Comandos y atajos

| Comando | Predeterminado |
| --- | --- |
| Reading Desk: Open Reading Panel | personalizable |
| Reading Desk: Browse Annotations | — |
| Reading Desk: Toggle Mark | Alt+M |
| Reading Desk: Toggle Question | Alt+Q |
| Reading Desk: Open Reading Notes | personalizable |
| Reading Desk: Continue Reading | personalizable |
| Reading Desk: Import EPUB | — |
| Reading Desk: Manage Imported Books | — |
| Reading Desk: Recover Existing Book | — |
| Reading Desk: Preview Book Link Repairs | — |

Los nombres de los comandos permanecen en inglés. Configura los atajos en **Reading Desk → Ajustes → Atajos de teclado**. En macOS, Alt corresponde a Opción.

<a id="es-settings"></a>

### Ajustes

- **Idioma:** Auto (idioma del navegador), English, 中文, Italiano, Deutsch, Français, Español.
- **Lectura:** plegar el capítulo anterior, progreso automático, ancho del texto (llenar la línea o mantener la longitud de línea del tema).
- **Comentarios nativos:** notas al margen activadas o no, estilo, color, orden.
- **Resaltados y marcas**, **Preguntas**, **Atajos de teclado**, dónde se abren las nuevas notas de lectura y **Mantenimiento**.
- Idioma, importación, gestión de libros, progreso, notas al margen, color de resaltado y etiquetas de pregunta también están en Roam, Settings → Reading Desk.

<a id="es-data"></a>

### Datos y uso

- Los libros son páginas y bloques normales de Roam. Desinstalar la extensión no toca ni los libros, ni tus comentarios, ni tus resaltados.
- La biblioteca se guarda en `roam/epub-importer/library`, y el progreso y las copias de seguridad de reparación en `roam/epub-importer/reader`. Las importaciones sin terminar se guardan en la caché del navegador.
- Las acciones destructivas muestran primero una vista previa. Las reparaciones se pueden deshacer y los adjuntos compartidos o no verificados nunca se eliminan.

<a id="es-faq"></a>

### Preguntas frecuentes

**¿Por qué falta un título en el índice?** El índice utiliza los bloques de título H1–H3 de Roam. Define los títulos de sección como H1, H2 o H3; la negrita por sí sola no crea una entrada.

**¿Tengo que importar un libro?** No. El índice, los comentarios al margen, las marcas, los resaltados y las preguntas funcionan en páginas normales de Roam. El progreso por capítulo y la gestión de libros corresponden a libros importados.

- **Un título o una llamada de nota se ve mal:** panel → Ajustes → Reparar este libro.
- **Las notas al margen tapan el texto en una ventana estrecha:** ensancha la ventana o cierra una barra lateral; mientras tanto, solo el párrafo comentado deja espacio.
- **Falta un libro tras una actualización:** ejecuta Reading Desk: Recover Existing Book.

Reading Desk funciona con los temas de Roam, incluido Folio. Si ambos están activos, Reading Desk gestiona el atajo de marcado para evitar activarlo dos veces.

<a id="es-more"></a>

### Otros plugins

- **Folio** — Tipografía cálida de revista y herramientas modulares para tu espacio Roam.
- **Version Studio** — Compara versiones, sigue tus ideas y reescribe con confianza.

Instala cada plugin por separado desde Roam Depot.

<a id="es-credits"></a>

### Agradecimientos

Gracias a Roam Research y a la comunidad de Roam.

[↑ Volver arriba](#top)
