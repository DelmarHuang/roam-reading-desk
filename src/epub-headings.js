// Read only typography, never execute EPUB scripts or load its external URLs.
// This is deliberately a conservative subset of CSS, not a browser layout engine.
export function styledHeadings(document, stylesheets = []) {
  const rules = [];
  for (const text of [...stylesheets, ...[...document.querySelectorAll('style')].map(node => node.textContent)]) {
    for (const match of text.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (match[1].trim().startsWith('@')) continue;
      const probe = document.createElement('span'); probe.setAttribute('style', match[2]);
      for (const selector of match[1].split(',')) {
        const specificity = (selector.match(/#[\w-]+/g) || []).length * 100 + (selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) || []).length * 10 + (selector.match(/(?:^|[\s>+~])[a-z]+/gi) || []).length;
        rules.push({ selector: selector.trim(), style: probe.style, specificity });
      }
    }
  }
  rules.sort((a,b) => a.specificity-b.specificity);
  const cache = new Map();
  const typography = element => {
    if (!element) return { size: 16, bold: false };
    if (cache.has(element)) return cache.get(element);
    const inherited = typography(element.parentElement), declarations = new Map();
    const take = style => {
      for (const property of ['font-size', 'font-weight']) {
        const value = style?.getPropertyValue(property); if (!value) continue;
        const important = style.getPropertyPriority(property) === 'important';
        if (!declarations.get(property)?.important || important) declarations.set(property, {value, important});
      }
    };
    for (const rule of rules) { try { if (element.matches(rule.selector)) take(rule.style); } catch { /* unsupported selector */ } }
    take(element.style);
    const size = declarations.get('font-size')?.value.match(/^([\d.]+)(px|pt|em|rem|%)$/);
    let pixels = inherited.size;
    if (size) pixels = Number(size[1]) * ({px:1, pt:4/3, em:inherited.size, rem:16, '%':inherited.size/100}[size[2]]);
    const weight = declarations.get('font-weight')?.value;
    const bold = weight ? /^(bold|bolder|[7-9]00)$/.test(weight) : /^(B|STRONG)$/.test(element.tagName) || inherited.bold;
    const result = {size:pixels,bold}; cache.set(element,result); return result;
  };
  const details = [...document.querySelectorAll('p,div')].filter(element => !element.querySelector('p,div,h1,h2,h3,h4,h5,h6')).map(element => {
    const chunks = [];
    const walk = node => {
      if (node.nodeType === 3 && node.textContent.trim()) chunks.push({...typography(node.parentElement),length:node.textContent.trim().length});
      else for (const child of node.childNodes || []) walk(child);
    };
    walk(element); return {element,chunks};
  });
  const sizes = new Map();
  for (const {chunks} of details) for (const chunk of chunks) if (!chunk.bold) sizes.set(chunk.size,(sizes.get(chunk.size)||0)+chunk.length);
  const dominant = [...sizes].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const result = new Map();
  if (!dominant) return result;
  for (const {element,chunks} of details) {
    if (!chunks.length || element.querySelector('img,svg,math') || element.textContent.trim().length > 180 || element.closest('aside,nav,figure,blockquote')) continue;
    if (chunks.every(chunk => chunk.bold && chunk.size > dominant * 1.03)) result.set(element,{kind:'heading',rank:2,headingEvidence:'larger bold EPUB paragraph'});
  }
  const sizesByHeading = [...new Set([...result.keys()].map(element => typography(element).size))].sort((a,b) => b-a);
  for (const [element, heading] of result) heading.rank = Math.min(6, 2 + sizesByHeading.indexOf(typography(element).size));
  return result;
}
