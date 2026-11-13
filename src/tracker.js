import { DwellMeter } from "./progress.js";

export function startTracker(progress, { onChange = () => {}, onError = () => {} } = {}) {
  if (!window.IntersectionObserver) return () => {};
  const meter = new DwellMeter(progress);
  const observed = new Map();
  const cleanups = [];
  let disposed = false;
  let bindTimer;
  const now = () => Date.now();
  const on = (target, event, callback, options) => { target.addEventListener(event, callback, options); cleanups.push(() => target.removeEventListener(event, callback, options)); };
  const visible = new Map();
  const observer = new window.IntersectionObserver(entries => {
    entries.forEach(entry => {
      const uid = observed.get(entry.target);
      if (!uid) return;
      const height = Math.min(entry.boundingClientRect.height, window.innerHeight || 800);
      const qualifies = entry.isIntersecting && entry.intersectionRect.height >= height * 0.55;
      if (qualifies) visible.set(entry.target, uid); else visible.delete(entry.target);
      meter.visibility(uid, [...visible.values()].includes(uid), now());
    });
  }, { threshold: [0, 0.1, 0.55, 1] });
  const bind = () => {
    if (disposed) return;
    for (const [element, uid] of observed) if (!element.isConnected) {
      observer.unobserve(element); observed.delete(element); visible.delete(element);
      meter.visibility(uid, [...visible.values()].includes(uid), now());
    }
    document.querySelectorAll('.roam-main .rm-block[data-block-uid], .roam-sidebar-content .rm-block[data-block-uid], #right-sidebar .rm-block[data-block-uid]').forEach(block => {
      const uid = block.getAttribute("data-block-uid");
      if (!progress.content.byUid.has(uid)) return;
      const element = block.querySelector(":scope > .rm-block-main") || block;
      if (!observed.has(element)) { observed.set(element, uid); observer.observe(element); }
    });
  };
  const mutation = new window.MutationObserver(() => { clearTimeout(bindTimer); bindTimer = setTimeout(bind, 400); });
  const surface = document.querySelector(".roam-body") || document.querySelector(".roam-app") || document.body;
  if (surface) mutation.observe(surface, { childList: true, subtree: true });
  const activity = () => meter.activity(now());
  for (const event of ["scroll", "pointerdown", "keydown", "touchstart"]) on(document, event, activity, { capture: true, passive: true });
  const flush = () => progress.flush().catch(onError);
  on(document, "visibilitychange", () => { meter.setActive(!document.hidden && document.hasFocus(), now()); if (document.hidden) flush(); });
  on(window, "blur", () => { meter.setActive(false, now()); flush(); });
  on(window, "focus", () => meter.setActive(!document.hidden, now()));
  on(window, "pagehide", flush);
  meter.activity(now()); meter.setActive(!document.hidden && document.hasFocus(), now());
  const ticker = setInterval(() => { if (meter.tick(now())) onChange(); }, 1000);
  const saver = setInterval(flush, 5000);
  bind();
  return () => {
    disposed = true; clearTimeout(bindTimer); clearInterval(ticker); clearInterval(saver);
    observer.disconnect(); mutation.disconnect(); cleanups.forEach(fn => fn()); flush();
  };
}
