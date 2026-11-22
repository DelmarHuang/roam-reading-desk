import { blockTreeChanged } from "./dom-changes.js";
// View-only location tracking. Never query or write graph data while scrolling.
export function startChapterLocator(content, onChapter) {
  const main = document.querySelector('.roam-main');
  if (!main || !window.IntersectionObserver) return () => {};
  const observed = new Map(), visible = new Set();
  let frame, bindTimer, disposed = false, current;
  const measure = () => {
    frame = null; if (disposed) return;
    const bounds = main.getBoundingClientRect();
    const top = Math.max(48,bounds.top), bottom = Math.min(window.innerHeight,bounds.bottom);
    const line = top + Math.min(140,Math.max(0,(bottom-top)*0.25));
    let winner, distance = Infinity;
    for (const element of visible) {
      if (!element.isConnected) continue;
      const rect = element.getBoundingClientRect();
      if (rect.bottom <= top || rect.top >= bottom || !rect.width || !rect.height) continue;
      const score = rect.top <= line && rect.bottom >= line ? 0 : Math.min(Math.abs(rect.top-line),Math.abs(rect.bottom-line));
      if (score < distance) { distance = score; winner = observed.get(element); }
    }
    const next = winner || null;
    if (next !== current) { current = next; onChapter(next); }
  };
  const schedule = () => { if (!disposed && frame == null) frame = window.requestAnimationFrame(measure); };
  const observer = new window.IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target); }); schedule();
  }, {threshold:[0,0.01,1]});
  const bind = () => {
    if (disposed) return;
    for (const element of observed.keys()) if (!element.isConnected) { observer.unobserve(element); observed.delete(element); visible.delete(element); }
    main.querySelectorAll('.rm-block[data-block-uid]').forEach(block => {
      const item = content.byUid.get(block.getAttribute('data-block-uid'));
      if (!item?.chapterUid) return;
      const element = block.querySelector(':scope > .rm-block-main') || block;
      if (!observed.has(element)) { observed.set(element,item.chapterUid); observer.observe(element); }
    }); schedule();
  };
  const mutation = new window.MutationObserver(mutations => { if (!blockTreeChanged(mutations)) return; clearTimeout(bindTimer); bindTimer = setTimeout(bind,150); });
  mutation.observe(main,{childList:true,subtree:true});
  document.addEventListener('scroll',schedule,{capture:true,passive:true}); window.addEventListener('resize',schedule);
  bind();
  return () => { disposed = true; observer.disconnect(); mutation.disconnect(); clearTimeout(bindTimer); if (frame != null) window.cancelAnimationFrame(frame); document.removeEventListener('scroll',schedule,true); window.removeEventListener('resize',schedule); };
}
