/**
 * Audit fixture: switches the application to Swedish
 * (`bin/theme_audit.mjs --prepare bin/audit/use-locale-sv.js`).
 *
 * Drives the shell's own language switch, so the catalogue is loaded through the real code path
 * (Transloco over HTTP) instead of by writing localStorage and reloading the page.
 * Number and date formats follow `LOCALE_ID`, which is resolved at bootstrap — switch those by
 * reloading with `spr.lang` in localStorage.
 */
(() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  return (async () => {
    const host = document.querySelector('app-root');
    const component = host && window.ng && window.ng.getComponent ? window.ng.getComponent(host) : null;
    if (!component || typeof component.setLanguage !== 'function') {
      // Both siblings throw when they cannot reach their state, so a drifted fixture cannot leave an
      // audit measuring the default screen and green. This one did not, which is why it reported the
      // same message on the editor for as long as it has existed while switching nothing. The reason
      // is not always the build: the *editor* has no locale switching at all — its strings are
      // constants (`core/editor-strings.ts`) — so it renders in English and there is no Swedish
      // screen there to audit, while the recorder is Swedish already.
      throw new Error('no language switch on this page (the demo app exposes setLanguage on app-root '
        + 'under a development build; the editor has no locale switching and the recorder is Swedish already)');
    }
    component.setLanguage('sv');
    await sleep(1500); // catalogue fetch + re-render
    const translated = document.querySelector('.spr-start-title, app-sprprogress th, .spr-brand-text');
    if (!translated) {
      throw new Error('switched to sv but nothing recognisable re-rendered');
    }
    return 'locale sv, sample: "' + translated.textContent.trim().slice(0, 40) + '"';
  })();
})()
