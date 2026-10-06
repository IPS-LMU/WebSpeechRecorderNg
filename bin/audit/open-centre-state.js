/**
 * Audit fixture: asserts the page is showing a *selected* state, so the audits exercise the selection
 * markers rather than the default screen.
 *
 * The rule it exists for is the non-text one (§11.54): an element that announces a state and marks it
 * with a border, outline or box-shadow must reach 3:1. A URL selects a node in the editor (`?sel=`),
 * but a URL cannot throw — if the selection stopped parsing, the audit would measure the default
 * screen and stay green. This fixture throws, like the others, so that cannot happen quietly.
 *
 * Usage (the editor route carries the selection):
 *   node bin/theme_audit.mjs \
 *     --url 'http://127.0.0.1:4300/project/Demo1/script/bank-draw/edit?sel=g:0:0' \
 *     --prepare bin/audit/open-centre-state.js --viewports 1366x768
 */
(() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  return (async () => {
    const selectors = [
      'spr-editor-centre .group.active',                    // the selected group's card (drawn or fixed)
      'spr-editor-centre .fixed-row[aria-current="true"]',  // the current row inside a fixed group
      'spr-editor-outline .row-main[aria-current="true"]',  // the outline's current row
    ];
    for (let attempt = 0; attempt < 40; attempt++) {
      for (const selector of selectors) {
        const host = document.querySelector(selector);
        if (!host) {
          continue;
        }
        const box = host.getBoundingClientRect();
        if (box.width > 1 && box.height > 1) {
          return 'selection marker present: ' + selector;
        }
      }
      await sleep(250);
    }
    throw new Error('no selection marker on the page (looked for: ' + selectors.join(', ') + ')');
  })();
})();
