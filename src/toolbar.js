import { t } from "./i18n.js";
// A single native-sized topbar icon. No floating launcher or sticky corner UI.
export function installToolbar(open) {
  const id = "reading-desk-topbar-button";
  let disposed = false;
  const mount = () => {
    if (disposed || document.getElementById(id)) return;
    const bar = document.querySelector(".rm-topbar");
    if (!bar) return;
    const button = document.createElement("button"); button.id = id; button.type = "button";
    button.className = "bp3-button bp3-minimal bp3-small";
    button.title = t("Reading Desk"); button.setAttribute("aria-label", t("Reading Desk")); button.setAttribute("aria-haspopup", "dialog"); button.setAttribute("aria-controls", "reading-desk-panel"); button.setAttribute("aria-expanded", "false");
    // Same family as Roam's other topbar icons: a solid Blueprint glyph at the
    // neighbours' size and colour (Roam's own filter/calendar/help icons).
    const sibling = [...bar.querySelectorAll(".bp3-icon,.bp4-icon,.bp5-icon")].find(node => node.closest(`#${id}`) == null && node.getBoundingClientRect().width > 0);
    const style = sibling ? window.getComputedStyle(sibling) : null;
    const size = `${Math.round(Math.max(12, Math.min(18, parseFloat(style?.fontSize) || sibling?.getBoundingClientRect().width || 16)))}px`;
    const siblingButton = sibling?.closest("button,.bp3-button,.bp4-button,.bp5-button");
    if (siblingButton?.classList.contains("bp3-button")) button.className = [...siblingButton.classList].filter(name => /^bp3-(?:button|minimal|small)$/.test(name)).join(" ") || button.className;
    for (const [key, value] of Object.entries({ position:"static", display:"inline-flex", "align-items":"center", "justify-content":"center", "flex-shrink":"0", "pointer-events":"auto", "-webkit-app-region":"no-drag" })) button.style.setProperty(key, value, "important");
    const icon = document.createElement('span'); icon.className = 'bp3-icon bp3-icon-standard bp3-icon-book'; icon.setAttribute('aria-hidden','true');
    for (const [key,value] of Object.entries({'font-size':size,'line-height':'1','pointer-events':'none',...(style?.color ? { color: style.color } : {})})) icon.style.setProperty(key,value,'important');
    button.append(icon);
    button.onclick = () => Promise.resolve(open()).catch(console.warn);
    const spacer = bar.querySelector(".rm-topbar__left-spacer");
    bar.insertBefore(button, spacer || null);
  };
  const observer = new window.MutationObserver(() => { if (!document.getElementById(id)) mount(); });
  observer.observe(document.body, { childList: true, subtree: true }); mount();
  return { cleanup() { disposed = true; observer.disconnect(); document.getElementById(id)?.remove(); } };
}
