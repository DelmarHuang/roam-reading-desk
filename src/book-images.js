// Scope native browser image hints to the current managed book. Do not touch
// URLs, Roam blocks, image sizes, user CSS, or images on unrelated pages.
export function optimizeBookImages(content) {
  const main = document.querySelector('.roam-main');
  if (!main || !content || content.ordinaryPage || content.aggregate) return () => {};
  const changed = new Map();
  const apply = image => {
    if (changed.has(image)) return;
    const uid = image.closest('.rm-block[data-block-uid]')?.getAttribute('data-block-uid');
    if (!content.byUid.has(uid)) return;
    const attributes = {};
    for (const [name, hint] of [['loading','lazy'],['decoding','async']]) {
      // Respect explicit choices made by Roam or another extension.
      if (image.hasAttribute(name)) continue;
      attributes[name] = hint; image.setAttribute(name, hint);
    }
    if (Object.keys(attributes).length) changed.set(image, attributes);
  };
  const scan = node => {
    if (node.nodeType !== 1) return;
    if (node.matches('img')) apply(node);
    node.querySelectorAll('img').forEach(apply);
  };
  scan(main);
  const observer = new window.MutationObserver(mutations => {
    const containsImage = node => node.nodeType === 1 && (node.matches('img') || node.querySelector('img'));
    if (!mutations.some(mutation => [...mutation.addedNodes, ...mutation.removedNodes].some(containsImage))) return;
    // Drop detached image nodes instead of retaining an entire previous view.
    for (const [image, attributes] of changed) if (!image.isConnected) {
      for (const [name,hint] of Object.entries(attributes)) if (image.getAttribute(name) === hint) image.removeAttribute(name);
      changed.delete(image);
    }
    for (const mutation of mutations) mutation.addedNodes.forEach(scan);
  });
  observer.observe(main,{childList:true,subtree:true});
  return () => {
    observer.disconnect();
    for (const [image, attributes] of changed) for (const [name,hint] of Object.entries(attributes)) if (image.getAttribute(name) === hint) image.removeAttribute(name);
    changed.clear();
  };
}
