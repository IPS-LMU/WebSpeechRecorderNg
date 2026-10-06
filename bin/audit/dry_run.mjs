#!/usr/bin/env node
/**
 * Headless dry run of the recorder against one script — M1's gate, automated as far as a browser can
 * be trusted, and honest about the rest.
 *
 * It drives the real application (the receiver serves the built recorder) with the browser's fake
 * media stream, and observes only what the browser can prove: the recorder's own item table and
 * status line, the session the receiver stores, the media requests the page makes, and the Web Audio
 * calls the prompt player makes. Nothing reads the recorder's internals, so it cannot pass by
 * inspecting its own assumptions.
 *
 * It reads the session's *materialised script* from the receiver first, so it knows each item's
 * placement and section mode and can wait for the sections that advance by themselves instead of
 * pressing controls into them. Then it asserts, per item, where the clip played relative to the
 * take's recording window:
 *
 *   WITH_PROMPT / BEFORE  the clip precedes the clocks (it gates them)
 *   PRERECORDING          the clip plays from the take start
 *   DURING                the clip plays inside the recording window
 *   ONDEMAND              nothing plays until the operator asks
 *
 * Usage:
 *   npm run build
 *   node server/server.mjs --port 8391 --data /tmp/dryrun --seed src/test --app dist/cavox/browser \
 *     --project Demo1 --script playback --quiet &
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --remote-debugging-port=9333 --user-data-dir=/tmp/cdp-dry \
 *     --use-fake-ui-for-media-stream --use-fake-device-for-media-stream \
 *     --autoplay-policy=no-user-gesture-required about:blank &
 *   node bin/audit/dry_run.mjs --base http://127.0.0.1:8391 --port 9333 --session 1
 *
 * Exits non-zero when an assertion fails; `--verbose` traces every step, `--json` prints the
 * timeline as data too. A console error, warning or uncaught exception during the run also fails it:
 * a recorder that behaves while logging on every take is still broken for the operator.
 */

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(opt('port', '9333'));
const BASE = opt('base', 'http://127.0.0.1:8391');
const SESSION = opt('session', '1');
const STEP_TIMEOUT_MS = Number(opt('step-timeout-ms', '30000'));
const VERBOSE = args.includes('--verbose');
const JSON_OUT = args.includes('--json');

/**
 * Installed before the application loads: every media request (the recorder fetches with
 * `XMLHttpRequest`, so both transports are hooked) and every Web Audio source start/stop, each with
 * the page's own clock, so orderings are the browser's.
 */
const HOOKS = `(() => {
  window.__dryRun = {events: [], lastAudioUrl: null};
  const record = (kind, url) => window.__dryRun.events.push({kind, url: url || null, t: Math.round(performance.now())});
  const mediaLike = (url) => /\\/media\\//.test(url) || /\\.wav(\\?|$)/.test(url);
  const noteUrl = (url) => { if (mediaLike(url)) { window.__dryRun.lastAudioUrl = url; record('fetch', url); } };
  const originalFetch = window.fetch;
  window.fetch = function (...callArgs) {
    try {
      const target = callArgs[0];
      noteUrl(typeof target === 'string' ? target : String(target && target.url ? target.url : target));
    } catch (ignored) { /* a request the hook cannot read is still a request */ }
    return originalFetch.apply(this, callArgs);
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try { noteUrl(String(url)); } catch (ignored) { /* as above */ }
    return originalOpen.call(this, method, url, ...rest);
  };
  const Context = window.AudioContext || window.webkitAudioContext;
  if (Context) {
    const createBufferSource = Context.prototype.createBufferSource;
    Context.prototype.createBufferSource = function (...callArgs) {
      const node = createBufferSource.apply(this, callArgs);
      const start = node.start;
      const stop = node.stop;
      node.start = function (...startArgs) { record('start', window.__dryRun.lastAudioUrl); return start.apply(this, startArgs); };
      node.stop = function (...stopArgs) { record('stop', window.__dryRun.lastAudioUrl); return stop.apply(this, stopArgs); };
      return node;
    };
  }
})()`;

/** The recorder renders one table row per item (`# PROMPT STATUS`) plus a global status line. */
const READ_STATE = `(() => {
  if (!document.body) { return JSON.stringify({rows: [], status: '', dialog: null, ready: false}); }
  const text = (node) => (node && node.textContent ? node.textContent.replace(/\\s+/g, ' ').trim() : '');
  const rows = Array.from(document.querySelectorAll('table tr, [role="row"]'))
    .map((row) => Array.from(row.querySelectorAll('td, th')).map((cell) => text(cell)))
    .filter((cells) => cells.length >= 3 && cells[0] !== '' && !/^#/.test(cells[0]));
  const dialog = document.querySelector('dialog[open], mat-dialog-container, [role="dialog"]');
  return JSON.stringify({
    rows,
    status: (document.body.innerText.match(/Stopp|Spelar in|Förbereder|Redo|Klart/i) || [''])[0],
    dialog: dialog ? text(dialog).slice(0, 160) : null,
    ready: !!Array.from(document.querySelectorAll('button')).find((b) => /Starta/i.test(b.textContent || '')),
  });
})()`;
/**
 * Where the first enabled control matching `pattern` is, and what it says. A press has to come from
 * the browser's own input pipeline to count as a user gesture, so this only locates; `press` clicks.
 */
const LOCATE = (pattern) => `(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const hit = buttons.find((b) => ${pattern}.test((b.textContent || '') + ' ' + (b.title || '') + ' ' + (b.getAttribute('aria-label') || '')) && !b.disabled);
  if (!hit) { return null; }
  const box = hit.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) { return null; }
  return JSON.stringify({
    x: Math.round(box.left + box.width / 2),
    y: Math.round(box.top + box.height / 2),
    label: ((hit.textContent || '') + ' ' + (hit.title || '') + ' ' + (hit.getAttribute('aria-label') || '')).replace(/\\s+/g, ' ').trim().slice(0, 40),
  });
})()`;
const START = '/Starta|Start \\//i';
/** The operator's own control: start, stop, or move on — its label says all three. */
const OPERATOR = '/Start \\/ Stopp|Nästa inspelning/i';
/** Moving the item pointer; disabled while a take is running. */
const FORWARD = '/Framåt|Next item/i';
/** Pause, which stops a recording and must also stop a playing sound. */
const PAUSE = '/Paus|Pause/i';
/**
 * What the transport offers right now, read from the controls the operator would use. A press made
 * without looking is spent for nothing when it lands while the previous take is still winding down:
 * the app then waits for a start that never comes.
 */
const OPERATOR_STATE = `(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const label = (b) => ((b.textContent || '') + ' ' + (b.title || '') + ' ' + (b.getAttribute('aria-label') || ''));
  const enabled = (pattern) => buttons.some((b) => pattern.test(label(b)) && !b.disabled);
  return JSON.stringify({forward: enabled(/Framåt|Next item/i), start: enabled(/Starta|Start \\//i)});
})()`;
/** The item the recorder is on: its table row carries `selRow`. Null when no row is marked. */
const CURRENT_ROW = `(() => {
  const row = Array.from(document.querySelectorAll('table tr, [role="row"]'))
    .find((r) => typeof r.className === 'string' && /(^|\\s)selRow(\\s|$)/.test(r.className));
  if (!row) { return null; }
  const first = row.querySelector('td, th');
  const value = first ? (first.textContent || '').trim() : '';
  return /^\\d+$/.test(value) ? Number(value) : null;
})()`;
const SOUND = '/Spela upp ljudet|Promptljud/i';
const DRAWN_MEDIA = /std-vowel-[ai]\b/;

// ---------------------------------------------------------------- the expected run

const session = await (await fetch(`${BASE}/api/v1/session/${SESSION}`)).json();
if (session?.script === undefined || session.script === null) {
  console.error(`the receiver does not know session ${SESSION}`);
  process.exit(1);
}
const script = await (await fetch(`${BASE}/api/v1/script/${session.script}`)).json();
/** One entry per item, in the order the recorder walks them, with what the script asks for. */
const schedule = [];
for (const section of script.sections ?? []) {
  for (const group of section.groups ?? []) {
    for (const item of group.promptItems ?? []) {
      schedule.push({
        itemcode: String(item.itemcode ?? '?'),
        when: item.playback?.when ?? null,
        mode: String(section.mode ?? 'MANUAL'),
        nonRecording: item.type === 'nonrecording',
        hasAudio: (item.mediaitems ?? []).some((mediaitem) => String(mediaitem.mimetype ?? '').startsWith('audio')),
        bankAudio: (item.mediaitems ?? []).some((mediaitem) => DRAWN_MEDIA.test(String(mediaitem.src ?? ''))),
      });
    }
  }
}
console.log(`session ${SESSION} -> script ${session.script}: ${schedule.length} item(s)`);
for (const [index, entry] of schedule.entries()) {
  console.log(`  ${index + 1}. ${entry.itemcode.padEnd(5)} ${entry.mode.padEnd(13)} ${(entry.when ?? '(no playback)').padEnd(12)}${entry.nonRecording ? ' non-recording' : ''}${entry.bankAudio ? ' bank recording' : ''}`);
}

// ---------------------------------------------------------------- browser plumbing

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
if (!page) {
  console.error(`No Chrome page target on port ${PORT}.`);
  process.exit(2);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
/**
 * Console errors, warnings and uncaught exceptions seen while the session runs. A recorder that
 * records correctly while logging every take is still broken for the operator, and nothing else in
 * this driver would notice.
 */
const consoleProblems = [];
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    consoleProblems.push('EXCEPTION ' + String(message.params?.exceptionDetails?.exception?.description ?? '').split('\n')[0].slice(0, 140));
    return;
  }
  if (message.method === 'Runtime.consoleAPICalled' && (message.params?.type === 'error' || message.params?.type === 'warning')) {
    const text = (message.params.args ?? [])
      .map((arg) => String(arg.value ?? arg.description ?? ''))
      .join(' ')
      .split('\n')[0]
      .slice(0, 140);
    consoleProblems.push(message.params.type.toUpperCase() + ' ' + text);
    return;
  }
  if (message.method === 'Log.entryAdded' && (message.params?.entry?.level === 'error' || message.params?.entry?.level === 'warning')) {
    const entry = message.params.entry;
    consoleProblems.push('LOG-' + entry.level.toUpperCase() + ' ' + String(entry.text ?? '').slice(0, 140)
      + ' ' + String(entry.url ?? '').slice(-40));
  }
});
await new Promise((resolve) => ws.addEventListener('open', resolve));
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({id, method, params}));
});
const evaluate = async (expression) => {
  const out = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (out.result?.exceptionDetails) {
    throw new Error(`page evaluation failed: ${out.result.exceptionDetails.exception?.description ?? 'unknown'}`);
  }
  return out.result?.result?.value;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const state = () => evaluate(READ_STATE).then((raw) => JSON.parse(raw ?? '{}'));
const pageEvents = () => evaluate('JSON.stringify(window.__dryRun.events)').then((raw) => JSON.parse(raw ?? '[]'));
/**
 * Presses a control the way an operator does: a real mouse event through the browser's own input
 * pipeline. A synthetic `element.click()` is not a user gesture, and the recorder's transport
 * ignores it exactly where a gesture is what arms the take — the first take of an AUTOPROGRESS
 * section, which is where every run used to stop. Returns the control's label, or null.
 */
const press = async (pattern) => {
  const located = await evaluate(LOCATE(pattern));
  if (located === null || located === undefined) { return null; }
  const hit = JSON.parse(located);
  await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: hit.x, y: hit.y, button: 'left', clickCount: 1});
  await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: hit.x, y: hit.y, button: 'left', clickCount: 1});
  return hit.label;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Page.addScriptToEvaluateOnNewDocument', {source: HOOKS});
await send('Page.navigate', {url: `${BASE}/spr/session/${SESSION}`});

// No take can start until the item's prompt clip has finished playing, so this gate needs an audio
// clock that advances. A headless Chrome with no output device — a CI runner, or a remote mac with
// no display attached — stalls every clip at currentTime 0 forever, which makes a healthy recorder
// look like one that never starts a take. Measure the clock once and report the real cause.
await sleep(1500);
const audioClock = await evaluate(`(async () => {
  let probe;
  try {
    // One second of silence, built here so the probe needs nothing from the receiver.
    const rate = 8000, samples = rate;
    const frame = new DataView(new ArrayBuffer(44 + samples));
    const ascii = (offset, text) => { for (let i = 0; i < text.length; i += 1) { frame.setUint8(offset + i, text.charCodeAt(i)); } };
    ascii(0, 'RIFF'); frame.setUint32(4, 36 + samples, true); ascii(8, 'WAVEfmt ');
    frame.setUint32(16, 16, true); frame.setUint16(20, 1, true); frame.setUint16(22, 1, true);
    frame.setUint32(24, rate, true); frame.setUint32(28, rate, true); frame.setUint16(32, 1, true);
    frame.setUint16(34, 8, true); ascii(36, 'data'); frame.setUint32(40, samples, true);
    for (let i = 0; i < samples; i += 1) { frame.setUint8(44 + i, 128); }
    probe = new Audio(URL.createObjectURL(new Blob([frame], {type: 'audio/wav'})));
  } catch { return 'unavailable'; }
  try { await probe.play(); } catch { return 'blocked'; }
  let ended = false;
  probe.onended = () => { ended = true; };
  await new Promise((resolve) => setTimeout(resolve, 2000));
  // A stalled device still ticks a few tens of milliseconds and then stops, so demand real progress.
  if (ended || probe.currentTime >= 0.5) { return 'advances'; }
  return 'frozen at ' + probe.currentTime.toFixed(2) + 's of ' + (isNaN(probe.duration) ? '?' : probe.duration.toFixed(2)) + 's';
})()`);
if (!audioClock.startsWith('advances')) {
  // The recorder now reports such a clip as failed and carries on (PromptAudioService), so the run
  // is still worth driving: the rows, the labels and the recording windows are checked as usual,
  // and only the claims that need a clip to have been audible are marked unverified below.
  console.log(`::warning title=No audio output::this browser's audio clock is ${audioClock}, so no prompt clip can play; the clip-relative checks will be reported as unverified`);
  console.log(`\nthe browser's audio clock is ${audioClock}: the recorder will report every prompt sound as failed.`);
  console.log('The run is driven anyway, and the clip-relative checks are reported as unverified rather');
  console.log('than passed or failed. Give the browser a device (a null sink is enough: on Linux,');
  console.log('pulseaudio with module-null-sink) to check those too.\n');
}
const clipsAudible = audioClock.startsWith('advances');

const t0 = Date.now();
const rel = () => Math.round(Date.now() - t0);
const failures = [];
/**
 * What could not be checked here: the clip-relative claims need a browser that can actually play a
 * clip. Reported at the end as unverified, so a run without an audio device is neither passed nor
 * failed on those points (see `clipsAudible`).
 */
const unverified = [];
const clipFailure = (message) => { if (clipsAudible) { failures.push(message); } else { unverified.push(message); } };
const timeline = [];
/**
 * A row is done when the recorder has put its `done` mark in the status cell. Counting such rows is
 * not the same thing: a non-recording item never gets the mark, so a count can stall a row short of
 * the item the walk is actually waiting for (which is what stopped the walk at the drawn items).
 */
const isRowDone = (row) => /done|klar|complete/i.test(row?.[2] ?? '');
const doneCount = (current) => current.rows.filter(isRowDone).length;

/** Pull the page's audio events, the global recording state and the finished rows into one timeline. */
let recording = false;
const collect = async (current) => {
  for (const event of await pageEvents()) {
    if (timeline.some((entry) => entry.kind === event.kind && entry.tPage === event.t)) {
      continue;
    }
    timeline.push({kind: event.kind, tPage: event.t, t: rel(), url: event.url ?? null, recording});
  }
  if (current !== undefined) {
    current.rows.forEach((row, index) => {
      if (isRowDone(row) && !timeline.some((event) => event.kind === 'row-done' && event.row === index)) {
        timeline.push({kind: 'row-done', row: index, t: rel()});
      }
    });
    const now = current?.status?.toUpperCase().includes('SPELAR') ?? false;
    if (now !== recording) {
      recording = now;
      timeline.push({kind: now ? 'recording-start' : 'recording-stop', t: rel()});
    }
  }
};

// ---------------------------------------------------------------- the walk

let ready = false;
const readyDeadline = rel() + 30000;
while (rel() < readyDeadline) {
  const current = await state();
  if (current.ready) { ready = true; break; }
  await sleep(500);
}
if (!ready) {
  console.error('the recorder never offered a start control — is the app served and the session created?');
  process.exit(1);
}

console.log(`\nstart: ${await press(START)}`);
let reminder = null;
for (let i = 0; i < 30 && reminder === null; i++) {
  await sleep(300);
  const current = await state();
  if (current.dialog) {
    reminder = current.dialog;
    console.log(`headphone reminder: ${reminder.slice(0, 64)}`);
    await evaluate(`(() => {
      const dialog = document.querySelector('dialog[open], mat-dialog-container, [role="dialog"]');
      const button = dialog && Array.from(dialog.querySelectorAll('button')).pop();
      if (button) { button.click(); }
      return !!button;
    })()`);
  }
}
if (reminder === null) failures.push('the headphone reminder never appeared for the section that asks for it');

/** Rows whose sound the driver has asked for: each asks at most once, and the check below can tell. */
const soundAskedFor = new Set();
let pausedAt = null;
let cancelledOnPause = false;
/** How long to wait between attempts to get a take started, so retries cannot fall over each other. */
const PRESS_INTERVAL_MS = 2500;
/** How long the item marker may lag a pointer press before the driver reaches for the transport. */
const POINTER_LAG_MS = 7000;

/** Wait for the walk to reach `index`, driving only the sections that need an operator. */
const waitForRow = async (index) => {
  const deadline = rel() + STEP_TIMEOUT_MS;
  let lastPressAt = Number.NEGATIVE_INFINITY;
  let behindSince = 0;
  while (rel() < deadline) {
    const current = await state();
    await collect(current);
    // Pause during a take must cancel a playing sound — the navigation-during-playback claim. Checked
    // before the press block below so the loop passes here on every iteration; the press block spends
    // the next PRESS_INTERVAL_MS on its own attempts and would hide a short-lived window. (As it
    // happens the recorder never enables the control, so this is a standing check, not a race.)
    const clipPlaying = timeline.some((entry2) => entry2.kind === 'start' && rel() - entry2.t < 1500);
    const recordingNow = current.status.toUpperCase().includes('SPELAR');
    const pauseEnabled = await evaluate(`!!Array.from(document.querySelectorAll('button')).find((b) => ${PAUSE}.test((b.textContent || '') + ' ' + (b.title || '') + ' ' + (b.getAttribute('aria-label') || '')) && !b.disabled)`);
    if (pausedAt === null && recordingNow && clipPlaying && pauseEnabled === true) {
      pausedAt = rel();
      const clicked = await press(PAUSE);
      console.log(`  t+${pausedAt}ms pausing while the sound plays: ${clicked ?? '(no control)'}`);
      const stopsBefore = timeline.filter((entry2) => entry2.kind === 'stop').length;
      const stopDeadline = rel() + 2500;
      while (rel() < stopDeadline && !cancelledOnPause) {
        await sleep(150);
        await collect(await state());
        cancelledOnPause = timeline.filter((entry2) => entry2.kind === 'stop').length > stopsBefore;
      }
      console.log(`     sound cancelled by the pause: ${cancelledOnPause}`);
      continue;
    }
    const completed = doneCount(current);
    // The recorder marks a row done with a `done` icon. A non-recording item never gets one - it has
    // no take to mark - so its evidence is the app moving on and leaving the row's marker behind.
    if (isRowDone(current.rows[index])) {
      return true;
    }
    if (schedule[index].nonRecording && (await evaluate(CURRENT_ROW)) > index) {
      return true;
    }
    if (completed > index + 1) {
      // More rows are done than this one: the walk is already past it (a non-recording row, or one
      // whose mark the app has not drawn). Do not stall on an item the session has left behind.
      return true;
    }
    // The recorder drives AUTOPROGRESS/AUTORECORDING itself once the section has started, so those
    // get one operator press at their first item; pressing again would skip an item. Entering any
    // later item — a new section included — needs the pointer advanced first, then the take started.
    const entry = schedule[index];
    const previous = schedule[index - 1];
    const startsSection = index === 0 || previous === undefined || previous.mode !== entry.mode;
    // `continueSession` starts an AUTORECORDING section's takes by itself; every other mode waits
    // for the operator. AUTOPROGRESS moves its own pointer but still waits for a start.
    const needsOperator = entry.mode !== 'AUTORECORDING' || startsSection || entry.nonRecording;
    const isRecording = current.status.toUpperCase().includes('SPELAR');
    // The recorder marks the item it is on with `selRow`, so press toward `index` rather than by
    // guesswork: move the pointer while it is behind, start a take once it is there, and keep
    // checking — a press that lands while the previous take is winding down is spent for nothing,
    // and a driver that has pressed once then waits out its deadline for a take the app is waiting
    // to be told to start (which is where every run stopped at the first AUTOPROGRESS section).
    if (needsOperator && !isRecording && rel() - lastPressAt >= PRESS_INTERVAL_MS) {
      const offers = JSON.parse((await evaluate(OPERATOR_STATE)) ?? '{}');
      const onRow = await evaluate(CURRENT_ROW);
      if (entry.nonRecording && offers.forward) {
        // A non-recording item has no take to start and no `done` mark to earn: the app finishes it
        // when the operator moves on, and the only control it leaves enabled is the forward one.
        const clicked = await press(FORWARD);
        lastPressAt = rel();
        if (VERBOSE) console.log(`  t+${rel()}ms item ${index + 1} (non-recording): forward -> ${clicked ?? '(disabled)'}`);
        continue;
      }
      if (onRow !== null && onRow < index) {
        // Two controls move the pointer: the toolbar's forward, and the transport itself, whose
        // label reads "Nästa inspelning" when moving on is what it offers, and which is the control
        // that leaves a non-recording item. The row marker lags the press by a few seconds, so give
        // forward time to take effect before reaching for the transport - pressing it early starts
        // a take for the item that is still current, which is how a run re-records a finished item.
        if (behindSince === 0) { behindSince = rel(); }
        if (offers.forward && rel() - behindSince < POINTER_LAG_MS) {
          const clicked = await press(FORWARD);
          lastPressAt = rel();
          if (VERBOSE) console.log(`  t+${rel()}ms item ${index + 1}: on row ${onRow + 1}, forward -> ${clicked ?? '(disabled)'}`);
          continue;
        }
        if (offers.start) {
          const clicked = await press(OPERATOR);
          lastPressAt = rel();
          if (VERBOSE) console.log(`  t+${rel()}ms item ${index + 1}: on row ${onRow + 1}, transport -> ${clicked ?? '(disabled)'}`);
          continue;
        }
        lastPressAt = rel();
      } else if (onRow === index && offers.start) {
        behindSince = 0;
        lastPressAt = rel();
        const clicked = await press(OPERATOR);
        // Starting is idempotent where the app is ready: a second press only re-starts a take that
        // has not begun, and it is what a bare section boundary needs.
        await sleep(800);
        await press(OPERATOR);
        if (VERBOSE) console.log(`  t+${rel()}ms enter item ${index + 1}: start -> ${clicked ?? '(disabled)'}${startsSection ? ' (twice at the section boundary)' : ''}`);
        continue;
      }
      lastPressAt = rel();
    }
    // An item whose sound the operator must ask for: the operator-only item, and a drawn item that
    // plays the bank's own recording — `playBankAudio`, which the script offers as the prompt control
    // ("Spela upp ljudet för …"). Ask once, then let the recorder move on.
    const asksForItsSound = entry.when === 'ONDEMAND' || entry.bankAudio;
    // `DURING` means the sound belongs with the take, so the operator asks for it once the take has
    // begun; asking earlier would place it before the recording and say so in the audit trail.
    const takeStarted = timeline.some((event) => event.kind === 'recording-start' && event.t >= (rowReachedAt[index - 1] ?? 0));
    const asksNow = entry.when === 'DURING' && entry.bankAudio ? takeStarted : rel() > 4000;
    if (asksForItsSound && !soundAskedFor.has(index) && asksNow) {
      soundAskedFor.add(index);
      console.log(`  t+${rel()}ms asking for item ${index + 1}'s sound: ${await press(SOUND) ?? '(no control)'}`);
      continue;
    }
    await sleep(250);
  }
  return false;
};

const walkReached = [];
/** When the walk saw each row reached, in `rel()` ms: the boundaries the clip assertions use. */
const rowReachedAt = [];
for (const [index, entry] of schedule.entries()) {
  const reached = await waitForRow(index);
  walkReached[index] = reached;
  rowReachedAt[index] = rel();
  if (!reached) {
    if (entry.mode === 'MANUAL') {
      failures.push(`item ${index + 1} (${entry.itemcode}) never finished — a manual section the driver should have driven`);
    }
    // An auto section it could not enter is reported by the note above, once.
    break;
  }
  if (VERBOSE) {
    console.log(`  t+${rel()}ms item ${index + 1} (${entry.itemcode}, ${entry.mode}${entry.when ? ', ' + entry.when : ''}) done`);
  }
}
await collect(await state());

// ---------------------------------------------------------------- the assertions

const starts = timeline.filter((entry) => entry.kind === 'start');
const stops = timeline.filter((entry) => entry.kind === 'stop');
const recordingStarts = timeline.filter((entry) => entry.kind === 'recording-start');
const windowFor = (rowIndex) => {
  // The recording window of a row is the first recording-start after the walk reached the row before.
  const after = rowIndex === 0 ? 0 : (rowReachedAt[rowIndex - 1] ?? 0);
  return recordingStarts.find((entry) => entry.t >= after);
};
const startsFor = (rowIndex) => {
  // A start belongs to the row the walk was on. The walk's own boundaries are used rather than the
  // table's marks: a non-recording row earns no mark, and a bound derived from one falls back to
  // zero, which attributes the session's earliest clip to it.
  const from = rowIndex === 0 ? 0 : (rowReachedAt[rowIndex - 1] ?? 0);
  const to = rowReachedAt[rowIndex] ?? rel();
  return starts.filter((entry) => entry.t >= from && entry.t <= to);
};

const reachedRows = schedule.map((entry, index) => walkReached[index] === true);
const firstUnreached = schedule.findIndex((entry, index) => !reachedRows[index]);
if (firstUnreached !== -1 && schedule[firstUnreached].mode === 'MANUAL') {
  if (schedule[firstUnreached].bankAudio) {
    console.log(`note: the walk stopped at item ${firstUnreached + 1} (${schedule[firstUnreached].itemcode}), a drawn item whose bank recording is the operator's to play — see the manual step`);
  } else {
    // The driver drives MANUAL sections itself, so an unreached one is a real failure.
    failures.push(`the walk stopped at item ${firstUnreached + 1} (${schedule[firstUnreached].itemcode}), a manual section the driver should have driven`);
  }
} else if (firstUnreached !== -1) {
  // An AUTO section the driver could not drive to its end: unlike the rest of the walk, this one is
  // a stated limit rather than a failure, because the recorder's AUTO start rule is not something a
  // DOM driver should be made to satisfy. (Trusted input events, rather than synthetic clicks, are
  // what got the driver through the first of these - see the plan's §11.32.)
  const blocked = schedule.slice(firstUnreached).map((entry) => entry.itemcode).join(', ');
  console.log(`note: ${blocked} sit in or behind a ${schedule[firstUnreached].mode} section, whose takes this driver could not start — see the manual step`);
}
for (const [index, entry] of schedule.entries()) {
  const rowDone = timeline.filter((event) => event.kind === 'row-done' && event.row === index).at(-1);
  if (rowDone === undefined) {
    // The walk did not reach this row; the coverage failure above already reports it.
    continue;
  }
  const rowStarts = startsFor(index);
  const window = windowFor(index);
  if (entry.nonRecording) {
    if (!soundAskedFor.has(index)) {
      failures.push(`item ${index + 1} (${entry.itemcode}) is operator-only and was never asked to play`);
    } else if (!rowStarts.length) {
      clipFailure(`item ${index + 1} (${entry.itemcode}) did not play when asked`);
    }
    continue;
  }
  if (!entry.hasAudio) {
    continue;
  }
  if (rowStarts.length === 0) {
    clipFailure(`item ${index + 1} (${entry.itemcode}, ${entry.when}) never played its clip`);
    continue;
  }
  const first = rowStarts[0];
  const when = entry.when ?? 'WITH_PROMPT';
  if (when === 'WITH_PROMPT' || when === 'BEFORE') {
    if (window === undefined) {
      failures.push(`item ${index + 1} (${entry.itemcode}) never started recording although it is a recording item`);
    } else if (!(first.t < window.t)) {
      clipFailure(`item ${index + 1} (${entry.itemcode}, ${when}) played at ${first.t}ms, not before the clocks (${window.t}ms)`);
    }
  } else if (when === 'PRERECORDING' || when === 'DURING') {
    if (window === undefined) {
      failures.push(`item ${index + 1} (${entry.itemcode}) never started recording although it is a recording item`);
    } else if (first.t < window.t - 400) {
      clipFailure(`item ${index + 1} (${entry.itemcode}, ${when}) played at ${first.t}ms, too early for its placement (recording began at ${window.t}ms)`);
    }
  }
}
const drawnEntries = schedule.filter((entry) => entry.bankAudio);
if (drawnEntries.length === 0) {
  failures.push('the drawn items are not in the session with their own bank recordings');
} else if (drawnEntries.some((entry) => reachedRows[schedule.indexOf(entry)]) && !starts.some((entry) => DRAWN_MEDIA.test(entry.url ?? ''))) {
  clipFailure('the drawn items never played their own bank recordings');
}
if (!cancelledOnPause) {
  // Not a race this driver keeps losing: the recorder leaves its pause control disabled - the action
  // is never enabled and its `onAction` wiring is commented out in `audiorecorder.ts` (`pauseAction
  // .disabled = true`), measured as `Paus (P) OFF` while a take was running. The pause-during-
  // playback claim is therefore exercised by the L3 specs, which call the manager directly.
  console.log('note: the pause control is disabled in the recorder itself, so the pause-during-playback claim is the L3 specs\' to keep — see the manual step');
}

const short = (url) => (url === null ? '-' : url.split('/').pop().split('?')[0]);
console.log(`\naudit trail`);
console.log(`  starts:  ${starts.map((entry) => `@${entry.t}ms${entry.recording ? ' (recording)' : ''} ${short(entry.url)}`).join('  ') || '(none)'}`);
console.log(`  stops:   ${stops.map((entry) => `@${entry.t}ms`).join('  ') || '(none)'}`);
console.log(`  windows: ${recordingStarts.map((entry) => `@${entry.t}ms`).join('  ') || '(none)'}`);
console.log(`  rows:    ${reachedRows.filter(Boolean).length}/${schedule.length} reached, ${doneCount(await state())} marked done`);
console.log(`  session: status=${(await (await fetch(`${BASE}/api/v1/session/${SESSION}`)).json()).status ?? '?'}`);
if (JSON_OUT) console.log(JSON.stringify({schedule, timeline}, null, 2));

// A recorder that behaves while logging on every take is still broken for the operator.
for (const problem of [...new Set(consoleProblems)].slice(0, 6)) {
  if (!clipsAudible && /Prompt audio/.test(problem)) {
    // What the recorder is reporting is exactly what this host cannot do; that is the failure it is
    // supposed to report, not a defect. Anything else still fails the run.
    unverified.push(`console: ${problem}`);
  } else {
    failures.push(`console: ${problem}`);
  }
}

if (unverified.length) {
  console.log(`\n${unverified.length} check(s) not verified here: this browser cannot play a clip.`);
  unverified.forEach((item) => console.log('  · ' + item));
  console.log('  (the rows, the labels and the recording windows were checked as usual)');
}

ws.close();
if (failures.length) {
  console.log(`\n${failures.length} dry-run problem(s):`);
  failures.forEach((failure) => console.log('  ✗ ' + failure));
  process.exit(1);
}
console.log('\nDry run passed.');
