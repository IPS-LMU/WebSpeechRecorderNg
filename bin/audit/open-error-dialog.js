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
    // The error path lives on the recorder component (`AudioRecorderComponent.error`, which the
    // session manager implements), and the route that renders it is `/recorder/session/:id`; the
    // session screen has no such method. Every component that might carry it is tried, and the
    // throw stays after the list, so a drifted selector still cannot leave an audit green while it
    // measures the default screen.
    const candidates = ['app-audiorecorder-comp', 'app-audiorecorder', 'app-sprrecordingsession'];
    for (const selector of candidates) {
      const host = document.querySelector(selector);
      const component = host && window.ng && window.ng.getComponent ? window.ng.getComponent(host) : null;
      if (!component || typeof component.error !== 'function') {
        continue;
      }
      component.error('Audit: simulated recording error.', 'This dialog is rendered for the theme audit.');
      await sleep(1200);
      if (document.querySelector('msg-dialog')) {
        return 'error dialog open (' + selector + ')';
      }
    }
    throw new Error('the error dialog did not open for any of: ' + candidates.join(', '));
  })();
})()
