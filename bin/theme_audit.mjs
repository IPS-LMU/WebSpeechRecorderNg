#!/usr/bin/env node
/**
 * Theme audit for the Umeå University redesign.
 *
 * Drives an already-running Chrome over the DevTools Protocol and checks the rendered
 * application against the brand rules that a screenshot cannot verify:
 *
 *   1. no legacy colour literals survive (the green/lightgrey/darkgray/grey/red/yellow set)
 *   2. measured text contrast meets WCAG AA (4.5:1, or 3:1 for large text)
 *   3. no text renders below the smallest token size (13.6px), icons excepted
 *   4. the application still fits the viewport without document scrollbars
 *   5. non-text contrast (WCAG 1.4.11): a boundary that carries meaning — an element that announces a
 *      state by ARIA or a state class and has a border, outline or box-shadow — reaches 3:1 against
 *      what it sits on. Decorative lines are exempt; the rule only applies where a state is announced.
 *
 * Usage:
 *   # terminal 1
 *   npm start
 *   # terminal 2
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --remote-debugging-port=9333 about:blank
 *   node bin/theme_audit.mjs --url http://127.0.0.1:4200/spr \
 *     --viewports 1024x768,1366x768,1568x1334,1920x1080
 *
 * Exits non-zero when a check fails. `--verbose` prints the full colour inventory.
 */

import {readFileSync} from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(opt('port', '9333'));
const URL_TO_TEST = opt('url', 'http://127.0.0.1:4200/spr');
const VIEWPORTS = opt('viewports', '1568x1334').split(',').map(v => v.split('x').map(Number));
const VERBOSE = args.includes('--verbose');
const MIN_TEXT_PX = Number(opt('min-text-px', '13.6')) - 0.1;
/**
 * Optional script evaluated in the page after load and before measuring, to reach states
 * that need interaction (overlays, dialogs). See `bin/audit/`.
 */
const PREPARE_FILE = opt('prepare', '');
const PREPARE_SOURCE = PREPARE_FILE ? readFileSync(PREPARE_FILE, 'utf8') : '';

/** Colours that must not appear anywhere after the redesign. */
const FORBIDDEN = {
  'rgb(76, 175, 80)': 'Material green primary (M2 default)',
  'rgb(211, 211, 211)': 'lightgrey',
  'rgb(169, 169, 169)': 'darkgray',
  'rgb(128, 128, 128)': 'grey',
  'rgb(255, 255, 0)': 'yellow',
  'rgb(255, 0, 0)': 'red',
  'rgb(255, 165, 0)': 'orange',
  'rgb(0, 200, 83)': '#00c853 (live level)',
};
const FORBIDDEN_FONTS = ['Arial', 'Times New Roman'];

const PAGE_PROBE = `(() => {
  const parse = (value) => {
    if (!value) return null;
    const v = value.trim();
    if (v === 'transparent' || v === 'none') return [0, 0, 0, 0];
    let m = v.match(/^rgba?\\(([^)]+)\\)$/);
    if (m) {
      const parts = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
      if (parts.length >= 3) return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
    }
    m = v.match(/^color\\(srgb ([\\d.]+) ([\\d.]+) ([\\d.]+)(?: \\/ ([\\d.]+))?\\)$/);
    if (m) {
      return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255, m[4] === undefined ? 1 : Number(m[4])];
    }
    m = v.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    return null;
  };
  const over = (fg, bg) => {
    const a = fg[3];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  };
  const effectiveBackground = (el) => {
    let node = el;
    let acc = null;
    while (node && node.nodeType === 1) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c[3] > 0) {
        acc = acc === null ? c : over(acc, c);
        if (c[3] === 1) break;
      }
      node = node.parentElement;
    }
    return acc === null || acc[3] < 1 ? over(acc || [255, 255, 255, 1], [255, 255, 255, 1]) : acc;
  };
  const label = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).filter(c => !c.startsWith('ng-') && !c.startsWith('_ng') && !c.startsWith('cdk-') && c !== 'mat-mdc-button-persistent-ripple' && c !== 'mdc-button__ripple').slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  // Branding marks: a 404 asset is invisible to the colour checks, so they are reported
  // separately with their natural size and rendered position.
  const logos = Array.from(document.querySelectorAll('spr-logos img')).map(img => {
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    return {
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt') || '',
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      plate: cs.backgroundColor,
      parent: label(img.closest('spr-logos') || img),
      inControlBar: !!img.closest('.controlpanel'),
    };
  });
  // Transport bar: marks must not collide with the state indicators, everything must stay
  // inside the bar, and the transport buttons must keep a usable target size.
  const controlBar = (() => {
    const panel = document.querySelector('div.controlpanel');
    if (!panel) return null;
    const box = el => {
      const r = el.getBoundingClientRect();
      return {x: r.x, y: r.y, width: r.width, height: r.height};
    };
    return {
      panel: box(panel),
      logos: Array.from(panel.querySelectorAll('spr-logos img')).map(img => ({src: img.getAttribute('src'), ...box(img)})),
      logoHosts: Array.from(panel.querySelectorAll('spr-logos')).map(host => box(host)),
      indicators: ['app-uploadstatus', 'app-wakelockindicator', 'app-readystateindicator']
        .flatMap(sel => Array.from(panel.querySelectorAll(sel)).map(el => ({selector: sel, ...box(el)}))),
      buttons: Array.from(panel.querySelectorAll('app-sprtransport button')).map(btn => box(btn)),
    };
  })();
  const overlaps = (a, b) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const controlProblems = [];
  if (controlBar) {
    const bar = controlBar.panel;
    for (const item of [...controlBar.logos, ...controlBar.logoHosts, ...controlBar.indicators, ...controlBar.buttons]) {
      if (item.width < 1 || item.height < 1) continue; // hidden, not laid out
      if (item.x < bar.x - 1 || item.y < bar.y - 1 ||
          item.x + item.width > bar.x + bar.width + 1 || item.y + item.height > bar.y + bar.height + 1) {
        controlProblems.push('outside the transport bar: ' + (item.src || item.selector || 'button') +
          ' at ' + [Math.round(item.x), Math.round(item.y), Math.round(item.width), Math.round(item.height)].join(','));
      }
    }
    for (const logo of controlBar.logos) {
      for (const indicator of controlBar.indicators) {
        if (overlaps(logo, indicator)) {
          controlProblems.push('logo ' + logo.src + ' overlaps ' + indicator.selector);
        }
      }
    }
    for (const button of controlBar.buttons) {
      if (button.width < 40) {
        controlProblems.push('transport button squeezed to ' + Math.round(button.width) + 'px');
      }
    }
  }
  const railFit = (() => {
    const rail = document.querySelector('app-sprprogress');
    const table = rail ? rail.querySelector('table') : null;
    if (!rail || !table) return null;
    const cs = getComputedStyle(rail);
    const inner = rail.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return {inner: Math.round(inner), table: Math.round(table.getBoundingClientRect().width)};
  })();
  const ownText = (el) => Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').trim();
  const rows = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const cs = getComputedStyle(el);
    const text = ownText(el);
    rows.push({
      label: label(el),
      text: text.slice(0, 40),
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      color: cs.color,
      background: cs.backgroundColor,
      effectiveBg: 'rgb(' + effectiveBackground(el).slice(0, 3).map(Math.round).join(', ') + ')',
      borderTop: cs.borderTopColor + ' ' + cs.borderTopWidth,
      fontSize: parseFloat(cs.fontSize),
      fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      fontWeight: cs.fontWeight,
      disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || !!el.closest('[disabled],[aria-disabled="true"]'),
      decorative: el.getAttribute('aria-hidden') === 'true' || !!el.closest('[aria-hidden="true"]'),
      isIcon: el.tagName === 'MAT-ICON' || (cs.fontFamily.includes('Material Icons')),
      // A state marker is a boundary that carries meaning: the element announces a state and a
      // border, outline or box-shadow is what shows it. WCAG 1.4.11 asks 3:1 of that boundary, and
      // the text rule cannot see it (§11.45's residual).
      state: (() => {
        const aria = el.getAttribute('aria-selected') === 'true' ? 'aria-selected'
          : (el.getAttribute('aria-current') && el.getAttribute('aria-current') !== 'false') ? 'aria-current'
          : el.getAttribute('aria-checked') === 'true' ? 'aria-checked'
          : el.getAttribute('aria-invalid') === 'true' ? 'aria-invalid' : '';
        if (aria) return aria;
        const classes = typeof el.className === 'string' ? el.className.split(/\\s+/) : [];
        return classes.find(c => /^(selected|current|active|checked|is-[a-z][a-z-]*)$/.test(c)) || '';
      })(),
      boundaries: (() => {
        const out = [];
        for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
          const w = parseFloat(cs['border' + side + 'Width']) || 0;
          if (w > 0) out.push(['border-' + side.toLowerCase(), cs['border' + side + 'Color']]);
        }
        if (cs.boxShadow && cs.boxShadow !== 'none') out.push(['box-shadow', cs.boxShadow]);
        const ow = parseFloat(cs.outlineWidth) || 0;
        if (ow > 0 && cs.outlineStyle && cs.outlineStyle !== 'none') out.push(['outline', cs.outlineColor]);
        return out;
      })(),
      visible: cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05,
    });
  });
  const rootStyle = getComputedStyle(document.documentElement);
  const tokens = {};
  for (const name of Array.from(rootStyle).filter(n => n.startsWith('--spr-'))) {
    tokens[name] = rootStyle.getPropertyValue(name).trim();
  }
  // The Material roles must resolve to the brand tokens; an inert token layer (e.g. emitted
  // under a selector that never matches) leaves them on the generated ramp values instead.
  const pinto = [
    ['--mat-sys-primary', '--spr-primary'],
    ['--mat-sys-on-primary', '--spr-primary-ink'],
    ['--mat-sys-surface', '--spr-surface'],
    ['--mat-sys-error-container', '--spr-alert'],
    ['--mat-toolbar-container-background-color', '--spr-chrome'],
    ['--mat-toolbar-container-text-color', '--spr-chrome-ink'],
  ];
  const pins = pinto.map(([matName, sprName]) => [
    matName, sprName,
    rootStyle.getPropertyValue(matName).trim(),
    rootStyle.getPropertyValue(sprName).trim(),
  ]);
  return JSON.stringify({
    rows,
    logos,
    controlProblems,
    railFit,
    tokens,
    pins,
    fit: { scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight },
  });
})()`;

const toRgbString = (value) => {
  const m = String(value).match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  return 'rgb(' + m[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).map(Number).map(Math.round).join(', ') + ')';
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const parseCss = (value) => {
  const m = String(value).match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }
  // Newer Chromium reports some computed colours in the colour-4 syntax.
  const srgb = String(value).match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/);
  if (srgb) {
    return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
  }
  return null;
};

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find(t => t.type === 'page');
if (!page) {
  console.error(`No Chrome page target on port ${PORT}. Start Chrome with --remote-debugging-port=${PORT}.`);
  process.exit(2);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
await new Promise(r => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise(res => {
  const id = ++seq;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: VIEWPORTS[0][0], height: VIEWPORTS[0][1], deviceScaleFactor: 1, mobile: false });

const failures = [];
const inventory = new Map();

for (const [width, height] of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_TO_TEST });
  await new Promise(r => setTimeout(r, 9000));
  if (PREPARE_SOURCE) {
    const prepared = await send('Runtime.evaluate', {
      expression: PREPARE_SOURCE,
      awaitPromise: true,
      returnByValue: true,
    });
    if (prepared.result?.exceptionDetails) {
      failures.push(`${width}x${height}: --prepare script failed: ${prepared.result.exceptionDetails.exception?.description || ''}`);
    } else {
      console.log(`  prepared(${PREPARE_FILE}): ${String(prepared.result?.result?.value ?? '').slice(0, 120)}`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  const out = await send('Runtime.evaluate', { expression: PAGE_PROBE, returnByValue: true });
  const raw = out.result?.result?.value;
  if (!raw) {
    failures.push(`${width}x${height}: probe returned nothing (${JSON.stringify(out.result?.exceptionDetails?.exception?.description || out.result)})`);
    continue;
  }
  const { rows, logos, controlProblems, railFit, tokens, pins, fit } = JSON.parse(raw);
  if (railFit && railFit.table > railFit.inner + 1) {
    failures.push(
      `${width}x${height}: progress table ${railFit.table}px is wider than the rail's ${railFit.inner}px box (clipped)`
    );
  }
  for (const problem of controlProblems || []) {
    failures.push(`${width}x${height}: ${problem}`);
  }
  const tokenColors = new Set(Object.values(tokens).map(toRgbString).filter(Boolean));

  for (const logo of logos || []) {
    const [lx, ly, lw, lh] = logo.rect;
    if (lw < 1 || lh < 1) continue; // hidden by a responsive rule: not rendered, not measured
    if (!logo.naturalWidth || !logo.naturalHeight) {
      failures.push(`${width}x${height}: logo ${logo.src} did not load (natural size 0)`);
      continue;
    }
    if (!logo.alt) {
      failures.push(`${width}x${height}: logo ${logo.src} has no alt text`);
    }
    if (lh < 16 || lh > 64) {
      failures.push(`${width}x${height}: logo ${logo.src} renders ${lh}px tall (expected 16-64)`);
    }
    const naturalRatio = logo.naturalWidth / logo.naturalHeight;
    const renderedRatio = lw / lh;
    const drift = Math.abs(renderedRatio - naturalRatio) / naturalRatio;
    if (drift > 0.02) {
      failures.push(
        `${width}x${height}: logo ${logo.src} aspect ratio changed ` +
        `(${renderedRatio.toFixed(2)} vs natural ${naturalRatio.toFixed(2)})`
      );
    }
    if (lx < 0 || ly < 0 || lx + lw > width || ly + lh > height) {
      failures.push(`${width}x${height}: logo ${logo.src} is outside the viewport (${logo.rect.join(',')})`);
    }
  }
  // Marks sharing the transport bar with the state indicators must not collide with them.
  const controlLogos = (logos || []).filter(l => l.inControlBar);
  if (controlLogos.length > 1) {
    const sorted = controlLogos.slice().sort((a, b) => a.rect[0] - b.rect[0]);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].rect;
      if (sorted[i].rect[0] < prev[0] + prev[2]) {
        failures.push(
          `${width}x${height}: control-bar logos overlap ` +
          `(${sorted[i - 1].src} ends ${prev[0] + prev[2]}, ${sorted[i].src} starts ${sorted[i].rect[0]})`
        );
      }
    }
  }

  if (!Object.keys(tokens).length) {
    failures.push(`${width}x${height}: no --spr-* tokens are defined (token layer inert)`);
  }
  for (const [matName, sprName, matValue, sprValue] of pins || []) {
    const referenced = String(matValue).match(/^var\(\s*(--[a-z0-9-]+)/i);
    const matches = referenced
      ? referenced[1] === sprName
      : String(matValue).replace(/\s+/g, '').toLowerCase() === String(sprValue).replace(/\s+/g, '').toLowerCase();
    if (!matValue || !sprValue || !matches) {
      failures.push(
        `${width}x${height}: ${matName} does not follow ${sprName} ` +
        `(${matName}=${matValue || 'unset'}, ${sprName}=${sprValue || 'unset'})`
      );
    }
  }

  for (const row of rows) {
    if (!row.visible || row.decorative) continue;
    const bgParsed = parseCss(row.background);
    const bg = bgParsed && bgParsed[3] > 0 ? toRgbString(row.background) : null;
    const fg = toRgbString(row.color);
    if (bg) inventory.set(bg, (inventory.get(bg) || 0) + 1);

    if (bg && FORBIDDEN[bg]) {
      failures.push(`${width}x${height}: ${row.label} uses ${bg} (${FORBIDDEN[bg]})`);
    }
    if (fg && FORBIDDEN[fg] && row.text) {
      failures.push(`${width}x${height}: ${row.label} text colour ${fg} (${FORBIDDEN[fg]})`);
    }

    if (FORBIDDEN_FONTS.includes(row.fontFamily) && row.text) {
      failures.push(`${width}x${height}: ${row.label} renders in ${row.fontFamily}`);
    }

    if (row.text && !row.isIcon && row.fontSize < MIN_TEXT_PX) {
      failures.push(`${width}x${height}: ${row.label} text "${row.text}" at ${row.fontSize}px (< ${MIN_TEXT_PX}px)`);
    }

    if (row.text && !row.isIcon && !row.disabled && fg) {
      const fgWithAlpha = parseCss(row.color);
      const effBg = parseCss(row.effectiveBg);
      if (fgWithAlpha && effBg) {
        const alpha = fgWithAlpha[3];
        const composited = alpha < 1
          ? [
            fgWithAlpha[0] * alpha + effBg[0] * (1 - alpha),
            fgWithAlpha[1] * alpha + effBg[1] * (1 - alpha),
            fgWithAlpha[2] * alpha + effBg[2] * (1 - alpha),
          ]
          : [fgWithAlpha[0], fgWithAlpha[1], fgWithAlpha[2]];
        const bold = Number(row.fontWeight) >= 700;
        const large = row.fontSize >= 24 || (bold && row.fontSize >= 18.66);
        const required = large ? 3 : 4.5;
        const ratio = contrast(composited, [effBg[0], effBg[1], effBg[2]]);
        if (ratio < required) {
          failures.push(
            `${width}x${height}: ${row.label} "${row.text}" contrast ${ratio.toFixed(2)}:1 < ${required}:1 ` +
            `(fg ${row.color} on ${row.effectiveBg}, ${row.fontSize}px/${row.fontWeight})`
          );
        }
      }
    }

    if (bg && !tokenColors.has(bg) && !FORBIDDEN[bg] && VERBOSE) {
      console.log(`  off-token background: ${bg} on ${row.label} (${row.rect.join(',')})`);
    }
  }

  // Non-text contrast (WCAG 1.4.11): a boundary that carries meaning must reach 3:1 against what it
  // sits on. This is the rule that would have caught the picker's selected-row marker at 1.73:1 in
  // the dark scheme (§11.45), which the text rule cannot see. Decorative lines are deliberately
  // exempt: it applies only where the element announces a state.
  for (const row of rows) {
    if (!row.state || !row.visible || row.disabled || row.decorative) continue;
    // Once per colour: a border is normally the same on all four sides, and four identical failures
    // would bury the one that matters.
    const seen = new Set();
    for (const [channel, value] of row.boundaries || []) {
      const key = channel.startsWith('border-') ? String(value) : channel + ':' + String(value);
      if (seen.has(key)) continue;
      seen.add(key);
      const colour = channel === 'box-shadow'
        ? (String(value).match(/rgba?\([^)]+\)|color\(srgb [^)]+\)/) || [])[0]
        : value;
      const parsed = colour ? parseCss(colour) : null;
      if (!parsed || parsed[3] === 0) continue;
      const bg = parseCss(row.effectiveBg) || [255, 255, 255, 1];
      const composited = parsed[3] < 1
        ? [
            parsed[0] * parsed[3] + bg[0] * (1 - parsed[3]),
            parsed[1] * parsed[3] + bg[1] * (1 - parsed[3]),
            parsed[2] * parsed[3] + bg[2] * (1 - parsed[3]),
          ]
        : [parsed[0], parsed[1], parsed[2]];
      const ratio = contrast(composited, [bg[0], bg[1], bg[2]]);
      if (ratio < 3) {
        const named = channel.startsWith('border-') ? 'border' : channel;
        failures.push(
          `${width}x${height}: ${row.label} state marker (${row.state}) ${named} contrast ` +
          `${ratio.toFixed(2)}:1 < 3:1 (${composited.map(Math.round).join(',')} on ${row.effectiveBg})`
        );
      }
    }
  }
  if (fit.scrollHeight > fit.innerHeight + 1) {
    failures.push(`${width}x${height}: document scrolls (scrollHeight ${fit.scrollHeight} > viewport ${fit.innerHeight})`);
  } else {
    console.log(`fit ok at ${width}x${height} (${fit.scrollHeight} <= ${fit.innerHeight})`);
  }
}

console.log(`\n${inventory.size} distinct rendered background colours`);

if (VERBOSE) {
  console.log('--- rendered colour inventory ---');
  [...inventory.entries()].sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}  x${n}`));
}

ws.close();

if (failures.length) {
  console.log(`\n${failures.length} problem(s):`);
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('\nTheme audit passed.');
