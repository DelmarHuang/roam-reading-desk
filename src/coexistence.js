const KEY = '__readingDeskFeatures';
export function publishFeature(name, active) {
  const state = window[KEY] || (window[KEY] = {});
  if (Boolean(state[name]) === Boolean(active)) return;
  state[name] = Boolean(active);
  window.dispatchEvent(new window.Event('reading-desk-features-change'));
}
