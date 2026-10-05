/**
 * Audit fixture: opens the error message dialog so
 * `bin/theme_audit.mjs --prepare bin/audit/open-error-dialog.js` measures the dialog
 * surface (title, icon chip, action button, backdrop).
 *
 * Calls the recorder's own error path, so the dialog is the real one, with the real data.
 * Runs against a development build (Angular dev-mode component API).
 * A state it cannot reach is thrown, not returned: the audits fail on the exception, so a fixture
 * whose selector drifted cannot leave the audit measuring the default screen and green.
 */
(() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  return (async () => {
    const host = document.querySelector('app-sprrecordingsession');
    const component = host && window.ng && window.ng.getComponent ? window.ng.getComponent(host) : null;
    if (!component || typeof component.error !== 'function') {
      throw new Error('error path not found');
    }
    component.error('Audit: simulated recording error.', 'This dialog is rendered for the theme audit.');
    await sleep(1200);
    if (!document.querySelector('msg-dialog')) {
      throw new Error('dialog did not open');
    }
    return 'error dialog open';
  })();
})()
