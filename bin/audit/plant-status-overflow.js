/**
 * Audit fixture: makes the status line's content wider than its own box, so the third failure mode
 * `bin/layout_probe.mjs` documents — a status line the operator cannot read — is induced rather than
 * merely implemented.
 *
 * It reports what it did, or throws when there is no status display to widen, so a drifted selector
 * fails the probe instead of leaving it measuring a page without the condition it asked for.
 *
 * Usage (the dry-run job renders the recorder's session screen):
 *   node bin/layout_probe.mjs --url http://127.0.0.1:8391/spr/session/1 \
 *     --prepare bin/audit/plant-status-overflow.js --viewports 1568x986
 */
(() => {
  const status = document.querySelector('div.controlpanel app-sprstatusdisplay');
  if (!status) {
    throw new Error('no status display in the control panel');
  }
  // The status line is empty on a fresh session and its host is inline, so it has a zero-width box and
  // nothing to overflow. Give it a box and content — the condition the probe names — and re-apply both
  // if a render clears them.
  const long = document.createElement('span');
  long.setAttribute('style', 'white-space: nowrap; display: inline-block');
  long.textContent = 'a planted status line that cannot fit its box, repeated to be sure. '.repeat(3);
  const apply = () => {
    status.setAttribute('style', 'display: inline-block; max-width: 60px; overflow: hidden');
    if (!status.contains(long)) {
      status.appendChild(long);
    }
  };
  apply();
  new MutationObserver(apply).observe(status, {childList: true, attributes: true});
  return 'status content ' + Math.round(status.scrollWidth) + 'px in a ' + Math.round(status.clientWidth) + 'px box';
})();
