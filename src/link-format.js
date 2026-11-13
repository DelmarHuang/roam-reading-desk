export function aliasLabel(label) {
  // Roam's alias parser does not support Markdown backslash escaping of
  // nested square brackets. Numeric note labels use a plain clickable number.
  const raw = label.replace(/\\([\[\]\\])/g, "$1").trim();
  const numeric = raw.match(/^\[\s*(\d+)\s*\]$/);
  return numeric ? numeric[1] : raw.replace(/\[/g, "［").replace(/\]/g, "］");
}
export const blockAlias = (label, uid) => `[${aliasLabel(label)}](((${uid})))`;
