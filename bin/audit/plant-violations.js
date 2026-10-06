/**
 * Audit fixture: plants known violations on the page so the audits' rules can be seen to fail.
 *
 * `bin/theme_audit.mjs` and `bin/a11y_audit.mjs` are the gates the editor's and recorder's screens
 * are held to, and until this fixture existed nothing checked that they bite: README §7 promised,
 * in prose, that a colour literal is named, that 9 px text is named, that a 3000 px block is named
 * and that a font outside the scale is named — all from one-off checks by hand in earlier rounds.
 *
 * Each planted element maps to one documented rule, and the messages are distinct enough to assert
 * on: a colour literal, type below the scale, a low-contrast paragraph, a document-level scrollbar
 * and a font outside the scale on a link the audit measures.
 *
 * Usage (against a running editor or recorder, with Chrome to attach to):
 *   node bin/theme_audit.mjs --url http://127.0.0.1:4300/project/Demo1/script \
 *     --prepare bin/audit/plant-violations.js --viewports 1366x768
 * It must exit non-zero, naming each rule below.
 */
(() => {
  const add = (tag, style, text) => {
    const el = document.createElement(tag);
    if (text !== undefined) {
      el.textContent = text;
    }
    el.setAttribute('style', style);
    document.body.appendChild(el);
    return el;
  };
  const marker = 'planted-violation';

  // A colour literal where a token belongs.
  add('div', `background: lightgrey; width: 40px; height: 12px`).className = marker;
  // Type below the scale (the audits name sizes under 13.5 px).
  add('div', 'font-size: 9px; color: #222222', 'nine pixel text').className = marker;
  // A paragraph whose contrast is under 4.5:1 (#969696 on #ffffff is about 2.9:1).
  add('p', 'color: #969696; background: #ffffff; font-size: 16px', 'low contrast paragraph').className = marker;
  // Something tall enough to give the document a scrollbar.
  add('div', 'height: 3000px; width: 4px').className = marker;
  // A font outside the scale, on a link the audits measure.
  const link = document.createElement('a');
  link.href = '#';
  link.className = marker;
  link.textContent = 'planted link';
  link.setAttribute('style', 'font-family: Arial; font-size: 16px; color: var(--spr-link, #2A4765)');
  document.body.appendChild(link);

  return 'planted 5 violations';
})()
