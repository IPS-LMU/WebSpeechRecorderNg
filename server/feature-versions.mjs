/**
 * Version arithmetic and the feature→recorder-version table that `publish` stamps as
 * `minRecorderVersion`.
 *
 * The recorder refuses a script whose floor is above its own version (milestone L4); the editor
 * warns with W10/N04 against the same table. Ownership of the table is frozen in M0
 * (doc/script-editor/implementation-plan.md §8): an entry names the recorder release that
 * introduced the feature. A feature **without** an entry cannot be published — the server refuses
 * rather than shipping a script that a recorder would silently skip.
 */
/** The recorder release this receiver serves; keep in step with the library's `VERSION`. */
export const RECORDER_VERSION = '3.11.26';

export const FEATURE_VERSIONS = {
  /** Prefill shipped in the 3.11.26 receiver (`ba81bcf8`, `PromptItemPrefill`). */
  prefill: '3.11.26',
  /** The playback modifier ships with this receiver — whichever version it reports (L3). */
  playback: RECORDER_VERSION,
};

/** Whether a recorder of `version` can run a script with this floor; an absent floor never blocks. */
export function supportsRecorderVersion(floor, version = RECORDER_VERSION) {
  return floor === null || floor === undefined || compareVersions(version, floor) >= 0;
}

/**
 * Numeric segment comparison, not string order: `"3.10" > "3.9"`, `"3.12" == "3.12.0"`, and a
 * pre-release (`3.12.0-rc1`) sorts before its release.
 *
 * @returns {number} negative when `a < b`, 0 when equal, positive when `a > b`.
 */
export function compareVersions(a, b) {
  const parse = (value) => {
    const [head, pre = null] = String(value ?? '').split('-', 2);
    const segments = head.split('.').map((segment) => {
      const n = Number(segment);
      return Number.isFinite(n) ? n : 0;
    });
    while (segments.length < 3) {
      segments.push(0);
    }
    return {segments, pre};
  };
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.segments.length, right.segments.length);
  for (let i = 0; i < length; i++) {
    const l = left.segments[i] ?? 0;
    const r = right.segments[i] ?? 0;
    if (l !== r) {
      return l < r ? -1 : 1;
    }
  }
  if (left.pre === right.pre) {
    return 0;
  }
  if (left.pre === null) {
    return 1;
  }
  if (right.pre === null) {
    return -1;
  }
  return left.pre < right.pre ? -1 : 1;
}

/** The script features that need a recorder floor. */
export function featuresUsed(script) {
  const used = new Set();
  for (const section of script?.sections ?? []) {
    for (const group of section.groups ?? []) {
      for (const item of group.promptItems ?? []) {
        if (item?.prefill !== undefined) {
          used.add('prefill');
        }
        if (item?.playback !== undefined) {
          used.add('playback');
        }
      }
    }
  }
  return [...used].sort();
}

/**
 * @returns {{minRecorderVersion: string|null, unknownFeatures: string[]}} the highest known floor,
 *   and the features that have no entry yet — the caller refuses the publish when it is non-empty.
 */
export function minRecorderVersionFor(script) {
  let highest = null;
  const unknownFeatures = [];
  for (const feature of featuresUsed(script)) {
    const version = FEATURE_VERSIONS[feature];
    if (version === undefined) {
      unknownFeatures.push(feature);
      continue;
    }
    if (highest === null || compareVersions(version, highest) > 0) {
      highest = version;
    }
  }
  return {minRecorderVersion: highest, unknownFeatures};
}
