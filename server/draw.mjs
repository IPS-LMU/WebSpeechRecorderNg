/**
 * Bank-source resolution (decision D-W = A in the plan).
 *
 * A placeholder prompt item may carry `prefill.bank` — the bank source type of the randomised-items
 * mechanism. It is resolved **server-side at session creation**, because a draw needs project state
 * (`skipRecordedBySpeaker` looks at the speaker's earlier recordings) and must be reproducible:
 * the chosen items are written into the session's materialised script and recorded on the session
 * (`Session.bankDraws`), so a reload shows the same items and matches the files already recorded.
 *
 * The PRNG is documented and tiny (FNV-1a key → mulberry32), so the same key yields the same items
 * on every runtime. Nothing here touches the browser.
 */
import {matchesFilter} from './bank.mjs';

const POSITION_WIDTH = 3;

/** The bank-source declarations of a script, with the position of the placeholder item. */
export function bankSourcesOf(script) {
  const found = [];
  for (const [sectionIdx, section] of (script?.sections ?? []).entries()) {
    for (const [groupIdx, group] of (section?.groups ?? []).entries()) {
      for (const [itemIdx, item] of (group?.promptItems ?? []).entries()) {
        if (item?.prefill?.bank !== undefined && item?.prefill?.bank !== null) {
          found.push({sectionIdx, groupIdx, itemIdx, itemcode: item?.itemcode ?? null, source: item.prefill.bank});
        }
      }
    }
  }
  return found;
}

/** A stable 32-bit seed from any number of strings (FNV-1a). */
export function seedFrom(...parts) {
  let hash = 2166136261;
  for (const part of parts) {
    for (const char of String(part ?? '')) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 31;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: small, deterministic, identical everywhere. */
export function randomFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The key a draw is stable for. `fixedBy: SPEAKER` falls back to the session when the session
 * carries no speaker; that fallback is recorded in the trace rather than silently assumed.
 */
export function drawKey(fixedBy, {sessionId, speaker = null, scriptId = null, scriptVersion = null}) {
  switch (fixedBy === undefined || fixedBy === null ? 'SESSION' : fixedBy) {
    case 'SPEAKER':
      return `speaker:${speaker ?? sessionId}`;
    case 'SCRIPT':
      return `script:${scriptId}@${scriptVersion ?? ''}`;
    default:
      return `session:${sessionId}`;
  }
}

/** Fisher–Yates over a copy, driven by the given generator. */
export function shuffle(items, random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** `{prefix}001`, zero-padded to three digits. */
export function itemcodeForPrefix(prefix, position) {
  return `${prefix ?? ''}${String(position).padStart(POSITION_WIDTH, '0')}`;
}

/**
 * Chooses the items of one bank source: filter, drop what the speaker already recorded, order,
 * take `count`, then refill from the skipped items (recording that it did).
 */
export function chooseItems({bank, source, excluded = new Set(), random}) {
  const matching = (bank?.items ?? []).filter((item) => matchesFilter(item, source.filter ?? {}));
  const available = matching.filter((item) => !excluded.has(String(item.bankItemId)));
  const count = Number(source.count ?? 1);
  const ordered = source.order === 'SEQUENTIAL' ? available : shuffle(available, random);
  const chosen = ordered.slice(0, count);
  let refilled = false;
  if (chosen.length < count) {
    const skipped = matching.filter((item) => excluded.has(String(item.bankItemId)));
    const refill = source.order === 'SEQUENTIAL' ? skipped : shuffle(skipped, random);
    for (const item of refill) {
      if (chosen.length >= count) {
        break;
      }
      chosen.push(item);
      refilled = true;
    }
  }
  return {chosen, refilled};
}

/** The prompt items one bank source generates from its chosen bank items. */
export function generateItems({source, chosen}) {
  const defaults = source.itemDefaults ?? {};
  return chosen.map((bankItem, index) => {
    const shown = bankItem.promptDoc !== undefined
      ? {promptDoc: bankItem.promptDoc}
      : (bankItem.src !== undefined ? {src: bankItem.src} : {text: bankItem.text ?? ''});
    const first = {...shown};
    if (bankItem.mimetype !== undefined) {
      first.mimetype = bankItem.mimetype;
    } else if (shown.text !== undefined) {
      first.mimetype = 'text/plain';
    }
    if (bankItem.alt !== undefined) {
      first.alt = bankItem.alt;
    }
    const mediaitems = [first];
    if (source.playBankAudio === true && bankItem.audioSrc !== undefined) {
      mediaitems.push({
        mimetype: bankItem.audioMimetype ?? 'audio/wav',
        src: bankItem.audioSrc,
        ...(bankItem.alt === undefined ? {} : {alt: bankItem.alt}),
      });
    }
    const item = {
      itemcode: itemcodeForPrefix(source.itemcodePrefix, index + 1),
      mediaitems,
      bankItemId: bankItem.bankItemId,
    };
    for (const field of ['prerecdelay', 'recduration', 'postrecdelay', 'recinstructions']) {
      if (defaults[field] !== undefined) {
        item[field] = defaults[field];
      }
    }
    if (source.playBankAudio === true && source.playback !== undefined) {
      item.playback = {...source.playback};
    }
    return item;
  });
}

/**
 * Resolves every bank source of a script into concrete prompt items.
 *
 * @param script the published or draft document
 * @param context `{lookupBank, sessionId, speaker, scriptId, scriptVersion, recordedBankItemIds}`
 * @returns `{script, trace}` — a resolved copy and the session trace entries; `trace` is null when
 *   the script has no bank source.
 */
export function resolveBankSources(script, context) {
  const sources = bankSourcesOf(script);
  if (sources.length === 0) {
    return {script, trace: null};
  }
  const {
    lookupBank,
    sessionId,
    speaker = null,
    scriptId = null,
    scriptVersion = null,
    recordedBankItemIds = new Set(),
  } = context;
  const resolved = structuredClone(script);
  const trace = [];
  const byGroup = new Map();
  for (const entry of sources) {
    const bank = lookupBank(entry.source.bank);
    if (bank === null || bank === undefined) {
      throw new Error(`bank ${entry.source.bank} does not exist`);
    }
    const key = drawKey(entry.source.fixedBy, {sessionId, speaker, scriptId, scriptVersion});
    const random = randomFrom(seedFrom(key, entry.itemcode ?? '', entry.source.bank));
    const skip = entry.source.skipRecordedBySpeaker === true && speaker !== null && speaker !== undefined;
    const {chosen, refilled} = chooseItems({
      bank,
      source: entry.source,
      excluded: skip ? recordedBankItemIds : new Set(),
      random,
    });
    const generated = generateItems({source: entry.source, chosen});
    trace.push({
      kind: 'bank',
      placeholderItemcode: entry.itemcode,
      bank: entry.source.bank,
      bankSource: entry.source.bankSource ?? null,
      filter: entry.source.filter ?? {},
      count: Number(entry.source.count ?? 1),
      fixedBy: entry.source.fixedBy ?? 'SESSION',
      key,
      itemcodePrefix: entry.source.itemcodePrefix ?? '',
      items: generated.map((item) => ({itemcode: item.itemcode, bankItemId: item.bankItemId})),
      refilled,
      skippedRecorded: skip,
      speakerFallback: entry.source.fixedBy === 'SPEAKER' && (speaker === null || speaker === undefined),
      drawnForVersion: scriptVersion,
    });
    const groupKey = `${entry.sectionIdx}:${entry.groupIdx}`;
    const list = byGroup.get(groupKey) ?? [];
    list.push({itemIdx: entry.itemIdx, generated});
    byGroup.set(groupKey, list);
  }
  for (const [groupKey, replacements] of byGroup) {
    const [sectionIdx, groupIdx] = groupKey.split(':').map(Number);
    const items = resolved.sections[sectionIdx].groups[groupIdx].promptItems;
    for (const {itemIdx, generated} of [...replacements].sort((a, b) => b.itemIdx - a.itemIdx)) {
      items.splice(itemIdx, 1, ...generated);
    }
  }
  return {script: resolved, trace};
}
