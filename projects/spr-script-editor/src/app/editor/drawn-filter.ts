/**
 * The stored draw filter in words (ui-spec §3.2/§3.3: "the filter in words"). One implementation
 * so the centre's card and the inspector's summary cannot describe the same rule differently.
 */
import type {PrefillBankSource} from 'speechrecorderng';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {fillTemplate} from '../core/validation/interpolate';

const WORDS = EDITOR_STRINGS.centre.filterWords;

export function drawnFilterWords(source: PrefillBankSource | null): string {
  const filter = source?.filter ?? {};
  const parts: string[] = [];
  if (filter.category !== undefined) {
    parts.push(fillTemplate(WORDS.category, {value: filter.category}));
  }
  if (Array.isArray(filter.words)) {
    const [min, max] = filter.words;
    if (min !== undefined && max !== undefined) {
      parts.push(fillTemplate(WORDS.words, {min, max}));
    } else if (min !== undefined) {
      parts.push(fillTemplate(WORDS.minWords, {min}));
    } else if (max !== undefined) {
      parts.push(fillTemplate(WORDS.maxWords, {max}));
    }
  }
  if (filter.hasAudio === true) {
    parts.push(WORDS.hasAudio);
  } else if (filter.hasAudio === false) {
    parts.push(WORDS.hasNoAudio);
  }
  if (Array.isArray(filter.tags) && filter.tags.length > 0) {
    parts.push(fillTemplate(WORDS.tags, {value: filter.tags.join(', ')}));
  }
  if (filter.q !== undefined && String(filter.q).trim() !== '') {
    parts.push(fillTemplate(WORDS.q, {value: String(filter.q)}));
  }
  return parts.length === 0 ? WORDS.none : parts.join(', ');
}
