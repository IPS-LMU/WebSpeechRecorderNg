/**
 * Audit fixture: opens the editor with a **draw rule selected** in the inspector, so
 * `bin/theme_audit.mjs --prepare bin/audit/open-draw-rule.js --url <…/script/bank-draw/edit>`
 * measures the drawn-group inspector (bank, counter, fixedBy, prefix preview) instead of the
 * default script selection.
 *
 * Pure DOM: it clicks the outline row that carries the drawn marker, so it works in a production
 * build too — unlike fixtures that reach into Angular's dev-mode component API.
 */
(() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  return (async () => {
    const marker = Array.from(document.querySelectorAll('.marker-text'))
      .find(node => /draw/i.test(node.textContent || ''));
    if (!marker) {
      return 'no drawn-group marker in the outline';
    }
    const row = marker.closest('.row-main') || marker.closest('button');
    if (!row) {
      return 'drawn marker has no clickable row';
    }
    row.click();
    await sleep(1200);
    const inspector = document.querySelector('spr-editor-inspector');
    const heading = inspector ? inspector.textContent || '' : '';
    if (!inspector) {
      return 'no inspector rendered';
    }
    // The inspector owns the draw-rule variant; a bank name or the prefix preview must be visible.
    return /draw|bank|[A-Z]{1,4}001/i.test(heading)
      ? 'draw rule selected'
      : 'inspector still shows another variant';
  })();
})()
