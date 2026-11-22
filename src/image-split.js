// Split only complete image syntax; retain source order and never fetch assets.
export function splitImages(text, tokens = false) {
  const pattern = tokens ? /⟦EPUBI:[^⟧]+⟧|!\[(?:\\.|[^\]\\])*\]\(/g : /!\[(?:\\.|[^\]\\])*\]\(/g;
  const parts = []; let end = 0, match;
  while ((match = pattern.exec(text))) {
    let stop = pattern.lastIndex;
    if (!match[0].startsWith('⟦EPUBI:')) {
      let depth = 1;
      for (; stop < text.length && depth; stop++) {
        if (text[stop] === '\\') { stop++; continue; }
        if (text[stop] === '(') depth++;
        if (text[stop] === ')') depth--;
      }
      if (depth) return [{text, image:false}];
      pattern.lastIndex = stop;
    }
    parts.push({text:text.slice(end,match.index),image:false}, {text:text.slice(match.index,stop),image:true}); end=stop;
  }
  parts.push({text:text.slice(end),image:false});
  return parts.filter(part=>part.text.trim());
}
