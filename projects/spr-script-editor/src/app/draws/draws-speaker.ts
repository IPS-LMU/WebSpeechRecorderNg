/**
 * Speaker identifiers on the resolved-draws screen (ui-spec §7: "Speaker identifiers may need to be
 * pseudonyms here", README §8.4).
 *
 * Every place this slice renders a speaker goes through `speakerLabel`, so turning the screen into
 * a pseudonymous one is a change to this file alone: fill `SPEAKER_PSEUDONYMS` from the
 * deployment's mapping (or replace `speakerLabel` with a lookup against a project endpoint) and no
 * component or spec elsewhere has to move. When a speaker is absent — which the receiver allows,
 * `speaker: null` — the caller decides what to show; an empty string keeps the label slot blank.
 */
const SPEAKER_PSEUDONYMS: Readonly<Record<string, string>> = {
  // 'sp-13': 'P-0042',
};

export function speakerLabel(speaker: string | null | undefined): string {
  if (speaker === null || speaker === undefined || speaker === '') {
    return '';
  }
  return SPEAKER_PSEUDONYMS[speaker] ?? speaker;
}
