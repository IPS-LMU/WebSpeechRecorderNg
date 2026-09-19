#!/usr/bin/env node
/**
 * Layout probe for the prompt stage's instruction line and the branding slots.
 *
 * A screenshot cannot tell 2px from 0.2px, and the browser that took it is not necessarily the
 * engine a deployment runs. This measures rectangles instead: the instruction line's text against
 * the centre line of the header it sits in (it belongs centred, at the operator's caption size and
 * at the larger caption the respondent mirror sets), and which marks each branding slot actually
 * shows at a given width — the trailing cluster drops marks as the bar narrows, the leading one
 * keeps them.
 *
 * Usage:
 *   # terminal 1
 *   npm start
 *   # terminal 2
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --remote-debugging-port=9333 about:blank &
 *   node bin/layout_probe.mjs --url http://127.0.0.1:4200/spr/session/2
 *   node bin/layout_probe.mjs --url http://127.0.0.1:4200/spr/session/2 \
 *     --mirror http://127.0.0.1:4200/spr/respondent/2 --viewports 1568x986,1280x800
 *
 * Safari, with remote automation allowed (Safari > Develop > Allow Remote Automation) and the
 * driver running:
 *   /usr/bin/safaridriver -p 4459 &
 *   node bin/layout_probe.mjs --browser safari --url ... --mirror ...
 *
 * Exits non-zero when the instruction line sits further from the header's centre than
 * `--tolerance` px, when a page reports no stage, or when a page overflows its viewport.
 */
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const URL_TO_TEST = opt('url', 'http://127.0.0.1:4200/spr');
const MIRROR_URL = opt('mirror', '');
const VIEWPORTS = opt('viewports', '1568x986').split(',').map((v) => v.split('x').map(Number));
const BROWSER = opt('browser', 'chrome');
const PORT = Number(opt('port', BROWSER === 'safari' ? '4459' : '9333'));
/** The demo's current item carries no instruction string; write one before measuring geometry. */
const TEXT = opt('text', '1/21: Please answer:');
const TOLERANCE = Number(opt('tolerance', '1'));
const SETTLE = Number(opt('settle', '7000'));
const AS_JSON = args.includes('--json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One measurement, shared by both transports: a function body ending in `return`, so the DevTools
 * protocol can run it as an expression and WebDriver as a script.
 */
const MEASURE = `
const label = document.querySelector('spr-recinstructions');
const header = document.querySelector('.spr-stage-header');
if (!label || !header) return JSON.stringify({state: 'no stage on the page', url: location.href});
${TEXT ? `label.textContent = ${JSON.stringify(TEXT)};` : ''}
const box = (el) => { const r = el.getBoundingClientRect();
  return {x: +r.x.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1)}; };
const range = document.createRange();
range.selectNodeContents(label);
const text = range.getBoundingClientRect();
const headerBox = header.getBoundingClientRect();
const style = getComputedStyle(label);
const stage = document.querySelector('app-sprpromptingcontainer');
const status = document.querySelector('div.controlpanel app-sprstatusdisplay');
const root = document.scrollingElement;
return JSON.stringify({
  url: location.href,
  engine: navigator.userAgent.slice(0, 64),
  viewport: [innerWidth, innerHeight],
  text: label.textContent.trim(),
  captionPx: style.fontSize,
  lineHeight: style.lineHeight,
  padding: style.padding,
  headerH: +headerBox.height.toFixed(1),
  headerMinHeight: getComputedStyle(header).minHeight,
  textOffsetFromHeaderCentre: +((text.y + text.height / 2) - (headerBox.y + headerBox.height / 2)).toFixed(2),
  labelLeftMinusStageLeft: stage ? +(label.getBoundingClientRect().x - stage.getBoundingClientRect().x).toFixed(1) : null,
  statusX: status ? +status.getBoundingClientRect().x.toFixed(1) : null,
  slots: [...document.querySelectorAll('spr-logos')].map((slot) => ({
    classes: slot.className || '(plain)',
    display: getComputedStyle(slot).display,
    box: box(slot),
    marks: [...slot.querySelectorAll('.spr-logo-plate')]
      .filter((plate) => getComputedStyle(plate).display !== 'none')
      .map((plate) => plate.querySelector('img').getAttribute('src').split('/').pop()),
  })),
  fits: root.scrollWidth <= root.clientWidth,
});
`;

/** DevTools protocol: one target per page, viewport per target. */
async function chromeTransport(port) {
  const base = `http://127.0.0.1:${port}`;
  const pages = [];
  return {
    async open(url, [width, height]) {
      const target = await (await fetch(`${base}/json/new?${encodeURIComponent('about:blank')}`, {method: 'PUT'})).json();
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve) => ws.addEventListener('open', resolve, {once: true}));
      let id = 0;
      const pending = new Map();
      ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
      });
      const send = (method, params = {}) => new Promise((resolve) => {
        const mid = ++id;
        pending.set(mid, resolve);
        ws.send(JSON.stringify({id: mid, method, params}));
      });
      await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
      await send('Page.navigate', {url});
      pages.push({ws, target});
      return {
        async measure() {
          await sleep(SETTLE);
          const out = await send('Runtime.evaluate', {expression: `(() => {${MEASURE}})()`, returnByValue: true});
          const value = out.result?.result?.value;
          if (typeof value !== 'string') throw new Error('probe returned nothing: ' + JSON.stringify(out.result).slice(0, 200));
          return JSON.parse(value);
        },
      };
    },
    async close() {
      for (const {ws, target} of pages) {
        ws.close();
        await fetch(`${base}/json/close/${target.id}`).catch(() => {});
      }
    },
  };
}

/**
 * WebDriver: Safari sizes its window, not a viewport, and refuses to go below the screen's floor —
 * the measurement reports the viewport it really got.
 */
async function webdriverTransport(port) {
  const base = `http://127.0.0.1:${port}`;
  const cmd = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body ? {'content-type': 'application/json'} : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  };
  const created = await cmd('POST', '/session', {capabilities: {alwaysMatch: {browserName: 'safari'}}});
  const session = created.value?.sessionId ?? created.sessionId;
  if (!session) {
    throw new Error('could not create a safari session: ' + JSON.stringify(created).slice(0, 200)
      + '\nSafari must not be running: the driver starts its own instance and an already running one'
      + ' does not answer. Quit it first, e.g.  osascript -e \'quit app "Safari"\'');
  }
  let opened = 0;
  return {
    async open(url, [width, height]) {
      if (opened++ === 0) {
        await cmd('POST', `/session/${session}/window/rect`, {width, height, x: 0, y: 0});
      } else {
        const win = await cmd('POST', `/session/${session}/window/new`, {type: 'tab'});
        if (win.value?.handle) await cmd('POST', `/session/${session}/window`, {handle: win.value.handle});
      }
      await cmd('POST', `/session/${session}/url`, {url});
      return {
        async measure() {
          await sleep(SETTLE);
          const out = await cmd('POST', `/session/${session}/execute/sync`, {script: MEASURE, args: []});
          if (typeof out.value !== 'string') throw new Error('probe returned nothing: ' + JSON.stringify(out).slice(0, 200));
          return JSON.parse(out.value);
        },
      };
    },
    async close() { await cmd('DELETE', `/session/${session}`); },
  };
}

const browser = BROWSER === 'safari' ? await webdriverTransport(PORT) : await chromeTransport(PORT);
const measurements = [];
try {
  for (const viewport of VIEWPORTS) {
    for (const url of [URL_TO_TEST, MIRROR_URL].filter(Boolean)) {
      const page = await browser.open(url, viewport);
      measurements.push(await page.measure());
    }
  }
} finally {
  await browser.close();
}

if (AS_JSON) {
  console.log(JSON.stringify(measurements, null, 1));
} else {
  for (const m of measurements) {
    const where = `${m.url} @${m.viewport[0]}x${m.viewport[1]}`;
    if (m.state) {
      console.log(`${where}\n  ${m.state}`);
      continue;
    }
    console.log(`${where}`);
    console.log(`  instruction line ${m.captionPx}/${m.lineHeight}, padding ${m.padding}, text ${JSON.stringify(m.text)}`);
    console.log(`  header ${m.headerH}px (min ${m.headerMinHeight}) -> text centre ${m.textOffsetFromHeaderCentre}px from it`);
    for (const slot of m.slots) {
      const marks = slot.marks.length ? slot.marks.join(', ') : '(none shown)';
      console.log(`  ${slot.classes} display=${slot.display} x=${slot.box.x} ${marks}`);
    }
    console.log(`  status x=${m.statusX}  fits=${m.fits}`);
  }
}

const failures = measurements.filter((m) => m.state
  || !m.fits
  || !Number.isFinite(m.textOffsetFromHeaderCentre)
  || Math.abs(m.textOffsetFromHeaderCentre) > TOLERANCE);
if (failures.length) {
  console.error(`\n${failures.length} of ${measurements.length} measurements outside tolerance:`);
  for (const m of failures) {
    console.error(m.state
      ? `  ${m.url}: ${m.state}`
      : `  ${m.url} @${m.viewport[0]}x${m.viewport[1]}: text ${m.textOffsetFromHeaderCentre}px from the header centre (tolerance ${TOLERANCE}), fits=${m.fits}`);
  }
  process.exitCode = 1;
} else {
  console.log(`\nLayout probe passed: ${measurements.length} measurement(s) within ${TOLERANCE}px.`);
}
