import katex from "katex";

const tagOf = element => element.localName?.toLowerCase().replace(/^.*:/, "") || "";
const TEX_ENCODING = /(?:x-tex|x-latex|application\/tex|application\/latex)/i;
const CANDIDATES = 'math,script[type^="math/"],.katex,.katex-display,mjx-container,.MathJax,.MathJax_Display,[data-latex],[data-tex],.math';
const OPTIONS = { throwOnError: true, trust: false, maxExpand: 1000, maxSize: 20, strict: "ignore", output: "mathml" };
const SYMBOLS = {
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "varepsilon", "ϵ": "epsilon", "ζ": "zeta", "η": "eta", "θ": "theta", "ϑ": "vartheta", "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu", "ν": "nu", "ξ": "xi", "π": "pi", "ϖ": "varpi", "ρ": "rho", "ϱ": "varrho", "σ": "sigma", "ς": "varsigma", "τ": "tau", "υ": "upsilon", "φ": "varphi", "ϕ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega",
  "Γ": "Gamma", "Δ": "Delta", "Θ": "Theta", "Λ": "Lambda", "Ξ": "Xi", "Π": "Pi", "Σ": "Sigma", "Υ": "Upsilon", "Φ": "Phi", "Ψ": "Psi", "Ω": "Omega",
  "×": "times", "÷": "div", "·": "cdot", "⋅": "cdot", "±": "pm", "∓": "mp", "≤": "leq", "≥": "geq", "≠": "neq", "≈": "approx", "≡": "equiv", "≅": "cong", "∝": "propto", "∞": "infty", "∂": "partial", "∇": "nabla", "∑": "sum", "∏": "prod", "∐": "coprod", "∫": "int", "∬": "iint", "∭": "iiint", "∮": "oint",
  "∈": "in", "∉": "notin", "∋": "ni", "∅": "emptyset", "∪": "cup", "∩": "cap", "⊂": "subset", "⊆": "subseteq", "⊃": "supset", "⊇": "supseteq", "∀": "forall", "∃": "exists", "¬": "neg", "∧": "land", "∨": "lor", "→": "to", "←": "leftarrow", "↔": "leftrightarrow", "⇒": "Rightarrow", "⇐": "Leftarrow", "⇔": "Leftrightarrow", "↦": "mapsto", "…": "ldots", "⋯": "cdots", "⋮": "vdots", "⋱": "ddots", "ℝ": "mathbb{R}", "ℂ": "mathbb{C}", "ℕ": "mathbb{N}", "ℤ": "mathbb{Z}", "ℚ": "mathbb{Q}", "ℓ": "ell", "ℏ": "hbar"
};

function texCharacters(text) {
  return [...(text || "")].map(character => {
    if (SYMBOLS[character]) return `\\${SYMBOLS[character]} `;
    if (character === "−") return "-";
    if (character === "\u2061" || character === "\u2062") return "";
    if (character === "\u2063") return ",";
    if (character === "\u2064") return "+";
    if ("{}_$%&#".includes(character)) return `\\${character}`;
    if (character === "\\") return "\\backslash ";
    if (character === "~") return "\\sim ";
    if (character === "^") return "\\wedge ";
    return character;
  }).join("");
}

function textArgument(text) {
  return (text || "").replace(/[\\{}_$%&#~^]/g, character => ({ "\\": "\\textbackslash{}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" })[character] || `\\${character}`);
}

function variant(value, element) {
  const command = ({ normal: "mathrm", bold: "mathbf", "double-struck": "mathbb", script: "mathcal", fraktur: "mathfrak", "sans-serif": "mathsf", monospace: "mathtt", "bold-italic": "boldsymbol", italic: "mathit" })[element.getAttribute("mathvariant")];
  return command ? `\\${command}{${value}}` : value;
}

function fence(character) {
  const value = ({ "": ".", "{": "\\{", "}": "\\}", "⟨": "\\langle", "⟩": "\\rangle", "⌈": "\\lceil", "⌉": "\\rceil", "⌊": "\\lfloor", "⌋": "\\rfloor", "‖": "\\Vert", "∥": "\\Vert" })[character] ?? character;
  if (![".", "(", ")", "[", "]", "|", "\\{", "\\}", "\\langle", "\\rangle", "\\lceil", "\\rceil", "\\lfloor", "\\rfloor", "\\Vert"].includes(value)) throw new Error(`Unsupported math fence: ${character}`);
  return value;
}

function texAnnotation(element) {
  return [...element.getElementsByTagName("*")].find(annotation => tagOf(annotation) === "annotation" && TEX_ENCODING.test(annotation.getAttribute("encoding") || ""))?.textContent?.trim();
}

export function mathMLToTex(element) {
  function convert(node) {
    if (node.nodeType === 3) return node.nodeValue.trim() ? texCharacters(node.nodeValue) : "";
    if (node.nodeType !== 1) return "";
    const tag = tagOf(node);
    const children = [...node.children];
    const all = () => [...node.childNodes].map(convert).join("");
    const child = index => convert(children[index]);
    const requireChildren = count => { if (children.length !== count) throw new Error(`Incomplete formula arguments for ${tag}`); };
    if (tag === "math" || tag === "semantics") {
      const annotation = texAnnotation(node);
      if (annotation) return stripDelimiters(annotation);
      if (tag === "semantics") {
        const presentation = children.find(item => !["annotation", "annotation-xml"].includes(tagOf(item)));
        if (!presentation) throw new Error("Formula contains annotations only; no expression to convert");
        return convert(presentation);
      }
      return all();
    }
    if (tag === "annotation" || tag === "annotation-xml") return "";
    if (tag === "mrow" || tag === "mpadded") return all();
    if (tag === "mstyle") return `${node.getAttribute("displaystyle") === "true" ? "\\displaystyle " : ""}${variant(all(), node)}`;
    if (tag === "mi") {
      const text = node.textContent.trim();
      const value = texCharacters(text);
      if (!node.hasAttribute("mathvariant") && /^[a-zA-Z]{2,}$/.test(text)) {
        return /^(sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|log|ln|exp|lim|max|min|det|gcd)$/.test(text) ? `\\${text} ` : `\\mathrm{${value}}`;
      }
      return variant(value, node);
    }
    if (tag === "mn" || tag === "mo") return texCharacters(node.textContent);
    if (tag === "mtext") return `\\text{${textArgument(node.textContent)}}`;
    if (tag === "ms") return `\\text{${textArgument(`"${node.textContent}"`)}}`;
    if (tag === "mspace") return node.getAttribute("width") === "0" ? "" : "\\, ";
    if (tag === "mphantom") return `\\phantom{${all()}}`;
    if (tag === "mfrac") {
      requireChildren(2);
      if (node.getAttribute("linethickness")?.match(/^0(?:\.0+)?(?:px|pt|em|ex)?$/)) return `\\genfrac{}{}{0pt}{}{${child(0)}}{${child(1)}}`;
      return `\\frac{${child(0)}}{${child(1)}}`;
    }
    if (tag === "msqrt") return `\\sqrt{${all()}}`;
    if (tag === "mroot") { requireChildren(2); return `\\sqrt[${child(1)}]{${child(0)}}`; }
    if (["msub", "msup", "msubsup"].includes(tag)) {
      requireChildren(tag === "msubsup" ? 3 : 2);
      return `{${child(0)}}${tag !== "msup" ? `_{${child(1)}}` : ""}${tag !== "msub" ? `^{${child(tag === "msubsup" ? 2 : 1)}}` : ""}`;
    }
    if (["munder", "mover", "munderover"].includes(tag)) {
      requireChildren(tag === "munderover" ? 3 : 2);
      const base = child(0);
      const lower = child(1);
      const upper = tag === "munderover" ? child(2) : lower;
      const accent = tag === "mover" ? ({ "^": "widehat", "ˆ": "widehat", "¯": "overline", "‾": "overline", "→": "vec", "~": "widetilde", "˜": "widetilde", "˙": "dot", ".": "dot", "¨": "ddot", "⏞": "overbrace" })[children[1].textContent.trim()] : null;
      if (accent) return `\\${accent}{${base}}`;
      if (tagOf(children[0]) === "mo" && /^[∑∏∐∫∮∬∭]$/.test(children[0].textContent.trim())) {
        return `${base}\\limits${tag !== "mover" ? `_{${lower}}` : ""}${tag !== "munder" ? `^{${upper}}` : ""}`;
      }
      if (tag === "munder") return `\\underset{${lower}}{${base}}`;
      if (tag === "mover") return `\\overset{${upper}}{${base}}`;
      return `\\overset{${upper}}{\\underset{${lower}}{${base}}}`;
    }
    if (tag === "mfenced") {
      const separators = [...(node.getAttribute("separators") ?? ",").replace(/\s/g, "")];
      const body = children.map((item, index) => `${index && separators.length ? texCharacters(separators[Math.min(index - 1, separators.length - 1)]) : ""}${convert(item)}`).join("");
      return `\\left${fence(node.getAttribute("open") ?? "(")} ${body} \\right${fence(node.getAttribute("close") ?? ")")}`;
    }
    if (tag === "mtable") {
      if (children.some(row => !["mtr", "mlabeledtr"].includes(tagOf(row)))) throw new Error("Matrix contains unrecognized rows");
      const labeled = children.filter(row => tagOf(row) === "mlabeledtr");
      if (labeled.length && children.length > 1) throw new Error("Separate labels in multiline formulas need review");
      const rows = children.map(row => [...row.children].slice(tagOf(row) === "mlabeledtr" ? 1 : 0));
      if (rows.some(row => row.some(cell => tagOf(cell) !== "mtd" || Number(cell.getAttribute("columnspan") || 1) !== 1 || Number(cell.getAttribute("rowspan") || 1) !== 1))) throw new Error("Merged matrix cells need review");
      const body = rows.map(row => row.map(convert).join(" & ")).join(" \\\\ ");
      const alignment = node.getAttribute("columnalign");
      let result;
      if (alignment) {
        const align = alignment.trim().split(/\s+/).map(value => ({ left: "l", center: "c", right: "r" })[value] || "c");
        const count = Math.max(...rows.map(row => row.length));
        result = `\\begin{array}{${Array.from({ length: count }, (_, index) => align[Math.min(index, align.length - 1)]).join("")}}${body}\\end{array}`;
      } else result = `\\begin{matrix}${body}\\end{matrix}`;
      if (labeled.length) result += `\\tag{${textArgument(labeled[0].children[0].textContent.replace(/^\(|\)$/g, ""))}}`;
      return result;
    }
    if (tag === "mtd") return all();
    if (tag === "menclose") {
      const notation = (node.getAttribute("notation") || "longdiv").trim();
      const command = ({ box: "boxed", radical: "sqrt", updiagonalstrike: "cancel", horizontalstrike: "sout" })[notation];
      if (!command) throw new Error(`Unsupported menclose(${notation})`);
      return `\\${command}{${all()}}`;
    }
    if (tag === "mmultiscripts") {
      const marker = children.findIndex(item => tagOf(item) === "mprescripts");
      const post = children.slice(1, marker < 0 ? children.length : marker);
      const pre = marker < 0 ? [] : children.slice(marker + 1);
      if ((post.length && post.length !== 2) || (pre.length && pre.length !== 2)) throw new Error("Multiple tensor indices need review");
      const index = item => tagOf(item || {}) === "none" ? "" : convert(item);
      return `${pre.length ? `{}_{${index(pre[0])}}^{${index(pre[1])}}` : ""}{${child(0)}}${post.length ? `_{${index(post[0])}}^{${index(post[1])}}` : ""}`;
    }
    if (tag === "none") return "";
    throw new Error(`Unsupported MathML element ${tag}`);
  }
  const result = convert(element).trim();
  if (!result) throw new Error("Formula is empty");
  return result;
}

const escapedAt = (text, index) => {
  let count = 0;
  while (index > 0 && text[--index] === "\\") count++;
  return count % 2 === 1;
};

function stripDelimiters(value) {
  const text = value.trim();
  for (const [open, close] of [["$$", "$$"], ["\\[", "\\]"], ["\\(", "\\)"], ["$", "$"]]) {
    if (text.startsWith(open) && text.endsWith(close) && text.length >= open.length + close.length) return text.slice(open.length, -close.length).trim();
  }
  return text;
}

function normalizeTex(value) {
  const text = stripDelimiters(value);
  let result = "";
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "%" && !escapedAt(text, index)) {
      while (index < text.length && !/[\r\n]/.test(text[index])) index++;
      result += " ";
    } else result += text[index];
  }
  return result.replace(/[\r\n]+/g, " ").trim();
}

function addFormula(context, { tex, source, display = false, kind = "latex", error }) {
  context.formulas ||= [];
  context.warnings ||= [];
  const formula = { id: `m${context.formulas.length}`, sourcePath: context.sourcePath, source: source ?? tex, display, kind };
  try {
    if (error) throw error;
    const normalized = normalizeTex(tex || "");
    if (!normalized) throw new Error("Formula is empty");
    const expression = display && !/^\\displaystyle\b/.test(normalized) ? `\\displaystyle ${normalized}` : normalized;
    katex.renderToString(expression, { ...OPTIONS, displayMode: display });
    formula.tex = expression;
    formula.roam = `$$${expression}$$`;
    formula.status = "converted";
  } catch (failure) {
    formula.status = "review";
    formula.error = failure.message || String(failure);
    context.warnings.push(`Formula ${formula.id.slice(1) * 1 + 1} needs review (${context.sourcePath}): ${formula.error}. Source retained.`);
  }
  context.formulas.push(formula);
  return `⟦EPUBM:${formula.id}⟧`;
}

function elementFormula(element) {
  const tag = tagOf(element);
  const type = element.getAttribute("type") || "";
  const display = ["block", "true"].includes(element.getAttribute("display")) || /display/.test(element.className?.baseVal ?? element.className ?? "") || /mode\s*=\s*display/.test(type) || Boolean(element.closest(".math.display"));
  const data = element.getAttribute("data-latex") || element.getAttribute("data-tex");
  if (data) return { tex: data, source: data, display, kind: "latex-attribute" };
  if (tag === "script") {
    if (!/^math\/tex(?:\s*;|\s*$)/i.test(type)) return { source: element.textContent, display, kind: "math-script", error: new Error(`Unsupported math script type: ${type}`) };
    return { tex: element.textContent, source: element.textContent, display, kind: "mathjax-script" };
  }
  const math = tag === "math" ? element : [...element.getElementsByTagName("*")].find(child => tagOf(child) === "math");
  const annotation = texAnnotation(element);
  if (annotation) return { tex: annotation, source: annotation, display: display || math?.getAttribute("display") === "block", kind: "tex-annotation" };
  if (math) {
    const alt = math.getAttribute("alttext");
    if (alt && /\\[a-zA-Z]+|[_^=]/.test(alt)) return { tex: alt, source: alt, display: display || math.getAttribute("display") === "block", kind: "mathml-alttext" };
    return { tex: mathMLToTex(math), source: math.outerHTML, display: display || math.getAttribute("display") === "block", kind: "mathml" };
  }
  // An image/SVG representation is already preserved by the image pipeline.
  if (element.querySelector("img,svg,image") || ["img", "svg", "image"].includes(tag)) return null;
  if (element.classList?.contains("math")) return { tex: element.textContent, source: element.textContent, display, kind: "math-wrapper" };
  return { source: element.outerHTML, display, kind: "rendered-math", error: new Error("Rendered formula has no readable LaTeX or MathML") };
}

export function prepareMathDocument(document, context) {
  // MathJax 2 often stores both visual output and a source script. Prefer the
  // source and remove only its explicitly paired output, never ordinary images.
  for (const script of document.querySelectorAll('script[type^="math/"]')) {
    if (script.id) document.getElementById(`${script.id}-Frame`)?.remove();
    const previous = script.previousElementSibling;
    if (previous?.classList.contains("MathJax_Preview")) previous.remove();
  }
  const candidates = [...document.body.querySelectorAll("*")].filter(element => {
    if (tagOf(element) === "math") return true;
    if (!element.matches(CANDIDATES)) return false;
    if (tagOf(element) === "script" || element.hasAttribute("data-latex") || element.hasAttribute("data-tex")) return true;
    const nestedMath = [...element.getElementsByTagName("*")].filter(child => tagOf(child) === "math");
    // A generic .math container may hold several equations plus prose. Only
    // recognized renderer wrappers are consumed as one visual/source pair.
    if (nestedMath.length > 1) return false;
    if (element.classList?.contains("math") && !element.matches(".katex,.katex-display,.MathJax,.MathJax_Display,mjx-container") && (nestedMath.length || element.querySelector('script[type^="math/"]'))) return false;
    return true;
  });
  const selected = new Set(candidates);
  for (const element of candidates) {
    if (!document.body.contains(element)) continue;
    let parent = element.parentElement;
    let nested = false;
    while (parent && parent !== document.body) {
      if (selected.has(parent)) { nested = true; break; }
      parent = parent.parentElement;
    }
    if (nested || element.closest("pre,code")) continue;
    let formula;
    try { formula = elementFormula(element); }
    catch (error) { formula = { source: element.outerHTML, kind: "mathml", display: element.getAttribute("display") === "block", error }; }
    if (!formula) continue;
    const replacement = document.createElement(formula.display ? "div" : "span");
    if (!formula.display) replacement.setAttribute("data-epub-math-inline", "true");
    if (element.id) replacement.id = element.id;
    // Keep equation anchors addressable by the existing book-link resolver.
    element.querySelectorAll("[id]").forEach(target => {
      const anchor = document.createElement("span");
      anchor.id = target.id;
      replacement.append(anchor);
    });
    replacement.append(document.createTextNode(addFormula(context, formula)));
    element.replaceWith(replacement);
  }
}

function findClosing(text, close, start) {
  let index = text.indexOf(close, start);
  while (index >= 0 && escapedAt(text, index)) index = text.indexOf(close, index + close.length);
  return index;
}

export function convertDelimitedMath(text, context) {
  let result = "";
  for (let index = 0; index < text.length;) {
    if (text[index] === "`" && !escapedAt(text, index)) {
      const run = text.slice(index).match(/^`+/)[0];
      const end = text.indexOf(run, index + run.length);
      if (end >= 0) { result += text.slice(index, end + run.length); index = end + run.length; continue; }
    }
    const environment = !escapedAt(text, index) && text.slice(index).match(/^\\begin\{(equation\*?|align\*?|gather\*?|displaymath)\}/);
    if (environment) {
      const close = `\\end{${environment[1]}}`;
      const end = findClosing(text, close, index + environment[0].length);
      if (end >= 0) {
        const inner = text.slice(index + environment[0].length, end);
        const tex = environment[1].startsWith("align") ? `\\begin{aligned}${inner}\\end{aligned}` : environment[1].startsWith("gather") ? `\\begin{gathered}${inner}\\end{gathered}` : inner;
        result += addFormula(context, { tex, source: text.slice(index, end + close.length), display: true, kind: "latex-environment" });
        index = end + close.length;
        continue;
      }
      context.warnings ||= [];
      context.warnings.push(`Unclosed math environment ${environment[1]} (${context.sourcePath}); source retained.`);
    }
    const open = ["$$", "\\(", "\\[", "$"].find(candidate => text.startsWith(candidate, index) && !escapedAt(text, index));
    if (!open) { result += text[index++]; continue; }
    const close = ({ "\\(": "\\)", "\\[": "\\]" })[open] || open;
    const end = findClosing(text, close, index + open.length);
    if (end < 0) {
      if (open !== "$") {
        context.warnings ||= [];
        context.warnings.push(`Unclosed math delimiter ${open} (${context.sourcePath}); source retained.`);
      }
      result += text[index++];
      continue;
    }
    const inner = text.slice(index + open.length, end);
    // A dollar sign in a price must not turn the rest of a sentence into math.
    const singleDollarMath = inner.trim() === inner && !/[\r\n]/.test(inner) && /\\[a-zA-Z]+|[_^=<>+*/]|^[a-zA-Zα-ωΑ-Ω]+$/.test(inner);
    if (open === "$" && !singleDollarMath) { result += text[index++]; continue; }
    result += addFormula(context, { tex: inner, source: text.slice(index, end + close.length), display: open === "$$" || open === "\\[", kind: "delimited-latex" });
    index = end + close.length;
  }
  return result;
}

export function finalizeMath(book) {
  const formulas = new Map((book.formulas || []).map(formula => [formula.id, formula]));
  const expand = (text, onReview) => (text || "").replace(/⟦EPUBM:(m\d+)⟧/g, (_, id) => {
    const formula = formulas.get(id);
    if (formula?.status === "converted") return formula.roam;
    if (formula) onReview?.(formula);
    return `[Formula ${id.slice(1) * 1 + 1} needs review; see source in child block]`;
  });
  const linkReviews = new Map();
  book.links.forEach(link => {
    const reviews = [];
    link.label = expand(link.label, formula => reviews.push(formula));
    linkReviews.set(link.id, reviews);
  });
  const walk = nodes => nodes.forEach(node => {
    const reviews = new Map();
    node.text = expand(node.text, formula => reviews.set(formula.id, formula));
    for (const match of node.text.matchAll(/⟦EPUBL:(l\d+)⟧/g)) {
      (linkReviews.get(match[1]) || []).forEach(formula => reviews.set(formula.id, formula));
    }
    if (node.sourceHeading) node.sourceHeading.text = expand(node.sourceHeading.text);
    walk(node.children || []);
    reviews.forEach(formula => {
      const language = formula.kind.includes("mathml") || /^\s*</.test(formula.source) ? "xml" : "latex";
      const fence = "`".repeat(Math.max(3, ...[...formula.source.matchAll(/`+/g)].map(match => match[0].length + 1)));
      node.children.unshift({ text: `${fence}${language}\n${formula.source}\n${fence}`, kind: "math-source", sourcePath: formula.sourcePath, children: [] });
    });
  });
  walk(book.chapters);
  return book;
}

export function renderFormulaMathML(formula) {
  if (formula.status !== "converted") return "";
  return katex.renderToString(formula.tex, { ...OPTIONS, displayMode: formula.display });
}

export const mathInternals = { normalizeTex, stripDelimiters };
