/**
 * Audit fixture: switches to the opt-in dark scheme
 * (`bin/theme_audit.mjs --prepare bin/audit/use-dark-scheme.js`).
 *
 * The scheme is a root attribute — no media query — so the fixture is a one-liner and the
 * audit then measures the dark tokens, their contrast and the Material pins that follow them.
 */
(() => {
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const before = {chrome: token('--spr-chrome'), surface: token('--spr-surface')};
  document.documentElement.setAttribute('data-spr-scheme', 'dark');
  const after = {chrome: token('--spr-chrome'), surface: token('--spr-surface')};
  // An injector can fail silently the same way a state fixture can: if the attribute no longer drives
  // the tokens, this would return an empty or unchanged value and the audit would report on the light
  // scheme while claiming to have measured the dark one.
  if (!after.chrome || !after.surface) {
    throw new Error('the dark scheme left no chrome/surface token (got "' + after.chrome + '"/"' + after.surface + '")');
  }
  if (after.chrome === before.chrome && after.surface === before.surface) {
    throw new Error('data-spr-scheme="dark" changed nothing — chrome and surface both still '
      + before.chrome + ' — so a dark pass would be measuring the light tokens');
  }
  return 'dark scheme: chrome ' + before.chrome + ' -> ' + after.chrome;
})()
