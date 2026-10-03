/**
 * The one guard every editor-wide key shortcut shares (ui-spec §8): a shortcut must never fire
 * while the operator is typing in a field. Kept as a pure function of the event target so the
 * outline's `/` handler and its spec can pin the rule without a renderer.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}
