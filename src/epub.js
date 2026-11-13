import { unzip } from "fflate";
import { convertDelimitedMath, finalizeMath, prepareMathDocument } from "./math.js";
import { t } from "./i18n.js";

const FLOW_BLOCKS = new Set(["p", "div", "section", "article", "aside", "header", "footer", "main", "body", "blockquote", "pre", "li", "ul", "ol", "figure", "figcaption", "table", "tr", "dl", "dt", "dd", "h1", "h2", "h3", "h4", "h5", "h6"]);
const OMIT = new Set(["script", "style", "head", "noscript", "template"]);

function decodeBytes(bytes) {
  if (bytes?.[0] === 0xff && bytes?.[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes?.[0] === 0xfe && bytes?.[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

function normalizePath(value) {
  let path = (value || "").split("#")[0].split("?")[0];
  try { path = decodeURIComponent(path); } catch { /* retain malformed escape */ }
  const parts = [];
  path.split("/").forEach(part => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}

function resolvePath(baseFile, href) {
  if (!href) return "";
  const clean = href.split("#")[0].split("?")[0];
  const base = baseFile.includes("/") ? baseFile.slice(0, baseFile.lastIndexOf("/") + 1) : "";
  return normalizePath(clean.startsWith("/") ? clean : base + clean);
}

function resolveTarget(baseFile, href) {
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return "";
  const hashAt = href.indexOf("#");
  const rawPath = hashAt >= 0 ? href.slice(0, hashAt) : href;
  let fragment = hashAt >= 0 ? href.slice(hashAt + 1) : "";
  try { fragment = decodeURIComponent(fragment); } catch { /* retain malformed escape */ }
  const path = rawPath ? resolvePath(baseFile, rawPath) : normalizePath(baseFile);
  return fragment ? `${path}#${fragment}` : path;
}

function parseXml(text, label) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error(t("Could not parse {0}", [label]));
  return document;
}

const cleanText = value => (value || "").replace(/\s+/g, " ").trim();
const tagOf = element => element.localName?.toLowerCase() || "";
const escapeLinkLabel = value => value.replace(/([\\\[\]])/g, "\\$1").trim();

function shortHash(value) {
  let a = 2166136261;
  let b = 5381;
  for (let index = 0; index < value.length; index++) {
    a = Math.imul(a ^ value.charCodeAt(index), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(index);
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`.slice(0, 12);
}

async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function guessMediaType(path) {
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif" })[path.split(".").pop()?.toLowerCase()] || "application/octet-stream";
}

function imageToken(element, sourcePath, context) {
  const tag = tagOf(element);
  const src = tag === "object" ? element.getAttribute("data") : tag === "image" ? element.getAttribute("href") || element.getAttribute("xlink:href") : element.getAttribute("src") || element.getAttribute("data-src");
  if (!src) return "";
  if (/^(?:https?:)?\/\//i.test(src)) return `![](${src.replace(/\s/g, "%20")})`;
  if (/^[a-z][a-z\d+.-]*:/i.test(src) && !src.startsWith("data:image/")) return "";
  const path = src.startsWith("data:image/") ? src : resolvePath(sourcePath, src);
  let image = context.images.get(path);
  if (!image) {
    image = { id: `i${context.images.size}`, path, alt: element.getAttribute("alt") || "Illustration" };
    context.images.set(path, image);
  }
  return `⟦EPUBI:${image.id}⟧`;
}

// A single DOM-order walk is essential: selecting containers and descendants
// independently duplicates text and moves images outside their source paragraph.
function htmlToFlow(bytes, sourcePath, context) {
  const source = decodeBytes(bytes);
  const document = new DOMParser().parseFromString(source, "text/html");
  const mathScripts = [...document.querySelectorAll('script[type^="math/"]')];
  if (mathScripts.length) {
    // XHTML scripts encode &, <, etc. as XML entities. HTML parsing treats a
    // script body as raw text; read its XML-decoded source when it is valid XML.
    const xml = new DOMParser().parseFromString(source, "application/xhtml+xml");
    if (!xml.querySelector("parsererror")) {
      const originals = [...xml.getElementsByTagNameNS("*", "script")].filter(script => /^math\//.test(script.getAttribute("type") || ""));
      mathScripts.forEach((script, index) => { if (originals[index]) script.textContent = originals[index].textContent; });
    }
  }
  const mathContext = { ...context, sourcePath };
  prepareMathDocument(document, mathContext);
  const blocks = [];
  const anchors = new Map([[sourcePath, 0]]);
  let buffer = "";
  let mode = { kind: "paragraph" };
  const flush = () => {
    const text = cleanText(mode.literal ? buffer : convertDelimitedMath(buffer, mathContext));
    if (text) blocks.push({ text, ...mode, sourcePath, targetKeys: [], children: [] });
    buffer = "";
  };
  const addAnchor = element => {
    const names = [element.id, tagOf(element) === "a" ? element.getAttribute("name") : ""].filter(Boolean);
    if (!names.length) return;
    // Inline footnote IDs point at their containing paragraph, not a new
    // paragraph. Only actual TOC split boundaries may cut an inline flow.
    const isTocBoundary = names.some(id => context.tocTargets?.has(`${sourcePath}#${id}`));
    if (!element.closest("[data-epub-math-inline]") && (FLOW_BLOCKS.has(tagOf(element)) || isTocBoundary)) flush();
    names.forEach(id => anchors.set(`${sourcePath}#${id}`, blocks.length));
  };
  const inline = element => {
    const tag = tagOf(element);
    if (OMIT.has(tag)) return "";
    if (["img", "image", "object"].includes(tag)) return imageToken(element, sourcePath, context);
    if (tag === "br") return " ";
    const inner = [...element.childNodes].map(child => child.nodeType === 3 ? child.nodeValue : child.nodeType === 1 ? inline(child) : "").join("");
    if (tag === "a") {
      const href = (element.getAttribute("href") || "").trim();
      if (!href) return inner;
      const rawLabel = cleanText(convertDelimitedMath(inner, mathContext)) || href;
      const label = escapeLinkLabel(rawLabel);
      if (/^(?:https?:|mailto:|tel:|\/\/)/i.test(href)) {
        return inner.includes("⟦EPUBI:") ? `${inner} [Image link](${href.replace(/\s/g, "%20")})` : `[${label}](${href.replace(/\s/g, "%20")})`;
      }
      const targetKey = resolveTarget(sourcePath, href);
      if (!targetKey) return inner || label;
      const id = `l${context.links.length}`;
      const token = `⟦EPUBL:${id}⟧`;
      context.links.push({ id, token, targetKey, label: inner.includes("⟦EPUBI:") ? "Image link" : rawLabel });
      return inner.includes("⟦EPUBI:") ? `${inner} ${token}` : token;
    }
    if (tag === "strong" || tag === "b") return `**${inner}**`;
    if (tag === "em" || tag === "i") return `__${inner}__`;
    if (tag === "code") return `\`${inner}\``;
    return inner;
  };
  function walk(node) {
    if (node.nodeType === 3) { buffer += node.nodeValue; return; }
    if (node.nodeType !== 1) return;
    const tag = tagOf(node);
    if (OMIT.has(tag) || node.hasAttribute("hidden")) return;
    const block = FLOW_BLOCKS.has(tag);
    if (block) flush();
    addAnchor(node);
    const previousMode = mode;
    if (/^h[1-6]$/.test(tag)) mode = { kind: "heading", rank: Number(tag.slice(1)) };
    else if (block) mode = { kind: tag === "figure" ? "image" : "paragraph", ...(tag === "pre" ? { literal: true } : {}) };

    // Recurse through containers, but serialize an inline link/format once.
    // TOC anchors inside inline elements must remain real split boundaries.
    if (["a", "strong", "b", "em", "i", "code"].includes(tag) && !node.querySelector("[id],a[name],p,div")) {
      buffer += inline(node);
    } else if (["img", "image", "object"].includes(tag)) {
      buffer += imageToken(node, sourcePath, context);
    } else if (tag === "br") {
      buffer += " ";
    } else if (tag === "svg" && !node.querySelector("image")) {
      const path = `${sourcePath}#inline-svg-${context.images.size}.svg`;
      const id = `i${context.images.size}`;
      context.images.set(path, { id, path, alt: "Vector illustration", bytes: new TextEncoder().encode(node.outerHTML), mediaType: "image/svg+xml" });
      buffer += `⟦EPUBI:${id}⟧`;
    } else {
      [...node.childNodes].forEach(walk);
    }
    if ((tag === "td" || tag === "th") && cleanText(buffer)) buffer += " | ";
    if (block) { flush(); mode = previousMode; }
  }
  walk(document.body);
  flush();
  anchors.forEach((offset, key) => {
    if (blocks.length) blocks[Math.min(offset, blocks.length - 1)].targetKeys.push(key);
  });
  return { blocks, anchors: new Map([...anchors].map(([key, offset]) => [key, Math.min(offset, Math.max(0, blocks.length - 1))])) };
}

function parseNav(bytes, navPath) {
  const document = new DOMParser().parseFromString(decodeBytes(bytes), "text/html");
  const navs = [...document.querySelectorAll("nav")];
  const toc = navs.find(nav => /(^|\s)(toc|doc-toc)(\s|$)/i.test([nav.getAttribute("epub:type"), nav.getAttribute("type"), nav.getAttribute("role")].filter(Boolean).join(" ")));
  // A landmarks/page-list nav is not the book's chapter directory.
  if (!toc && navs.length !== 1) return [];
  const selected = toc || (navs[0] && !/landmarks|page-list/.test(navs[0].getAttribute("epub:type") || "") ? navs[0] : null);
  function readList(list) {
    return [...(list?.children || [])].filter(child => tagOf(child) === "li").map(item => {
      const labelRoot = [...item.children].find(child => !["ol", "ul"].includes(tagOf(child)));
      const anchor = tagOf(labelRoot || {}) === "a" ? labelRoot : labelRoot?.querySelector("a") || labelRoot;
      const nested = [...item.children].find(child => ["ol", "ul"].includes(tagOf(child)));
      const href = anchor?.getAttribute("href") || "";
      return { text: cleanText(labelRoot?.textContent) || "Untitled chapter", path: href ? resolvePath(navPath, href) : "", targetKey: resolveTarget(navPath, href), children: readList(nested) };
    });
  }
  return readList(selected?.querySelector("ol,ul"));
}

function parseNcx(bytes, ncxPath) {
  const document = parseXml(decodeBytes(bytes), "EPUB TOC");
  const navMap = [...document.getElementsByTagNameNS("*", "navMap")][0];
  function readPoint(point) {
    const label = [...point.children].find(child => child.localName === "navLabel");
    const content = [...point.children].find(child => child.localName === "content");
    const href = content?.getAttribute("src") || "";
    return { text: cleanText(label?.textContent) || "Untitled chapter", path: resolvePath(ncxPath, href), targetKey: resolveTarget(ncxPath, href), children: [...point.children].filter(child => child.localName === "navPoint").map(readPoint) };
  }
  return [...(navMap?.children || [])].filter(child => child.localName === "navPoint").map(readPoint);
}

const titleKey = text => cleanText(text).replace(/[\s\u3000·•:：.。,，、\-—–_|]/g, "").toLowerCase();

function headingTree(blocks) {
  const root = { children: [], rank: 0 };
  const stack = [root];
  blocks.forEach(block => {
    if (block.kind === "heading") {
      while (stack.length > 1 && stack.at(-1).rank >= block.rank) stack.pop();
      stack.at(-1).children.push(block);
      stack.push(block);
    } else stack.at(-1).children.push(block);
  });
  return root.children;
}

function assembleChapters(toc, documents, warnings, { directoryPaths = new Set(), coverPaths = new Set() } = {}) {
  const flow = [];
  const offsets = new Map();
  documents.forEach((document, path) => {
    document.anchors.forEach((offset, key) => offsets.set(key, flow.length + offset));
    flow.push(...document.blocks);
  });
  if (!toc.length) {
    warnings.push(t("No usable EPUB TOC was found. The outline uses body headings; review the preview."));
    return headingTree(flow);
  }
  const entries = [];
  const copy = items => items.map(item => {
    const node = { text: item.text, kind: "toc", sourcePath: item.path, targetKeys: item.targetKey ? [item.targetKey] : [], children: [] };
    entries.push({ item, node, position: offsets.get(item.targetKey), order: entries.length });
    node.children = copy(item.children);
    return node;
  });
  const chapters = copy(toc);
  const unresolvedPaths = new Set();
  entries.forEach(entry => {
    if (entry.item.targetKey && entry.position == null) {
      warnings.push(t("Missing TOC target for {0}: {1}. Unmatched text is kept separately.", [entry.item.text, entry.item.targetKey]));
      unresolvedPaths.add(entry.item.path);
    }
  });
  const boundaries = entries.filter(entry => entry.position != null).sort((a, b) => a.position - b.position || a.order - b.order);
  const boundariesAt = new Map();
  boundaries.forEach(entry => {
    if (!boundariesAt.has(entry.position)) boundariesAt.set(entry.position, []);
    boundariesAt.get(entry.position).push(entry);
  });
  // A body heading that repeats its TOC entry is redundant. Compare without
  // spaces/separators ("Preface  Title" = "PrefaceTitle"), and accept a
  // title split over consecutive headings ("Preface" + "Title").
  const redundant = new Map();
  boundariesAt.forEach((list, position) => {
    for (const entry of list) {
      const target = titleKey(entry.item.text); let joined = "";
      for (let index = position; index < Math.min(flow.length, position + 3) && flow[index].kind === "heading"; index++) {
        joined += titleKey(flow[index].text);
        if (!target.startsWith(joined)) break;
        if (joined === target) { if (index > position) for (let skip = position; skip <= index; skip++) redundant.set(skip, entry); break; }
      }
    }
  });
  const content = new Map(entries.map(entry => [entry.node, []]));
  const unassigned = [];
  let cursor = 0;
  let owner = null;
  flow.forEach((block, index) => {
    while (cursor < boundaries.length && boundaries[cursor].position <= index) owner = boundaries[cursor++];
    if (!owner || unresolvedPaths.has(block.sourcePath) || (directoryPaths.has(owner.item.path) && block.sourcePath !== owner.item.path)) {
      unassigned.push({ block, index, afterDirectory: owner && directoryPaths.has(owner.item.path) });
      return;
    }
    // Only an exact heading at its linked target is redundant. Text similarity
    // must never decide chapter membership or remove a source TOC entry.
    if (redundant.has(index)) {
      const entry = redundant.get(index);
      entry.node.targetKeys.push(...block.targetKeys);
      entry.node.sourceHeading ||= { text: block.text, sourcePath: block.sourcePath };
      return;
    }
    const matching = (boundariesAt.get(index) || []).filter(entry => titleKey(entry.item.text) === titleKey(block.text));
    if (matching.length && block.kind === "heading") {
      matching.at(-1).node.targetKeys.push(...block.targetKeys);
      matching.at(-1).node.sourceHeading = { text: block.text, sourcePath: block.sourcePath };
      return;
    }
    content.get(owner.node).push(block);
  });
  entries.forEach(entry => { entry.node.children.unshift(...headingTree(content.get(entry.node))); });
  if (unassigned.length) {
    // Keep omitted front matter and unresolved body content in reading order,
    // separately from the literal EPUB TOC rather than silently dropping it.
    const groups = [];
    unassigned.forEach(item => {
      if (!groups.length || groups.at(-1).at(-1).index + 1 !== item.index) groups.push([]);
      groups.at(-1).push(item);
    });
    // In particular, photos after the HTML contents page are front matter;
    // they must not become children of the contents page or move to the end.
    groups.forEach(group => {
      const first = group[0];
      const isCover = group.every(item => coverPaths.has(item.block.sourcePath));
      const label = isCover ? "Cover" : first.afterDirectory ? "Front matter" : first.index < (boundaries[0]?.position ?? Infinity) ? "Before contents" : "Unmatched content";
      const supplement = { text: label, kind: "supplement", children: headingTree(group.map(item => item.block)), targetKeys: [] };
      const next = entries.find(entry => chapters.includes(entry.node) && entry.position > first.index);
      if (next) chapters.splice(chapters.indexOf(next.node), 0, supplement);
      else chapters.push(supplement);
    });
  }
  return chapters;
}

function finalizeTargets(book) {
  const targetMarkers = {};
  let sequence = 0;
  const walk = nodes => nodes.forEach(node => {
    if (node.targetKeys?.length) {
      node.targetKeys = [...new Set(node.targetKeys)];
      node.targetMarker = `T${shortHash(node.targetKeys.slice().sort().join("|"))}_${sequence++}`;
      node.targetKeys.forEach(key => { targetMarkers[key] ||= node.targetMarker; });
    }
    walk(node.children || []);
  });
  walk(book.chapters);
  book.targetMarkers = targetMarkers;
  book.links.forEach(link => { link.targetMarker = targetMarkers[link.targetKey] || null; });
  return book;
}

function countNodes(nodes) {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children || []), 0);
}

export async function parseEpub(arrayBuffer, filename = "book.epub") {
  const rawFiles = await new Promise((resolve, reject) => unzip(new Uint8Array(arrayBuffer), (error, result) => error ? reject(error) : resolve(result)));
  const files = new Map(Object.entries(rawFiles).map(([path, bytes]) => [normalizePath(path), bytes]));
  const get = path => files.get(normalizePath(path));
  if (!get("META-INF/container.xml")) throw new Error(t("Invalid EPUB: META-INF/container.xml is missing"));
  const container = parseXml(decodeBytes(get("META-INF/container.xml")), "EPUB container");
  const rootfile = [...container.getElementsByTagNameNS("*", "rootfile")][0];
  const opfPath = normalizePath(rootfile?.getAttribute("full-path") || "");
  if (!get(opfPath)) throw new Error(t("The EPUB manifest is missing"));
  const opf = parseXml(decodeBytes(get(opfPath)), "EPUB manifest");
  const title = cleanText([...opf.getElementsByTagNameNS("*", "title")][0]?.textContent) || filename.replace(/\.epub$/i, "");
  const author = cleanText([...opf.getElementsByTagNameNS("*", "creator")][0]?.textContent);
  const manifest = new Map();
  [...opf.getElementsByTagNameNS("*", "item")].forEach(item => {
    manifest.set(item.getAttribute("id"), { path: resolvePath(opfPath, item.getAttribute("href") || ""), type: item.getAttribute("media-type") || "", properties: item.getAttribute("properties") || "" });
  });
  const spineElement = [...opf.getElementsByTagNameNS("*", "spine")][0];
  const spine = [...(spineElement?.children || [])].filter(item => item.localName === "itemref").map(item => manifest.get(item.getAttribute("idref"))).filter(Boolean);
  const navItem = [...manifest.values()].find(item => /(^|\s)nav(\s|$)/.test(item.properties));
  const ncxItem = manifest.get(spineElement?.getAttribute("toc")) || [...manifest.values()].find(item => item.type === "application/x-dtbncx+xml");
  let toc = [];
  let tocSource = "headings";
  if (navItem && get(navItem.path)) { toc = parseNav(get(navItem.path), navItem.path); if (toc.length) tocSource = "nav"; }
  if (!toc.length && ncxItem && get(ncxItem.path)) { toc = parseNcx(get(ncxItem.path), ncxItem.path); if (toc.length) tocSource = "ncx"; }
  const warnings = [];
  const links = [];
  const formulas = [];
  const imageRefs = new Map();
  const tocTargets = new Set();
  const collectTargets = items => items.forEach(item => { if (item.targetKey) tocTargets.add(item.targetKey); collectTargets(item.children); });
  collectTargets(toc);
  const context = { links, images: imageRefs, formulas, warnings, tocTargets };
  const documents = new Map();
  const contentItems = [...spine];
  const addTocDocuments = items => items.forEach(item => {
    if (item.path && !contentItems.some(candidate => candidate.path === item.path)) {
      const candidate = [...manifest.values()].find(candidate => candidate.path === item.path);
      if (candidate) { contentItems.push(candidate); warnings.push(t("TOC file is outside the EPUB reading order: {0}", [candidate.path])); }
    }
    addTocDocuments(item.children);
  });
  addTocDocuments(toc);
  contentItems.forEach(item => {
    if (item.path === navItem?.path || documents.has(item.path)) return;
    if (!get(item.path)) { warnings.push(t("Missing EPUB body file: {0}", [item.path])); return; }
    if (/xhtml|html/i.test(item.type)) documents.set(item.path, htmlToFlow(get(item.path), item.path, context));
  });
  const guides = [...opf.getElementsByTagNameNS("*", "reference")];
  const directoryPaths = new Set(guides.filter(item => item.getAttribute("type") === "toc").map(item => resolvePath(opfPath, item.getAttribute("href") || "")));
  const coverPaths = new Set(guides.filter(item => item.getAttribute("type") === "cover").map(item => resolvePath(opfPath, item.getAttribute("href") || "")));
  const chapters = assembleChapters(toc, documents, warnings, { directoryPaths, coverPaths });
  if (!chapters.length) throw new Error(t("No readable chapter content was found in the EPUB"));
  const manifestByPath = new Map([...manifest.values()].map(item => [item.path, item]));
  const assets = await Promise.all([...imageRefs.values()].map(async reference => {
    let bytes = reference.bytes || get(reference.path);
    let mediaType = reference.mediaType || manifestByPath.get(reference.path)?.type || guessMediaType(reference.path);
    if (reference.path.startsWith("data:image/")) {
      const match = reference.path.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
      if (match) {
        mediaType = match[1];
        try { bytes = match[2] ? Uint8Array.from(atob(match[3]), character => character.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(match[3])); } catch { /* report missing below */ }
      }
    }
    if (!bytes) { warnings.push(t("Missing EPUB image: {0}", [reference.path])); return { ...reference, missing: true, bytes: null, hash: null, mediaType }; }
    return { ...reference, bytes, hash: await sha256Hex(bytes), mediaType };
  }));
  const fileHash = await sha256Hex(new Uint8Array(arrayBuffer));
  const book = finalizeMath({
    parserVersion: 4, id: `epub-${fileHash.slice(0, 16)}`, fileHash, filename, title, author,
    chapters, toc, tocSource, warnings, links, assets, formulas, targetMarkers: {}
  });
  book.stats = {
    chapters: chapters.length, blocks: countNodes(chapters), images: assets.filter(asset => !asset.missing).length,
    links: links.length, tocEntries: countNodes(toc), formulas: formulas.length,
    formulasConverted: formulas.filter(formula => formula.status === "converted").length,
    formulasReview: formulas.filter(formula => formula.status !== "converted").length
  };
  return finalizeTargets(book);
}

export const epubInternals = { normalizePath, resolvePath, resolveTarget, shortHash, htmlToFlow, parseNav, parseNcx };
