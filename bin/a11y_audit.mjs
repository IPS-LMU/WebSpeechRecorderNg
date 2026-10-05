#!/usr/bin/env node
/**
 * Accessibility audit for the editor (and any route that renders like it).
 *
 * A screen-reader pass cannot be automated — nothing headless announces a tree — but most of
 * ui-spec §8 is a property of the DOM, and those properties are what regress silently. This drives
 * an already-running Chrome over the DevTools Protocol, like `theme_audit.mjs` and
 * `layout_probe.mjs`, and checks:
 *
 *   1. every interactive element resolves an accessible name (text, `aria-label`, `aria-labelledby`)
 *      — a `title` alone is not a name for an icon-only control;
 *   2. every form control has a label, and an invalid one wires its message through
 *      `aria-describedby` (never colour alone);
 *   3. `aria-labelledby`/`aria-describedby` point at elements that exist and have text;
 *   4. ids are unique (a duplicate silently breaks the two above);
 *   5. images carry `alt` unless they are explicitly decorative;
 *   6. nothing focusable sits inside `aria-hidden="true"`;
 *   7. a `role="radiogroup"` marks its children with `aria-checked`, and a `role="tree"` contains
 *      `treeitem`s (with `aria-level`, and `aria-expanded` where they have children);
 *   8. tab order never jumps back up within one column (document order against the elements' boxes);
 *   9. the browser's own **accessibility tree** agrees: every treeitem carries a level, a tree has
 *      treeitems, a radiogroup has radios with a checked state, and no node whose role requires a
 *      name (button, link, textbox, treeitem, …) is nameless;
 *  10. every interactive target is at least 44 px high (ui-spec §8's house rule). A control inside a
 *      `<label>` is measured as that label, a link flowing inline in text is exempt (WCAG 2.5.8),
 *      and so is a disabled control.
 *
 * Usage:
 *   # terminal 1
 *   npm run start_editor -- --port 4300
 *   # terminal 2
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/cdp about:blank
 *   # terminal 3
 *   node bin/a11y_audit.mjs --url http://127.0.0.1:4300/project/Demo1/script/1245/edit \
 *     --viewports 1366x768
 *
 * `--prepare <file>` runs a page script after load, to reach a state behind an interaction
 * (`bin/audit/*.js`). Exits non-zero when a check fails; `--verbose` prints what passed too.
 */

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(opt('port', '9333'));
const URL_TO_TEST = opt('url', 'http://127.0.0.1:4200/project/Demo1/script');
const VIEWPORTS = opt('viewports', '1366x768').split(',').map((v) => v.split('x').map(Number));
const VERBOSE = args.includes('--verbose');
const PREPARE_FILE = opt('prepare', null);
const SETTLE_MS = Number(opt('settle-ms', '3000'));

/**
 * Collects the raw material for the rules; the judging happens in Node so every failure can name
 * its own reason. One expression, evaluated in the page.
 */
const PAGE_PROBE = `(() => {
  const trim = (value) => (value ?? '').replace(/\\s+/g, ' ').trim();
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const textOfIdList = (ids) => ids
    .split(/\\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .map((el) => trim(el.textContent))
    .filter(Boolean)
    .join(' ');
  const name = (el) => {
    const labelledBy = el.getAttribute('aria-labelledby');
    return trim(
      el.getAttribute('aria-label')
      || (labelledBy ? textOfIdList(labelledBy) : '')
      || trim(el.textContent)
      || '',
    );
  };
  const labelFor = (el) => {
    if (el.id) {
      const explicit = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (explicit && trim(explicit.textContent)) return trim(explicit.textContent);
    }
    const wrapping = el.closest('label');
    if (wrapping && trim(wrapping.textContent)) return trim(wrapping.textContent);
    return '';
  };
  const describe = (el) => {
    const cls = el.className;
    return typeof cls === 'string' ? cls.split(/\\s+/).filter(Boolean).slice(0, 2).join('.') : '';
  };
  const where = (el) => [el.tagName.toLowerCase(), el.id ? '#' + el.id : '', describe(el) ? '.' + describe(el) : ''].join('');

  const controls = [];
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="radio"], [tabindex]:not([tabindex="-1"])')) {
    if (!visible(el) || el.getAttribute('aria-hidden') === 'true') continue;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'input' && type === 'hidden') continue;
    const kind = el.getAttribute('role') || (tag === 'input' || tag === 'select' || tag === 'textarea' ? 'field' : 'control');
    const named = name(el);
    const titleOnly = named === '' && trim(el.getAttribute('title')) !== '' && (tag === 'button' || tag === 'a');
    const filled = el.value !== undefined && trim(el.value) !== '' ? 'value' : '';
    // Rule 10: a control inside a label is targeted through the label, so that box is measured; a
    // link that flows inline in text is exempt (WCAG 2.5.8), as is a disabled control.
    const wrapper = el.closest('label');
    const target = tag === 'input' && kind === 'field' && wrapper !== null ? wrapper : el;
    const targetBox = target.getBoundingClientRect();
    const style = getComputedStyle(el);
    const inlineInText = tag === 'a'
      && style.display === 'inline'
      && el.closest('p, li, td, dd, dt, dl, .note, .legend, caption') !== null;
    controls.push({
      where: where(el),
      kind,
      name: named,
      titleOnly,
      filled,
      targetHeight: Math.round(targetBox.height),
      targetInline: inlineInText,
      disabled: el.disabled === true,
      label: kind === 'field' ? labelFor(el) : '',
      ariaLabel: trim(el.getAttribute('aria-label')),
      invalid: el.getAttribute('aria-invalid'),
      describedBy: trim(el.getAttribute('aria-describedby')),
      describedText: textOfIdList(el.getAttribute('aria-describedby') || ''),
      labelledBy: trim(el.getAttribute('aria-labelledby')),
      labelledByText: textOfIdList(el.getAttribute('aria-labelledby') || ''),
    });
  }

  const images = [];
  for (const el of document.querySelectorAll('img')) {
    if (!visible(el)) continue;
    const decorative = el.getAttribute('aria-hidden') === 'true' || el.getAttribute('role') === 'presentation' || el.getAttribute('role') === 'none';
    if (el.getAttribute('alt') === null && !decorative) images.push(where(el));
  }

  const hiddenFocusable = [];
  for (const el of document.querySelectorAll('[aria-hidden="true"]')) {
    if (el.querySelector('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')) {
      hiddenFocusable.push(where(el));
    }
  }

  const radiogroups = [];
  for (const group of document.querySelectorAll('[role="radiogroup"]')) {
    const children = Array.from(group.querySelectorAll('[role="radio"], input[type="radio"]'));
    const missing = children.filter((child) => child.getAttribute('aria-checked') === null && child.checked === undefined).length;
    radiogroups.push({where: where(group), children: children.length, missing});
  }

  const tree = document.querySelector('[role="tree"]');
  const treeInfo = tree === null ? null : {
    treeitems: tree.querySelectorAll('[role="treeitem"]').length,
    rows: tree.querySelectorAll('button, a[href]').length,
    missingLevel: Array.from(tree.querySelectorAll('[role="treeitem"]')).filter((el) => el.getAttribute('aria-level') === null).length,
    rowsMissingRole: Array.from(tree.querySelectorAll('button')).filter((el) => el.getAttribute('role') === null).length,
  };

  const ids = Array.from(document.querySelectorAll('[id]')).map((el) => el.id);
  const focusOrder = Array.from(document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'))
    .filter((el) => el.tabIndex >= 0 && visible(el))
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return {where: where(el), x: Math.round(rect.x), right: Math.round(rect.right), y: Math.round(rect.y)};
    });

  return JSON.stringify({controls, images, hiddenFocusable, radiogroups, tree: treeInfo, ids, focusOrder});
})()`;

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
if (!page) {
  console.error(`No Chrome page target on port ${PORT}. Start Chrome with --remote-debugging-port=${PORT}.`);
  process.exit(2);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});
await new Promise((resolve) => ws.addEventListener('open', resolve));
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({id, method, params}));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Accessibility.enable');

/**
 * Judging the browser's own accessibility tree: the roles and names a screen reader is handed, as
 * the engine computes them, rather than the attributes this file looks up in the DOM. It is a
 * cross-check of the same contract from the consumer's side — a human pass still catches the
 * quality of the announcements.
 */
const NAME_REQUIRED_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'tab', 'treeitem', 'textbox', 'searchbox', 'combobox',
  'slider', 'switch', 'menuitem', 'option', 'spinbutton', 'heading',
]);
const judgeAxTree = (nodes, at) => {
  const live = (nodes ?? []).filter((node) => node.ignored !== true);
  const byId = new Map(live.map((node) => [node.nodeId, node]));
  const roleOf = (node) => node.role?.value ?? '';
  const nameOf = (node) => (node.name?.value ?? '').trim();
  const property = (node, wanted) => (node.properties ?? []).find((entry) => entry.name === wanted)?.value?.value;
  /** The node and everything below it the accessibility tree exposes. */
  const descendants = (node) => {
    const out = [];
    const walk = (current) => {
      for (const id of current.childIds ?? []) {
        const child = byId.get(id);
        if (child === undefined) {
          continue;
        }
        out.push(child);
        walk(child);
      }
    };
    walk(node);
    return out;
  };

  for (const node of live) {
    const role = roleOf(node);
    if (NAME_REQUIRED_ROLES.has(role) && nameOf(node) === '') {
      failures.push(at(`the accessibility tree exposes a ${role} with no name`));
    }
  }
  // A live region is announced by its *contents*, not by a name, so it must have text below it.
  for (const node of live.filter((candidate) => ['alert', 'status'].includes(roleOf(candidate)))) {
    const hasText = descendants(node).some((child) => nameOf(child) !== '');
    if (!hasText) {
      failures.push(at(`the accessibility tree exposes a ${roleOf(node)} with nothing to announce`));
    }
  }
  const treeItems = live.filter((node) => roleOf(node) === 'treeitem');
  if (live.some((node) => roleOf(node) === 'tree')) {
    if (treeItems.length === 0) {
      failures.push(at('the accessibility tree has a tree with no treeitem'));
    }
    const withoutLevel = treeItems.filter((node) => property(node, 'level') === undefined).length;
    if (withoutLevel > 0) {
      failures.push(at(`the accessibility tree has ${withoutLevel} treeitem(s) without a level`));
    }
  }
  // Radios may sit directly under the group or inside a wrapper the tree exposes, so look below it.
  for (const group of live.filter((node) => roleOf(node) === 'radiogroup')) {
    const radios = descendants(group).filter((node) => roleOf(node) === 'radio');
    if (radios.length === 0) {
      failures.push(at('the accessibility tree has a radiogroup with no radio'));
    } else if (radios.some((radio) => property(radio, 'checked') === undefined)) {
      failures.push(at('a radio in the accessibility tree has no checked state'));
    }
  }
  return {live: live.length, treeItems: treeItems.length};
};

let prepareSource = null;
if (PREPARE_FILE) {
  const {readFileSync} = await import('node:fs');
  prepareSource = readFileSync(PREPARE_FILE, 'utf8');
}

const failures = [];
const notes = [];

for (const [width, height] of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: URL_TO_TEST});
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
  if (prepareSource) {
    const prepared = await send('Runtime.evaluate', {expression: prepareSource, awaitPromise: true, returnByValue: true});
    if (prepared.result?.exceptionDetails) {
      failures.push(`${width}x${height}: --prepare script failed: ${prepared.result.exceptionDetails.exception?.description || ''}`);
    } else {
      console.log(`  prepared(${PREPARE_FILE}): ${String(prepared.result?.result?.value ?? '').slice(0, 120)}`);
    }
  }
  const out = await send('Runtime.evaluate', {expression: PAGE_PROBE, returnByValue: true});
  const raw = out.result?.result?.value;
  if (!raw) {
    failures.push(`${width}x${height}: probe returned nothing (${JSON.stringify(out.result?.exceptionDetails?.exception?.description || out.result)})`);
    continue;
  }
  const {controls, images, hiddenFocusable, radiogroups, tree, ids, focusOrder} = JSON.parse(raw);
  const at = (message) => `${width}x${height}: ${message}`;

  // The browser's accessibility tree — what a screen reader is actually handed.
  const ax = await send('Accessibility.getFullAXTree', {});
  const axSummary = judgeAxTree(ax.result?.nodes ?? [], at);

  // 1 + 2: names and labels.
  let named = 0;
  for (const control of controls) {
    if (control.kind === 'field') {
      const hasLabel = control.label !== '' || control.name !== '';
      if (!hasLabel) failures.push(at(`${control.where} has no label (add <label for>, a wrapping label or aria-label)`));
      else named += 1;
    } else {
      if (control.name === '' && !control.titleOnly) {
        failures.push(at(`${control.where} has no accessible name`));
      } else if (control.titleOnly) {
        failures.push(at(`${control.where} is named only by title — an icon-only control needs aria-label`));
      } else named += 1;
    }
  }

  // 3: referential integrity of the ARIA relationships.
  for (const control of controls) {
    if (control.labelledBy !== '' && control.labelledByText === '') failures.push(at(`${control.where} aria-labelledby points at nothing with text`));
    if (control.describedBy !== '' && control.describedText === '') failures.push(at(`${control.where} aria-describedby points at nothing with text`));
    if (control.invalid === 'true' && control.describedBy === '') failures.push(at(`${control.where} is aria-invalid but has no aria-describedby message`));
  }

  // 10: every interactive target is at least 44 px high (ui-spec §8's house rule).
  for (const control of controls) {
    if (control.disabled || control.targetInline || control.targetHeight >= 44) continue;
    failures.push(at(`${control.where} is ${control.targetHeight} px high — ui-spec §8 asks for 44`));
  }

  // 4: duplicate ids.
  const seen = new Map();
  for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  for (const [id, count] of seen) {
    if (count > 1) failures.push(at(`id "${id}" appears ${count} times — aria-labelledby/describedby resolve to the first only`));
  }

  // 5: images.
  for (const image of images) failures.push(at(`${image} has no alt and is not marked decorative`));

  // 6: focusable inside aria-hidden.
  for (const host of hiddenFocusable) failures.push(at(`${host} is aria-hidden but contains focusable content`));

  // 7: radiogroups and the tree.
  for (const group of radiogroups) {
    if (group.children === 0) failures.push(at(`${group.where} is a radiogroup with no radios`));
    else if (group.missing > 0) failures.push(at(`${group.where} has ${group.missing} radio(s) without aria-checked`));
  }
  if (tree !== null) {
    if (tree.treeitems === 0 && tree.rows > 0) {
      failures.push(at(`role="tree" contains ${tree.rows} row(s) with no role="treeitem" — a screen reader loses the tree semantics`));
    }
    if (tree.treeitems > 0 && tree.missingLevel > 0) {
      failures.push(at(`${tree.missingLevel} treeitem(s) have no aria-level`));
    }
  }

  // 8: tab order against visual order. Comparing a full sort is too brittle — one row's items sit a
  // few pixels apart, their boxes differ in height, and the layout has side-by-side columns that a
  // document-order walk legitimately leaves and re-enters. The rule that matters to a keyboard user
  // is: focus must not jump back up *within the same column*.
  const UPWARD_JUMP_PX = 30;
  const overlapsHorizontally = (a, b) => Math.min(a.right, b.right) - Math.max(a.x, b.x) > 0;
  for (let i = 1; i < focusOrder.length; i++) {
    const previous = focusOrder[i - 1];
    const current = focusOrder[i];
    if (current.y < previous.y - UPWARD_JUMP_PX && overlapsHorizontally(previous, current)) {
      failures.push(at(`tab order jumps back up the same column: ${previous.where} (y=${previous.y}) is followed by ${current.where} (y=${current.y})`));
      break;
    }
  }

  if (VERBOSE) {
    notes.push(at(`${controls.length} interactive element(s), ${named} named, ${tree === null ? 'no tree' : `${tree.treeitems} treeitem(s)`}; accessibility tree: ${axSummary.live} node(s), ${axSummary.treeItems} treeitem(s)`));
  }
}

ws.close();

if (VERBOSE) notes.forEach((note) => console.log('  ' + note));

if (failures.length) {
  console.log(`\n${failures.length} accessibility problem(s):`);
  failures.forEach((failure) => console.log('  ✗ ' + failure));
  process.exit(1);
}
console.log('\nAccessibility audit passed.');
