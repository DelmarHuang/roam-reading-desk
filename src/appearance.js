// Document-level appearance switches read by the bundled CSS.
export const HIGHLIGHT_COLOURS = [["coral", "Coral"], ["rose", "Rose"], ["mint", "Mint"], ["sky", "Sky"], ["lilac", "Lilac"], ["theme", "Theme default"]];
export const MARK_STYLES = [["dot", "Margin dot + bold"], ["bookmark", "Bookmark ribbon"], ["highlighter", "Gold highlighter"], ["pullquote", "Pull quote"], ["sticky", "Sticky note"], ["ink", "Ink emphasis"]];
export const NOTE_STYLES = [["notion", "Cards"], ["minimal", "Minimal"]];
export const NOTE_COLOURS = [["gold", "Gold"], ["gray", "Gray"], ["blue", "Blue"], ["green", "Green"], ["rose", "Rose"], ["purple", "Purple"]];
export const HIGHLIGHT_SHAPES = [["marker", "Marker"], ["underline", "Underline"]];
export const TEXT_WIDTHS = [["fill", "Fill the line"], ["theme", "Theme line length"]];
export function applyAppearance(preference) {
  const root = document.documentElement;
  root.classList.add("reading-desk");
  root.setAttribute("data-rd-highlight", preference("reader-highlight-colour", "coral"));
  root.setAttribute("data-rd-highlight-shape", preference("reader-highlight-shape", "marker"));
  // The original Magazine look was retired in 0.4.7; old settings map to the default.
  const mark = preference("reader-mark-style", "dot");
  root.setAttribute("data-rd-mark", MARK_STYLES.some(([value]) => value === mark) ? mark : "dot");
  // "magazine" was retired in 0.4.8; anything unknown falls back to Cards.
  const note = preference("reader-note-style", "notion");
  root.setAttribute("data-rd-note-style", NOTE_STYLES.some(([value]) => value === note) ? note : "notion");
  root.setAttribute("data-rd-note-colour", preference("reader-note-colour", "gold"));
  // Text runs to the end of the block row (no empty strip before the
  // reference count on wide screens) unless the theme's line length is kept.
  root.setAttribute("data-rd-text", preference("reader-text-width", "fill") === "theme" ? "theme" : "fill");
}
export function removeAppearance() {
  const root = document.documentElement;
  root.classList.remove("reading-desk"); root.removeAttribute("data-rd-highlight"); root.removeAttribute("data-rd-highlight-shape"); root.removeAttribute("data-rd-mark"); root.removeAttribute("data-rd-note-style"); root.removeAttribute("data-rd-text"); root.removeAttribute("data-rd-note-colour");
}
