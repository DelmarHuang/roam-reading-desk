## 0.7.15 · 2026-11-24
- Preserve edited/highlighted paragraphs when finalizing internal links, including resumed imports.
- Recheck live URL usage before deleting image files; retain files on failed scans and retain their attachment records.
- Recheck references before removing image-only blocks.
- Apply the same final attachment check to Delete Book.
- Add regression coverage for edits, new references, plain in-book links, missing blocks and failures.

## 0.7.14 · 2026-11-22 (test build)

- Replace the solid resize triangle with a subtle, theme-colored two-line grip, rounded strokes, and hover/focus feedback. Keep the resize behavior and accessible label unchanged.

## 0.7.13 · 2026-11-22 (test build)

- Align both repair-option checkboxes beside their labels, with wrapped text remaining in the label column.
- Add a bottom-right resize handle with pointer capture, keyboard arrows, viewport bounds and in-session size retention across panel reopen. Localize its accessible label in all supported languages.
- No changes to import, repair or book data logic.

## 0.7.12 · 2026-11-22 (test build)

- Show a localized blocking alert when the book or referenced content has changed since the approved repair preview; abort before writes.
- Explain in all supported languages that keeping the Roam window/tab active can improve import speed; show the notice during new imports and Resume.
- Split complete EPUB image tokens and remote image embeds from adjacent text while retaining reading order. Preserve literal text and ambiguous inline formatting. Existing resumable block plans are unchanged.
- Add an opt-in image/text repair preview for existing books. Keep the original text UID, heading, children and external references; create image siblings without uploading files. Skip chapter roots, interleaved text, highlights, macros and ambiguous formatting.
- Journal split operations before writes, including interrupted operations. Undo preserves images that gained references, children or edits. No outside reference text is rewritten by image splitting.
- Validation: 53 automated tests pass. Both supplied EPUBs retain their full reading-order text/image-token stream, asset lists and original navigation compared with 0.7.11. This validates parser preservation, not every historical graph import or every EPUB in existence.

## 0.7.11 · 2026-11-22 (test build)

- Resolve block references to readable text in the Delete Book reference preview, with a 240-character excerpt. Preserve the source-page button, jump target and deletion protection.

## 0.7.10 · 2026-11-22 (test build)

- Repair source-confirmed legacy TOC wrappers containing a sole repeated body heading: set the outer heading level and lift the existing body blocks before removing the unreferenced duplicate. Preview, stale-content checks, last-minute reference checks and Undo remain in effect.
- Require matching source opening text and skip source-intentional repeated headings, ambiguous structures and referenced duplicates. Original directory targets and paragraph UIDs remain unchanged.
- Verified that the current book proposes only the second-lecture wrapper and its duplicate. All 45 automated tests pass.

## 0.7.9 · 2026-11-21 (test build)

- Separate EPUB NAV/NCX Contents from body heading formatting. New imports use the original directory, including deeper navigation levels; books without a directory retain heading-based Contents.
- Original-EPUB repair previews and saves an exact directory mapping for existing books, with stale-preview checks and Undo. Ambiguous or missing entries block directory replacement instead of saving a partial list.
- Refresh live headings for legacy linked books without the newer headings flag, retaining their confirmed chapter roots.
- Verified the real recovered-book catalog and current graph against all 37 original directory entries, including the eleven lectures under chapter four; 44 automated tests pass.

## 0.7.8 · 2026-11-21 (test build)

- Source heading repair distinguishes image-bearing captions from actual text headings with the same title. Genuine duplicate text headings remain untouched. This restores missing chapter entries and their Contents hierarchy after previewed repair without changing images or body text.

## 0.7.7 · 2026-11-21 (test build)

- Heading levels are proposed only from the original EPUB. The old import catalog can no longer undo source-assisted heading repairs, including repairs already applied in 0.7.6.
- Contents follows current H1–H3 within the confirmed book scope; no book blocks or stored import scope are automatically rewritten.
- Opening from native Desk with no current page defaults to All Books; explicit book selection remains available.
- Fixed ZIP root folder: `reading-desk`. Removed the separate Chinese test guide and its README link.

## 0.7.6 · 2026-11-21 (test build)

- Keep all panel tabs at their scroll positions. Editing Roam text no longer silently replaces the panel or its repair preview; Refresh explicitly rebuilds the preview.
- Open registered books from native Roam Desk even when no current page UID exists.
- Import semantic body headings omitted from NAV/NCX. Normalize nested heading levels into Roam H1–H3; keep deeper sections nested with bold/plain labels. Handle ARIA headings, skipped levels and books without a TOC. Recognize split formatted chapter titles without duplicating them.
- Offer opt-in typography-based headings from inline/linked CSS, with an import heading-level preview. Bold alone is not sufficient. This is a conservative heuristic, not a guarantee for arbitrary publisher formatting.
- Original-EPUB repair restores uniquely matched headings within the same chapter, preserving block IDs and text. Ambiguous/edited matches are skipped. Ordinary user headings are no longer demoted merely for being outside the import catalog.
- List external referencing pages and text in Delete Book; clicking a page opens the referring block. Deletion remains blocked.
- Batch import timer waits while checking cancellation before every write. Existing uploaded image hashes continue to be reused on Resume.
- Avoid reading-tracker rescans for image/label changes; avoid comment data reloads for unrelated focus changes. Apply native lazy-loading/async-decoding hints only to managed-book images without an explicit existing setting, and remove owned hints on cleanup. Browser background throttling and native Roam rendering still apply.
- Verified the resumed Psychology of Money import against the prior import parser: all 1,767 blocks match; 25 chapter roots and 10 distinct images.

## 0.7.5 · 2026-11-17

- Repair executes the exact approved plan. Changed book content invalidates the preview; changed reference sets or text cause the affected operation to be skipped. External reference edits are listed in the preview. Later steps invalidated by an earlier repair require a fresh preview, rather than automatic replanning.
- Metadata reads pull the known library and reader pages, never a whole-graph prefix query. Page UIDs are saved in extension settings so subsequent renames remain discoverable.
- Closing, redrawing or unloading the reader releases shortcut recording. Unload cancels import writing, including page creation, block/link loops and the final metadata save; already submitted API requests may finish, but no subsequent mutation is started. Local checkpoints remain resumable.
- Delete Book is blocked if any external reference remains, including references added after preview. Reference-scan failure also blocks deletion. Entire deletion subtrees (including fragment archives) are checked.
- Reading Desk publishes its active comment/Mark features. Removed all cleanup calls and property traps that controlled Folio.
- Regression suite: `npm ci`, `npm run build`, `npm test`.

# Changelog

## 0.7.4

- 修复 Notes 中 Sidebar 按钮被长页面标题挤窄、文字拆行的问题；按钮完整显示，长标题自动省略，悬停可查看完整标题。

## 0.7.3

- 修复同一块多条评论之间的异常留白：每次排列重新测量卡片高度，字体、换行和图片引起的高度变化也会触发布局更新；卡片间距保持 8px。
- 修复点击评论滑动中途被排队刷新打断，以及连续点击时旧计时器提前结束动画的问题。被点击评论与原文对齐，上方评论平滑上移。
- 点击评论只滚动定位它所在位置的原文，避免同一内容多处显示时重复触发滚动。

## 0.7.2

- 修复：评论卡片有时不再滑动对齐。原因是 Folio 比 Reading Desk 晚加载时，会启动它自带的旧版评论旁注，把我们的卡片换成不会滑动对齐的旧卡片；之前只在 Reading Desk 启动时停掉 Folio 的这一份。现在 Folio 什么时候启动它都会被立即停掉，页面上出现的旧卡片也会被换回 Reading Desk 的卡片。

## 0.7.1

- 切换语言时，Roam 设置页（Settings → Reading Desk）与阅读面板、顶栏按钮一起立即切换，不再需要重新加载插件。语言选项显示为语言名称（Auto、English、Français、Italiano、Deutsch、Español、中文）。
- 补上漏翻译的文字：All Books 列表中的 Page / Book、Notes 标签里的 “Earlier”、导入预览中的 EPUB 警告，以及设置里的 “Interface language”。
- README 替换为多语言单文件版本；移除测试与开发辅助文件。

## 0.7.0

- 界面多语言：English、Français、Italiano、Deutsch、Español、中文。默认跟随浏览器语言，可在面板 Settings → Language 或 Roam 设置中的 Reading Desk 标签选择。阅读面板、导入与书籍管理窗口、旁注卡片、Mark It 菜单、提示与错误信息全部翻译；命令面板中的命令名保持英文。
- README 改为英文主版本，另附法语、意大利语、德语、西班牙语和中文版本，开头提示多语言并介绍 Folio 与 Version Studio。
- 功能与行为没有其他改动。

## 0.6.6

- 视频时间戳笔记（`{{[[video-timestamp]]: ((视频)) 00:00:00}}`，包括后面带文字的）虽然以原生评论的形式存储，但不再作为旁注卡片显示，也不计入折叠提示和 Annotations。

## 0.6.5

- 移除子块旁注（#.aside / #.aside-left）功能：包括设置项、快捷键、右键菜单和 New Side Note 命令。原生评论旁注不变，仍按 Folio 边注的位置和方式显示。已经打了 #.aside 标签的块不会被改动；如果 Folio 的页边旁注仍开着，Folio 会继续按它自己的方式显示这些块。

## 0.6.4

- 评论卡片的日期永远显示：宽度够时显示 “2026/11/07 18:47”，不够时改为短日期 “11/07”（同时去掉时间和年份）；再窄也保留短日期，按钮缩小让位。

## 0.6.3

- 恢复 0.6.1 的旁注位置：只要页边留白 ≥ 64px（与 Folio 相同）就放在页边，正文不让位。0.6.2 改成 150px 后，开着侧边栏时又变成段落左移，已撤回。保留 0.6.2 的按钮改动：× 和 ↗ 在时间那一行最右边，卡片变窄时时间依次简化为 11/07 18:47 → 11/07 → 只留按钮，不会再重叠。

## 0.6.2

- 脚注标记接回标题：识别范围放宽。标记前面是标题（H1–H3、加粗标题或任一书目章节）时，标记接到标题末尾，标记下的段落移到标题下；前面是普通段落时，接到该段末尾，标记下的子块原位上移。也识别转义写法 `[\[3\]](((…)))`。修复结果会显示被跳过的块数。
- 评论卡片：× 和 ↗ 放进时间所在的那一行最右边，永远不会和时间重叠；卡片较窄时时间省略年份（11/07 18:47）。Minimal 样式里按钮浮在右上角，文字绕开。

## 0.6.1

- 宽屏文字窄：默认让正文铺满整行（到引用数为止），宽屏不再在文字和引用数之间留一大块空白；评论旁注改用 Folio 边注的算法，放在正文区之外的留白里（正文内容区右缘 + 18px，最宽 240px），正文宽度不变；留白不够时才回到原 Magazine 做法（只让有评论的段落让出右侧一条）。Settings → Reading → Text width 可改回主题原本的行宽。
- Repair This Book 新增：被旧版导入拆成单独标题块的脚注标记（如 “2.3 机构投资潜规则：洛克菲勒牡蛎” 下面的 “3”）放回标题末尾 `2.3 … [3](((注释)))`，原来挂在 “3” 下面的整节段落上移到标题下，注释里的返回链接改指向标题。可撤销。
- 评论卡片的删除（×）和打开（↗）改为同一行、默认显示、图标对齐；时间不再折行。

## 0.6.0

- 书籍修复合并成一项：Settings → Repair This Book。先列出这本书要改什么（标题层级、被做成标题的脚注标记、坏掉的编号链接、残留的 EPUB-READER:paragraph-fragments），一键全部修复，一个 Undo 全部恢复。想同时拼回被拆开的段落，可选择原 EPUB（可选，只在本地读取）。以前单独做过的修复仍可在“Undo a repair made with an earlier version”里撤销。
- EPUB-READER:paragraph-fragments 之前删不掉，是因为脚注的返回链接 `[↩](((旧片段)))` 或评论还指向旧片段。现在修复时把这些引用改指向已拼好的段落，再删除存档。
- 目录：旧版书目里记录成章节的脚注标记（如 `[3](((uid)))`）不再显示；修复后这类标题改为普通文字。
- 评论卡片新增删除按钮（×，在 ↗ 左边，悬停显示）：删除这条评论；如果该段落没有其他评论，连同 roam/comments 里引用段落的那个块一起删除。原文段落不动。
- 读书笔记：生成时的时间链接到当天的 Daily Notes（`Reading notes · [[November 7th, 2026]] 14:23`）。顶部不再放 Reading Notes 按钮，改为在 Settings 旁边新增 Notes 标签：顶部是笔记页面入口，下面按天折叠列出生成过的笔记，点开显示当天内容，点条目跳到原文。生成后仍自动在右侧边栏打开。
- Manage Imported Books / 导入窗口改用与阅读面板一致的纸色配色。

## 0.5.1

- 修复：宽屏（收起左右侧边栏）时旁注被放到行尾之外，正文和旁注之间留一大块空白。原因是“正文右边界”取的是页面里最宽的那一行：只要有一个通栏的标题、图片、表格或 Linked References 里的块，就判定正文“没有留白”，引用数也不再拉回文字旁边。现在按大多数段落结束的位置判断，比正文宽的行当作障碍，旁注从它下方绕过。

## 0.5.0

- 与 Folio 的冲突：Folio 自带一份旧版评论旁注，和 Reading Desk 用同一个全局名，会把我们的替换掉（旧卡片、block reference 评论显示成空白/“Comment”、`folio-comment-room` 给正文加 244px 右内边距挤占文字）。现在改用独立名字，开启旁注时自动停掉 Folio 那份并去掉它的内边距。
- 新增子块旁注（照搬 Folio 的 #.aside 写法）：子块打 `#.aside` 放右侧留白、`#.aside-left` 放左侧留白，正文宽度不变；放不下时原地小号显示。右键圆点 Side Note: Right / Left / Remove；快捷键新建旁注（默认 Alt+A）。评论卡片遇到右侧旁注会绕开。
- 快捷键全部可自定义（面板 Settings → Keyboard Shortcuts，点一下再按新组合键）：Toggle Mark、Toggle Question、新建右/左旁注、开关面板、继续阅读、打开读书笔记。由插件自己在最前面处理，Option+M 不再输入 “µ”，也不会和 Folio / Roam 重复触发。
- 目录不再收录被做成标题的脚注标记（如 `[3](((uid)))`、`[12]`、`注3`、`*`）；Heading Repair 把它们改回普通文字（不加粗）。纯数字章节名如 “3”“IV” 仍保留。
- 点击目录标题：标题被折叠时一定展开（读最新状态）；只展开真正折叠的上级块，不再重写已展开的块，减少普通页面乱跳；标题定位到视口上方，并在图片加载导致位移时校正。
- 面板始终显示 Reading Notes 链接，页面不存在时点击即创建（带 Source:: 链接回书）。生成读书笔记后自动打开：默认侧边栏，侧边栏没打开成功就改在主窗口打开；可在 Settings → Reading Notes 选择。
- Manage Books 新增 Remove Images：删除书中的图片但保留书。图片嵌入从文字中去掉，只有图片的块被删除（有文字、子块或被引用的块保留），只被这本书使用的已上传文件一并删除（可取消勾选）。

## 0.4.11

- 旁注颜色改为逐色调好的一套：背景、悬停背景、细边框、选中边框、强调色、文字和时间颜色各自搭配，不再用同一个颜色按比例混出来。六种：Gold、Gray、Blue、Green、Rose、Purple。

## 0.4.10

- Side note order 的倒序只把同一段落下的卡片顺序反过来（C1 C2 C3 → C3 C2 C1），第一张仍与段落顶部对齐。切换顺序时清除之前点击造成的对齐，不再让整组卡片往上移。

## 0.4.9

- 修复：点击旁注到位后外框反复闪烁几秒。原因是鼠标移动、编辑等引起的页面变化会让旁注整组重建，被选中的卡片每次重建都重播一次边框动画。现在卡片在内容不变时原样复用，只更新位置。

## 0.4.8

- 旁注样式只保留 Cards（默认，原名 Notion cards）和 Minimal；去掉 Magazine 原版样式，之前选了它的自动改用 Cards。
- 旁注颜色同时用于卡片背景（淡色）和边框。
- 点击旁注后的移动更顺：卡片改用 transform 平移，不再每帧重排页面；滚动期间暂停重绘和数据刷新。
- 疑问标签默认只有 question（未改动过默认值的设置会自动更新；自定义过的保持不变）。
- Settings 里 Mark style 移到独立的 Mark It 分组。

## 0.4.7

- Mark style 去掉 Classic（原版）。默认改为 Margin dot + bold（页边金点 + 加粗）；之前选了 Classic 的会自动用这个默认样式。
- 页边金点放在文字框内侧右边，不再和引用数「1」重叠。

## 0.4.6

- Mark It 七种样式全部加入，Settings → Highlights → Mark style 选择：Classic（原版，默认）、Bookmark ribbon（书签角标）、Gold highlighter（金色荧光下划）、Margin dot + bold（页边金点）、Pull quote（杂志引文）、Sticky note（便签卡片）、Ink emphasis（墨色强调）。
- 旁注卡片去掉作者名和头像，只显示编辑时间。

## 0.4.5

- 同一段落的多条评论分成多张卡片（Notion 式），不再合并在一张卡里。
- 卡片显示编辑时间，格式如 2020/01/01 16:08。
- 点击卡片：该卡片与所属段落顶部对齐，上方的卡片往上推，页面滚动把段落带到视图顶部。点击段落则对齐它的第一张卡片。
- Settings → Native Comments 新增 Side note order：按时间正序（Oldest first，默认）或倒序（Newest first）。

## 0.4.4

- 旁注默认改为 Notion 风格：白色圆角卡片、细边框和轻阴影，每条评论有头像首字母、作者名和日期，正文用界面字体。
- Settings → Native Comments 新增 Side note style（Notion / Magazine 原版 / Minimal）和 Side note colour（Gold / Gray / Blue / Green / Rose / Purple）。原版样式的悬停蓝色改为所选颜色。
- Mark It 去掉星标：#mark 仍保留在文字里（Alt+M 切换），阅读时隐藏。新的 Mark 样式方案见 mark-it-concepts.html，选定后再实现。

## 0.4.3

- 利用文字右侧的空白：主题限制了正文宽度，而 Roam 的块行仍占满整篇文章，中间留下一大片空白（引用数「1」被推到最右）。有评论的页面里，引用数改为紧跟文字，旁注从文字和引用数之后开始，不再浪费这段空间。
- 这种布局下，已 Mark 段落的原样式（金色渐变与右侧金边）画在文字框上，止于文字处。
- 旁注顶部与段落顶部对齐（去掉原来的 6px 下移）。

## 0.4.2

- 旁注恢复原 Magazine 的留白规则和原样式：评论样式与 Mark 样式按用户提供的源码原样打包（附校验值），Reading Desk 的新增样式放在之后的单独文件里。
- 留白够（右侧空白 ≥ 约 64px 可放）时旁注放在文字右边界与主窗口右边界之间；不够时只让有评论的段落左移、旁注嵌入；先预留再测量，不再错位。
- 旁注全文显示时，若长旁注向下延伸到下一段，下一段也一起左移，不再压住文字；宽度不变时这些预留保持不动，避免抖动。
- 被旁注嵌入的已 Mark 段落，金色底和右侧金边停在文字处，不再伸到旁注下面。
- Mark 默认恢复原样式（Classic），Settings → Highlights → Mark style 可改为 Highlighter（金色荧光下划线）。星标保持 Roam 图标同风格的实心星。
- 去掉 0.4.1 的按段落内容右边界（含引用数）计算位置的做法，改回按文章文字边界计算。

## 0.4.1

- 修复：打开侧边栏等宽度不够时，正文宽度来回跳。旁注排版的判断在不加留白的状态下测量一次，之后宽度变化不到 40px 就沿用，不会再被自己的调整推翻。
- 旁注位置：右侧留白够宽（大屏，或笔记本关闭左右侧边栏）时，旁注放在留白里，紧挨文字和引用数（那个 1）之后；不够宽时，只把有评论的那一段向左收窄，旁注嵌在空出来的位置；更窄才放到段落下方。不再收窄整篇文章。
- 旁注不再使用蓝色：选中的旁注改为金色边，点击旁注时段落只短暂闪一下浅金色。
- Mark It 恢复原来的右侧样式并加强：从左往右渐浓的金色底、右侧金边和柔光、加粗，画在文字上，不再画左边那条竖线。星标改成 Roam 图标同风格的实心扁平星。
- 顶部图标改用 Roam 同款实心 Blueprint 书本图标，尺寸和颜色跟随旁边的图标。
- 目录第四层导入为加粗文字，更深层级保持普通文字；Contents 只显示前三层。Fix Heading Levels 对旧书同样处理。

## 0.4.0

- 插件文件夹改名为 reading-desk（Roam 开发者扩展以文件夹名显示）。内部图谱元数据路径不变，旧书、进度和备份无需迁移。
- 顶部图标按相邻图标尺寸缩小（约 14px，按钮 24px）。
- 旁注重做：评论全文展开、向下堆叠互不重叠；点击旁注或其段落，该旁注与段落对齐，其余旁注上下让位（Notion 式），离屏时自动滚到段落。↗ 打开原生评论线程编辑。评论的子块一并显示。
- 修复旁注错位：窄窗口时在文章层级统一预留旁注栏后再测量位置，不再逐段改宽度导致错位和页面跳动；Mark 的右侧样式不再盖住旁注栏。
- 评论用块引用 ((uid)) 写时显示被引用的内容（旁注与面板），支持别名、embed，最多三层。
- 折叠标签同时统计隐藏的评论、高亮与 Mark，例如 "5 comments · 2 highlights · 1 mark"。
- Mark It：改为左侧金色书签条 + 圆角渐变星标；评论激活改用冷色底，二者不再重叠。修复快捷键和菜单点击 Mark It 后又被撤回：编辑中直接写入 Roam 的输入框，不再与 Roam 失焦保存竞争。
- 高亮颜色可选（Coral 默认 / Rose / Mint / Sky / Lilac / 主题默认）与样式（荧光笔 / 下划线），黄色主题下也清晰。
- 疑问支持属性写法 Question:: …（以及任何疑问标签加 ::，大小写不敏感）；Alt+Q 可设为插入标签或属性。
- 目录只识别 H1/H2/H3：普通页面按标题级别建立目录（嵌套与平铺页面都可），标题之后的段落归入该标题。点击普通页面目录只滚动，不再折叠/展开你的块，并在图片等加载后校正一次位置，减少乱跳。
- 新导入：EPUB 目录条目按深度写成 H1/H2/H3（更深仍为 H3）；正文中不是目录的标题改为粗体段落；与目录同名（忽略空格、标点，或拆成两个标题）的正文标题不再重复导入。
- Book Repairs 新增 Fix Heading Levels：旧书章节按目录深度设为 H1–H3、移除重复章节名标题（子段落上移、UID 不变）、其他正文标题改粗体；可分项勾选、预览、备份、撤回。
- Book Repairs 新增清理 EPUB-READER:paragraph-fragments 恢复区：仅移除片段没有评论、引用和子块的恢复区；备份并可撤回。
- 面板：目录行固定三栏，有无子目录的标题左对齐；每章可 ✓ Mark as Read；Recap 合并到 Contents 顶部的 Last read 卡片；显示 Reading Notes 链接；切换书籍时主页面同时跳转到该书。
- 新增 All Books 范围：汇总所有书籍与你手动加入的普通页面（Include in All Books）的批注和疑问。
- Reading Notes 生成后在右侧栏打开，并在笔记页顶部写入 Source:: [[原书页面]]，原书页面的 Linked References 可见。

## 0.3.3

- 换为宽幅 18px 原生打开书本图标，跟随主题颜色。
- Contents 根据主阅读区可见正文突出当前章节；折叠时突出可见父目录，不改变用户目录折叠、不自动滚动面板或修改图谱；关闭进度记录也生效。
- Settings 补齐 Library 与标记／疑问快捷操作入口，沿用原导入、管理、恢复和标记实现；操作前显示所选块，不默认修改第一段。
- 内部清单与阅读记录页按 UID 和记录标记发现，支持误改名与更换扩展身份；保存继续复用原页，恢复书籍时排除改名的内部页。

## 0.3.2

- 原文定位保留承载页面，展开目标祖先、滚动并短暂高亮，不再单块缩放或进入编辑；Continue Reading 命令直接返回最近段落。
- 增加面板子目录折叠／展开，与书籍正文折叠分开；关闭、重绘后保留本次会话的目录状态。
- 标题栏可拖动，限制在可见屏幕内，本次会话重新打开时保留位置。
- 增加独立 Settings 标签页，自定义疑问识别标签及 Alt+Q 快捷疑问标签；将全局设置从 Contents 移到 Settings。
- 修复入口收进 Settings → Maintenance → Book Repairs；顶部图标使用主题已有的 Blueprint 原生书籍图标，取消自绘细线图标。
- 导入器、阅读面板、管理器、进度、提示和错误信息统一为英文；保留既有中文书籍内容和标签匹配兼容。
- 新增旧段落拆分修复：本地选择原 EPUB 核对完整原文，先预览再执行；保留原片段 UID、文字、评论和外部引用于折叠恢复区，不重导或重传图片。
- 段落修复先完整备份并预留恢复区 UID，支持中断后撤回；跳过歧义匹配、子笔记和后续编辑；合并展示原片段评论并迁移阅读位置。

## 0.3.1 · Reading Desk

- 更名为 Reading Desk，所有命令／设置入口统一使用此名称；保留原有图谱登记、阅读进度和附件命名空间，不要求重导。
- 移除左下角悬浮 Reader，改为顶部栏原生尺寸的图标；点击才打开面板，支持再次点击关闭。
- 阅读面板使用 Shadow DOM 隔离主题样式，固定头部／选择器／标签页／状态栏，只有内容区滚动，修复长目录下控件挤压重叠和无法点击。
- 确认范围时取消过期刷新并防止重复提交；编辑时不强制重建控件；切换标签页重置滚动，避免搜索框藏在上方。
- 长目录的 Confirm Book Scope 按钮固定在底部，选择器箭头使用固定尺寸、垂直居中并统一右侧间距。
- 原样恢复用户提供的评论及 Mark CSS（附固定校验值），使用原始 Magazine 类名、卡片、折叠计数与布局算法；和旧脚本共用单实例，避免重复计数。
- 旧书目录视图移除章节内重复的同名标题，不改正文、原 UID 或明确的原 EPUB 目录；合并旧进度，重置后不从重复标题恢复旧进度。
- 补查导航 API 调用上下文、已删除目标的提示、上一章折叠失败阻断跳转、修复按钮出错后无法重试等问题。

## 0.3.0

- 新增可移动、可最小化的阅读面板：Contents、Annotations、Questions、Recap、Repair。普通页面按需打开；被管理书籍可自动记录浏览位置。
- 汇总原生高亮、原生评论、#mark；按章节／类型／文字筛选并分页，定位原文或打开原生侧边栏，不展开整本书来获取批注。
- 整合用户提供的 Magazine 原生评论旁注、快速 Mark JS 和配套样式。原生评论保持原样，Alt+M 和原生块菜单使用现有 #mark。
- 支持非顺序跳读：每章独立浏览范围与位置，只累计前台停留的正文块，快速滚动、后台与长时间无操作不计；可以关闭或重置。
- 阅读状态独立分块保存，双缓冲提交，避免滚动时重写附件账本或不断增长历史快照。
- 批注可勾选生成按章节分组的引用式笔记初稿，只追加、不覆盖；疑问复用 TODO 和现有标签；继续阅读可查看上次章节和疑问。
- 不增加母块。新书登记章节 UID；旧书一次确认已有章节范围，不重导、不改块 UID、不修改评论／高亮。整本移动或合并页面后跟随章节入口。
- 删除书籍只删除确认的章节子树，不删除承载页面；保留页面顶层原生评论、独立笔记、共用／归属未知附件。章节内含评论存储时阻止删除以保护评论。
- 修复新导入的脚注编号转义和行内锚点拆段；旧书修复需先预览确认，完整备份后处理，支持撤回且不覆盖后续编辑。旧段落不自动合并。
- 继续保留 0.2.x 书籍登记、公式、图片、链接和断点续传；全部命令使用英文。

## 0.2.1

- 将书籍管理清单保存在图谱中，避免更换开发者扩展文件夹或安装身份后丢失识别；旧设置记录自动迁移，页面改名后按 UID 继续识别。
- 新增 Recover Existing Book：不重导书籍、不改正文、不上传图片，找回已存在的书籍页面。缺少原始上传清单的附件标记为归属未知并保留。
- 清单采用分块附件记录和提交后生效的快照；中断写入不替换上一份完整记录，删除标记防止旧设置把已删除书籍重新登记。
- 清理附件时排除清单本身的 URL 记录，仍保护真正的书外引用及共用附件；删除前重新检查引用。
- 所有命令面板命令、设置页入口名称改为英文。

## 0.2.0

- 新增公式转换：MathML、LaTeX 注释、MathJax 源码脚本、预渲染 KaTeX，以及常见 LaTeX 分隔符。
- 将分式、上下标、根号、求和、矩阵等常见结构转换成 Roam 的 `$$…$$` 语法，并在本地用 KaTeX 校验。
- 图片公式按原图保留，行内公式保持在原段落中；显示公式保持独立块。
- 导入前展示公式计数、可展开预览和需核对提示；不能转换的公式保留完整原文在下级块中。
- 区分价格符号、代码示例和公式，去除预渲染公式的重复可见／辅助阅读副本。

## 0.1.2

- 使用用户提供的《穷查理宝典》完成整本目录、文字、图片引用和顺序对照。
- 按 EPUB 阅读顺序保留跨文件章节，目录页之后的前置图文单独归位。
- 直接创建原生 Roam 块，避免 Markdown 再解析把数字段落和图片重排。
- 每个块使用预先保存的独立 UID，支持写入中断后继续且不产生重复块。
- 本地书籍缓存与进度分开保存，避免对约 49 MB 的书反复写入整本图片数据。
- 构建仅生成 Roam 插件，不修改网站文件。

## 0.1.1

- 修复同一 XHTML 文件包含多章时正文全部归入第一章的问题，改按目录文件链接及锚点划分。
- 原样保留 NAV / NCX 的目录名称、顺序和完整层级，不再按相似标题删除目录项目。
- 正文只按 DOM 顺序遍历一次，修复独立图片丢失、图注和引用重复、列表段落丢失的问题。
- 支持 SVG 包装图片、空锚点、容器锚点、跨文件续页；无法定位的目录会显示提示并单列相关正文。
- 导入前展示完整原目录和可展开的图文顺序；禁止继续使用旧版错误解析任务。
- 网站与插件共用同一解析器。

## 0.1.0

- 首个可用版本。
- 按 EPUB 数字目录和章节层级直接导入 Roam。
- 自动上传正文引用的图片，并保留外部链接和书内跳转。
- 支持章节级断点续传。
- 管理已导入书籍，并仅删除确认未被复用或引用的附件。
