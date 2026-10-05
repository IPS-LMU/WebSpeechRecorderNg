/**
 * Audit fixture: opens the editor with a **draw rule selected** in the inspector, so
 * `bin/theme_audit.mjs --prepare bin/audit/open-draw-rule.js --url <…/script/bank-draw/edit>`
 * measures the drawn-group inspector (bank, counter, fixedBy, prefix preview) instead of the
 * default script selection.
 *
 * Pure DOM: it clicks the outline row that carries the drawn marker, so it works in a production
 * build too — unlike fixtures that reach into Angular's dev-mode component API.
 * A state it cannot reach is thrown, not returned: the audits fail on the exception, so a fixture
 * whose selector drifted cannot leave the audit measuring the default screen and green.
 */
(() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  return (async () => {
    const marker = Array.from(document.querySelectorAll('.marker-text'))
      .find(node => /draw/i.test(node.textContent || ''));
    if (!marker) {
      throw new Error('no drawn-group marker in the outline');
    }
    const row = marker.closest('.row-main') || marker.closest('button');
    if (!row) {
      throw new Error('drawn marker has no clickable row');
    }
    row.click();
    await sleep(1200);
    const inspector = document.querySelector('spr-editor-inspector');
    const heading = inspector ? inspector.textContent || '' : '';
    if (!inspector) {
      throw new Error('no inspector rendered');
    }
    // The inspector owns the draw-rule variant; a bank name or the prefix preview must be visible.
    if (!/draw|bank|[A-Z]{1,4}001/i.test(heading)) {
      throw new Error('inspector still shows another variant');
    }
    return 'draw rule selected';
  })();
})()
