/**
 * Audit fixture: opens the detailed audio view (waveform + sonagram over the recording
 * list) so `bin/theme_audit.mjs --prepare bin/audit/open-detail-view.js` measures the
 * overlay instead of the collapsed session screen.
 *
 * Runs against a development build: it uses the Angular dev-mode component API. Routes that
 * render the recording-file list (`AudioRecorder` / `AudioRecorderComponent`) have this
 * overlay; `SpeechrecorderngComponent` renders the session screen without it, so this
 * fixture reports "no component with a detail view in this route" there.
 * A state it cannot reach is thrown, not returned: the audits fail on the exception, so a fixture
 * whose selector drifted cannot leave the audit measuring the default screen and green.
 */
(() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  return (async () => {
    if (!window.ng || !window.ng.getComponent) {
      throw new Error('no Angular dev API (needs a development build)');
    }
    const candidates = [
      'app-audiorecorder-comp',
      'app-audiorecorder',
      'app-sprrecordingsession',
      'app-recordercombipane',
    ];
    for (const selector of candidates) {
      const host = document.querySelector(selector);
      const component = host ? window.ng.getComponent(host) : null;
      if (!component || !('audioSignalCollapsed' in component)) {
        continue;
      }
      // More than one component carries the flag, and only the one that owns the collapsable pane
      // opens the view: a candidate that has the field but no pane is tried, not thrown on. The
      // throw stays after the list, so a drifted selector still cannot leave the audit green while
      // it measures the default screen.
      component.audioSignalCollapsed = false;
      window.ng.applyChanges(component);
      await sleep(1500);
      if (document.querySelector('.collapsable.active')) {
        return 'detail view open (' + selector + ')';
      }
    }
    throw new Error('the detail view did not open for any of: ' + candidates.join(', '));
  })();
})()
