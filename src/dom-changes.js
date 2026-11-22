// Image loads, progress labels, panel updates and comment cards do not change
// the set of paragraph elements observed for reading position.
export function blockTreeChanged(mutations) {
  return mutations.some(mutation => [...mutation.addedNodes, ...mutation.removedNodes].some(node => node.nodeType === 1 && (node.matches?.('.rm-block[data-block-uid]') || node.querySelector?.('.rm-block[data-block-uid]'))));
}
