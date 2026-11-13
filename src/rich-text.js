// Read-only rendering of Roam block strings for side notes and the panel.
// Block references are resolved to the referenced text so a comment written as
// ((uid)) is readable instead of blank. Nothing here writes to the graph.
import { api } from "./graph.js";

const REF = /\(\(([^()\s]+)\)\)/g;
const blockString = uid => {
  try { return api().data.pull("[:block/string]", [":block/uid", uid])?.[":block/string"] ?? null; } catch { return null; }
};

export function resolveRefs(text, depth = 0, seen = new Set()) {
  let value = String(text || "");
  // Aliases [label](((uid))) show their label; embeds show the embedded text.
  value = value.replace(/\[([^\]]+)\]\(\(\(([^()\s]+)\)\)\)/g, "$1");
  value = value.replace(/\{\{\s*(?:\[\[)?embed(?:-path|-children)?(?:\]\])?\s*:\s*\(\(([^()\s]+)\)\)\s*\}\}/gi, "(($1))");
  return value.replace(REF, (match, uid) => {
    if (depth >= 3 || seen.has(uid)) return "…";
    const target = blockString(uid);
    if (target == null) return "(missing block)";
    return resolveRefs(target, depth + 1, new Set([...seen, uid]));
  });
}

export function plainText(text) {
  return resolveRefs(text)
    .replace(/\{\{\[\[TODO\]\]\}\}/g, "☐ ").replace(/\{\{\[\[DONE\]\]\}\}/g, "☑ ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[image]")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/#?\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*|__|\^\^|~~|`/g, "")
    .replace(/\s+/g, " ").trim();
}

// Tiny inline renderer: bold, italic, highlight, strike, code, page links and
// tags. Unknown markup stays as plain text; output is built with textContent.
const TOKEN = /(\*\*([^]+?)\*\*)|(__([^]+?)__)|(\^\^([^]+?)\^\^)|(~~([^]+?)~~)|(`([^`]+)`)|(!\[[^\]]*\]\([^)]*\))|(\[([^\]]+)\]\(([^)]+)\))|(#?\[\[([^\]]+)\]\])|((?:^|(?<=\s))#([\p{L}\p{N}_\-/.]+))|(\{\{\[\[(TODO|DONE)\]\]\}\})/gu;
function appendInline(parent, text, doc) {
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > last) parent.append(doc.createTextNode(text.slice(last, match.index)));
    last = match.index + match[0].length;
    const wrap = (tag, cls, inner) => { const node = doc.createElement(tag); if (cls) node.className = cls; appendInline(node, inner, doc); parent.append(node); };
    if (match[1]) wrap("strong", "", match[2]);
    else if (match[3]) wrap("em", "", match[4]);
    else if (match[5]) wrap("mark", "rd-rich-highlight", match[6]);
    else if (match[7]) wrap("s", "", match[8]);
    else if (match[9]) { const code = doc.createElement("code"); code.textContent = match[10]; parent.append(code); }
    else if (match[11]) { const image = doc.createElement("span"); image.className = "rd-rich-muted"; image.textContent = "[image]"; parent.append(image); }
    else if (match[12]) wrap("span", "rd-rich-link", match[13]);
    else if (match[15]) { const page = doc.createElement("span"); page.className = "rd-rich-page"; page.textContent = match[16]; parent.append(page); }
    else if (match[17]) { const tag = doc.createElement("span"); tag.className = "rd-rich-tag"; tag.textContent = `#${match[18]}`; parent.append(tag); }
    else if (match[19]) parent.append(doc.createTextNode(match[20] === "DONE" ? "☑ " : "☐ "));
  }
  if (last < text.length) parent.append(doc.createTextNode(text.slice(last)));
}

export function renderRich(text, doc = document) {
  const fragment = doc.createDocumentFragment();
  appendInline(fragment, resolveRefs(text).replace(/\s+\n/g, "\n"), doc);
  return fragment;
}
