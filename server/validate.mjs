/**
 * The server side of the check catalogue (doc/script-editor/validation.md).
 *
 * Publishing is gated here because the editor is not the only writer; the findings reuse the
 * catalogue's `id` and `path` strings, so a server rejection deep-links in the editor's panel
 * unchanged. Only the **error** severity blocks a publish.
 *
 * The bank-dependent checks (E03, E04, E05) need the bank module and the bank-source schema frozen
 * in M0 (D-W); they run when the caller passes a `lookupBank`. E08 is retired by D-W: a group can no
 * longer hold both a rule and a fixed list. W-checks stay client-side by design.
 */
import {matchesFilter, queryBank} from './bank.mjs';
const TIMING_FIELDS = ['prerecdelay', 'prerecording', 'recduration', 'duration', 'postrecording', 'postrecdelay'];
const NON_NEGATIVE_PLAYBACK_FIELDS = ['gap', 'maxReplays'];

/** @returns {Array<{id: string, path: string, severity: 'error', message: string}>} */
export function validateScript(script, {lookupBank = null} = {}) {
  const findings = [];
  const add = (id, path, message) => findings.push({id, path, severity: 'error', message});
  const sections = Array.isArray(script?.sections) ? script.sections : [];

  // E10 — a script needs at least one section, and a section at least one group.
  if (sections.length === 0) {
    add('E10', 'sections', 'A script needs at least one section with one group.');
  }
  const seenCodes = new Map();
  const reservedRanges = [];

  sections.forEach((section, sectionIdx) => {
    const groups = Array.isArray(section?.groups) ? section.groups : [];
    if (groups.length === 0) {
      add('E10', `sections[${sectionIdx}].groups`, 'A script needs at least one section with one group.');
    }
    groups.forEach((group, groupIdx) => {
      const items = Array.isArray(group?.promptItems) ? group.promptItems : [];
      items.forEach((item, itemIdx) => {
        const path = `sections[${sectionIdx}].groups[${groupIdx}].promptItems[${itemIdx}]`;

        // E01/E02 — itemcode present and unique across the whole script.
        const itemcode = typeof item?.itemcode === 'string' ? item.itemcode.trim() : '';
        if (itemcode === '') {
          add('E01', `${path}.itemcode`, 'Itemcode is required.');
        } else if (seenCodes.has(itemcode)) {
          add('E02', `${path}.itemcode`, `Another item (${seenCodes.get(itemcode)}) already uses this itemcode.`);
        } else {
          seenCodes.set(itemcode, path);
        }

        // E03/E04/E05 — a bank source must name a bank, a viable count and a free prefix (D-W).
        const bankSource = item?.prefill?.bank;
        if (bankSource !== undefined && bankSource !== null) {
          const bankPath = `${path}.prefill.bank`;
          const bankId = bankSource.bank;
          const count = Number(bankSource.count);
          const prefix = bankSource.itemcodePrefix === undefined || bankSource.itemcodePrefix === null
            ? ''
            : String(bankSource.itemcodePrefix);
          if (bankId === undefined || bankId === null || String(bankId).trim() === '') {
            add('E03', `${bankPath}.bank`, 'The item draws from a bank but no bank is chosen.');
          } else if (typeof lookupBank === 'function' && lookupBank(String(bankId)) === null) {
            add('E03', `${bankPath}.bank`, `Bank ${bankId} does not exist.`);
          } else if (typeof lookupBank === 'function') {
            const matchCount = queryBank(lookupBank(String(bankId)), bankSource.filter ?? {}).matchCount;
            if (Number.isInteger(count) && count > matchCount) {
              add('E04', `${bankPath}.count`, `The filter matches only ${matchCount} items; draw fewer or widen the filter.`);
            }
          }
          if (count < 1 || !Number.isInteger(count)) {
            add('E09', `${bankPath}.count`, 'count must be a positive whole number.');
          }
          if (count > 999) {
            add('E11', `${bankPath}.count`, 'A drawn itemcode range holds at most 999 items.');
          }
          if (prefix === '') {
            add('E05', `${bankPath}.itemcodePrefix`, 'A drawn itemcode prefix is required.');
          } else if (Number.isInteger(count) && count >= 1) {
            reservedRanges.push({prefix, count, path: bankPath, placeholder: itemcode});
          }
        }

        // E06/E07 — what the item shows and what it plays (D-V = C: the sound is an audio mediaitem).
        const mediaitems = Array.isArray(item?.mediaitems) ? item.mediaitems : [];
        const hasAudio = mediaitems.some((mediaitem) => String(mediaitem?.mimetype ?? '').startsWith('audio'));
        const hasDisplay = mediaitems.some((mediaitem) => mediaitem?.text != null
          || mediaitem?.promptDoc != null
          || mediaitem?.src != null);
        if (item?.playback !== undefined && !hasAudio) {
          add('E06', `${path}.playback`, 'The item declares playback but has no audio mediaitem.');
        }
        if (!hasDisplay && !hasAudio) {
          add('E07', `${path}.mediaitems`, 'The item shows nothing and plays nothing.');
        }

        // E09 — timing fields are non-negative numbers.
        for (const field of TIMING_FIELDS) {
          const value = item?.[field];
          if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
            add('E09', `${path}.${field}`, `${field} must be a positive number of milliseconds.`);
          }
        }

        // E11 — playback numbers and virtual view boxes stay in range.
        if (item?.playback !== undefined) {
          const repeats = item.playback?.repeats;
          if (repeats !== undefined && (!Number.isInteger(repeats) || repeats < 1)) {
            add('E11', `${path}.playback.repeats`, 'repeats must be at least 1.');
          }
          for (const field of NON_NEGATIVE_PLAYBACK_FIELDS) {
            const value = item.playback?.[field];
            if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
              add('E11', `${path}.playback.${field}`, `${field} must not be negative.`);
            }
          }
        }
        mediaitems.forEach((mediaitem, mediaIdx) => {
          const height = mediaitem?.defaultVirtualViewBox?.height;
          if (height !== undefined && !(typeof height === 'number' && height > 0)) {
            add('E11', `${path}.mediaitems[${mediaIdx}].defaultVirtualViewBox.height`, 'The virtual view box height must be greater than zero.');
          }
        });
      });
    });
  });

  const scriptHeight = script?.virtualViewBox?.height;
  if (scriptHeight !== undefined && !(typeof scriptHeight === 'number' && scriptHeight > 0)) {
    add('E11', 'virtualViewBox.height', 'The virtual view box height must be greater than zero.');
  }

  // E05 — the reserved ranges must not collide with fixed codes or with each other.
  const byPrefix = new Map();
  for (const range of reservedRanges) {
    const previous = byPrefix.get(range.prefix);
    if (previous !== undefined) {
      add('E05', `${range.path}.itemcodePrefix`, `Prefix ${range.prefix} is already reserved at ${previous.path}.`);
    } else {
      byPrefix.set(range.prefix, range);
    }
    for (const [code, codePath] of seenCodes) {
      if (code === range.placeholder) {
        continue;
      }
      const match = new RegExp(`^${range.prefix.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(\\d{3,})$`).exec(code);
      if (match !== null && Number(match[1]) <= range.count) {
        add('E05', `${codePath}.itemcode`, `Itemcodes ${range.prefix}001–${range.prefix}${String(range.count).padStart(3, '0')} are reserved by the bank source at ${range.path}.`);
      }
    }
  }
  return findings;
}
