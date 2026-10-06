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
const CLICK = (pattern) => `(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const hit = buttons.find((b) => ${pattern}.test((b.textContent || '') + ' ' + (b.title || '') + ' ' + (b.getAttribute('aria-label') || '')) && !b.disabled);
  if (!hit) { return null; }
  hit.click();
  return ((hit.textContent || '') + ' ' + (hit.title || '') + ' ' + (hit.getAttribute('aria-label') || '')).replace(/\\s+/g, ' ').trim().slice(0, 40);
})()`;
const START = '/Starta|Start \\//i';
/** The operator's own control: start, stop, or move on — its label says all three. */
const OPERATOR = '/Start \\/ Stopp|Nästa inspelning/i';
/** Moving the item pointer; disabled while a take is running. */
const FORWARD = '/Framåt|Next item/i';
/** Pause, which stops a recording and must also stop a playing sound. */
const PAUSE = '/Paus|Pause/i';
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
  console.log(`::warning title=Dry run skipped::this browser has no audio output (clock ${audioClock}), so no prompt clip can finish playing and no take can start`);
  console.log(`\ndry run SKIPPED, not failed: the browser's audio clock is ${audioClock}.`);
  console.log('Every take waits for a prompt clip to finish, so nothing can start without an audio');
  console.log('output device. Give the browser one (a null sink is enough: on Linux, pulseaudio with');
  console.log('module-null-sink) and re-run; the row, label and window checks stay unverified until then.');
  ws.close();
  process.exit(0);
}

const t0 = Date.now();
const rel = () => Math.round(Date.now() - t0);
const failures = [];
const timeline = [];
const doneIn = (current) => current.rows.filter((row) => /done|klar|complete/i.test(row[2] ?? '')).length;

/** Pull the page's audio events, the global recording state and the finished rows into one timeline. */
let recording = false;
let doneRows = 0;
const collect = async (current) => {
  for (const event of await pageEvents()) {
    if (timeline.some((entry) => entry.kind === event.kind && entry.tPage === event.t)) {
      continue;
    }
    timeline.push({kind: event.kind, tPage: event.t, t: rel(), url: event.url ?? null, recording});
  }
  if (current !== undefined) {
    const completed = doneIn(current);
    while (doneRows < completed) {
      timeline.push({kind: 'row-done', row: doneRows, t: rel()});
      doneRows += 1;
    }
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

console.log(`\nstart: ${await evaluate(CLICK(START))}`);
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

let soundPressedAt = null;
let pausedAt = null;
let cancelledOnPause = false;
/** Wait for the walk to reach `index`, driving only the sections that need an operator. */
const waitForRow = async (index) => {
  const deadline = rel() + STEP_TIMEOUT_MS;
  let pressedForwardFor = null;
  let startedTakeFor = null;
  while (rel() < deadline) {
    const current = await state();
    await collect(current);
    const completed = doneIn(current);
    if (completed > index) {
      return true;
    }
    // The recorder drives AUTOPROGRESS/AUTORECORDING itself once the section has started, so those
    // get one operator press at their first item; pressing again would skip an item. Entering any
    // later item — a new section included — needs the pointer advanced first, then the take started.
    const entry = schedule[index];
    const previous = schedule[index - 1];
    const startsSection = index === 0 || previous === undefined || previous.mode !== entry.mode;
    const needsOperator = entry.mode === 'MANUAL' || startsSection;
    const isRecording = current.status.toUpperCase().includes('SPELAR');
    if (needsOperator && !isRecording && index > 0) {
      if (pressedForwardFor !== index) {
        const clicked = await evaluate(CLICK(FORWARD));
        pressedForwardFor = index;
        if (VERBOSE) console.log(`  t+${rel()}ms enter item ${index + 1}: forward -> ${clicked ?? '(disabled)'}`);
        continue;
      }
      if (startedTakeFor !== index) {
        const clicked = await evaluate(CLICK(OPERATOR));
        startedTakeFor = index;
        // A section boundary consumes one press as "leave the finished section"; a second press is
        // what starts the new section's first take. Harmless in a manual section, where the extra
        // press only re-starts a take that has not begun.
        if (startsSection) {
          await sleep(800);
          await evaluate(CLICK(OPERATOR));
        }
        if (VERBOSE) console.log(`  t+${rel()}ms enter item ${index + 1}: start -> ${clicked ?? '(disabled)'}${startsSection ? ' (twice at the section boundary)' : ''}`);
        continue;
      }
    }
    // The operator-only item never records: ask for its sound once, then let the recorder move on.
    if (entry.when === 'ONDEMAND' && soundPressedAt === null && rel() > 4000) {
      soundPressedAt = rel();
      console.log(`  t+${soundPressedAt}ms asking for the operator-only item's sound: ${await evaluate(CLICK(SOUND)) ?? '(no control)'}`);
      continue;
    }
    // Pause during a take must cancel a playing sound — the navigation-during-playback claim. Only
    // attempt it while a clip is actually playing and the pause control is enabled; otherwise wait
    // for a better moment rather than burning the one attempt.
    const clipPlaying = timeline.some((entry2) => entry2.kind === 'start' && rel() - entry2.t < 1500);
    const pauseEnabled = await evaluate(`!!Array.from(document.querySelectorAll('button')).find((b) => ${PAUSE}.test((b.textContent || '') + ' ' + (b.title || '') + ' ' + (b.getAttribute('aria-label') || '')) && !b.disabled)`);
    if (pausedAt === null && isRecording && clipPlaying && pauseEnabled === true) {
      pausedAt = rel();
      const clicked = await evaluate(CLICK(PAUSE));
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
    await sleep(250);
  }
  return false;
};

for (const [index, entry] of schedule.entries()) {
  const reached = await waitForRow(index);
  const completed = doneIn(await state());
  if (!reached && !(entry.nonRecording && completed >= index)) {
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
  // The recording window of a row is the first recording-start after the previous row finished.
  const previousDone = timeline.filter((entry) => entry.kind === 'row-done' && entry.row === rowIndex - 1).at(-1);
  const after = previousDone === undefined ? 0 : previousDone.t;
  return recordingStarts.find((entry) => entry.t >= after);
};
const startsFor = (rowIndex) => {
  // A start belongs to the row that was current when it happened: rows complete in order, and the
  // counts in the table are the recorder's own.
  const bounds = [];
  for (let row = 0; row < schedule.length; row++) {
    const rowDone = timeline.filter((entry) => entry.kind === 'row-done' && entry.row === row).at(-1);
    bounds.push(rowDone === undefined ? null : rowDone.t);
  }
  const from = rowIndex === 0 ? 0 : (bounds[rowIndex - 1] ?? 0);
  const to = bounds[rowIndex] ?? rel();
  return starts.filter((entry) => entry.t >= from && entry.t <= to);
};

const reachedRows = schedule.map((entry, index) => timeline.some((event) => event.kind === 'row-done' && event.row === index));
const firstUnreached = schedule.findIndex((entry, index) => !reachedRows[index]);
if (firstUnreached !== -1 && schedule[firstUnreached].mode === 'MANUAL') {
  // The driver drives MANUAL sections itself, so an unreached one is a real failure.
  failures.push(`the walk stopped at item ${firstUnreached + 1} (${schedule[firstUnreached].itemcode}), a manual section the driver should have driven`);
} else if (firstUnreached !== -1) {
  // Everything from here on sits behind an AUTOPROGRESS/AUTORECORDING section, whose boundary needs
  // the operator's own timing that these DOM controls do not reproduce (a stated limit in the plan).
  // The placement of all five `when` values is pinned by the unit-tested table in phases.spec.ts.
  const blocked = schedule.slice(firstUnreached).map((entry) => entry.itemcode).join(', ');
  console.log(`note: ${blocked} sit behind a ${schedule[firstUnreached].mode} section this driver cannot enter unattended — see the manual step`);
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
    if (soundPressedAt === null) {
      failures.push(`item ${index + 1} (${entry.itemcode}) is operator-only and was never asked to play`);
    } else if (!rowStarts.length) {
      failures.push(`item ${index + 1} (${entry.itemcode}) did not play when asked`);
    }
    continue;
  }
  if (!entry.hasAudio) {
    continue;
  }
  if (rowStarts.length === 0) {
    failures.push(`item ${index + 1} (${entry.itemcode}, ${entry.when}) never played its clip`);
    continue;
  }
  const first = rowStarts[0];
  const when = entry.when ?? 'WITH_PROMPT';
  if (when === 'WITH_PROMPT' || when === 'BEFORE') {
    if (window === undefined) {
      failures.push(`item ${index + 1} (${entry.itemcode}) never started recording although it is a recording item`);
    } else if (!(first.t < window.t)) {
      failures.push(`item ${index + 1} (${entry.itemcode}, ${when}) played at ${first.t}ms, not before the clocks (${window.t}ms)`);
    }
  } else if (when === 'PRERECORDING' || when === 'DURING') {
    if (window === undefined) {
      failures.push(`item ${index + 1} (${entry.itemcode}) never started recording although it is a recording item`);
    } else if (first.t < window.t - 400) {
      failures.push(`item ${index + 1} (${entry.itemcode}, ${when}) played at ${first.t}ms, too early for its placement (recording began at ${window.t}ms)`);
    }
  }
}
const drawnEntries = schedule.filter((entry) => entry.bankAudio);
if (drawnEntries.length === 0) {
  failures.push('the drawn items are not in the session with their own bank recordings');
} else if (drawnEntries.some((entry) => reachedRows[schedule.indexOf(entry)]) && !starts.some((entry) => DRAWN_MEDIA.test(entry.url ?? ''))) {
  failures.push('the drawn items never played their own bank recordings');
}
if (!cancelledOnPause) {
  // The clip is about a second long and the controls are phase-dependent, so a race here is a
  // limitation of the driver: report it and leave the claim to the manual pass (the plan's M1 gate
  // lists navigation-during-playback as manual).
  console.log('note: the pause did not land inside a playing clip this run — see the manual step');
}

const short = (url) => (url === null ? '-' : url.split('/').pop().split('?')[0]);
console.log(`\naudit trail`);
console.log(`  starts:  ${starts.map((entry) => `@${entry.t}ms${entry.recording ? ' (recording)' : ''} ${short(entry.url)}`).join('  ') || '(none)'}`);
console.log(`  stops:   ${stops.map((entry) => `@${entry.t}ms`).join('  ') || '(none)'}`);
console.log(`  windows: ${recordingStarts.map((entry) => `@${entry.t}ms`).join('  ') || '(none)'}`);
console.log(`  rows:    ${doneIn(await state())}/${schedule.length} finished`);
console.log(`  session: status=${(await (await fetch(`${BASE}/api/v1/session/${SESSION}`)).json()).status ?? '?'}`);
if (JSON_OUT) console.log(JSON.stringify({schedule, timeline}, null, 2));

// A recorder that behaves while logging on every take is still broken for the operator.
for (const problem of [...new Set(consoleProblems)].slice(0, 6)) {
  failures.push(`console: ${problem}`);
}

ws.close();
if (failures.length) {
  console.log(`\n${failures.length} dry-run problem(s):`);
  failures.forEach((failure) => console.log('  ✗ ' + failure));
  process.exit(1);
}
console.log('\nDry run passed.');
