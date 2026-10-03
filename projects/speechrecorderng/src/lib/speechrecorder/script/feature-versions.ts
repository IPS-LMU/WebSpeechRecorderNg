/**
 * The recorder release that introduced each script feature, and the arithmetic the version gate
 * needs (milestone L4).
 *
 * A script carries `minRecorderVersion` — stamped by the editor on publish — and a recorder that is
 * older than that refuses to run it with a clear message instead of silently skipping what it does
 * not understand. The table mirrors [data-model.md](../../../../../../doc/script-editor/data-model.md)
 * §5; the server keeps its own copy (`server/feature-versions.mjs`) and both are held to the same
 * cases by their tests, because the server re-checks the gate at session creation (C8).
 */
import {VERSION} from '../../spr.module.version';
import {PromptItem, Script, Section} from './script';

export const FEATURE_VERSIONS: Readonly<Record<string, string>> = {
  /** Prefill shipped in the 3.11.26 release. */
  prefill: '3.11.26',
  /** The playback modifier ships with this build, whatever version it reports. */
  playback: VERSION,
};

/**
 * Numeric segment comparison, not string order: `"3.10" > "3.9"`, `"3.12" == "3.12.0"`, and a
 * pre-release (`3.12.0-rc1`) sorts before its release.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => {
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
export function featuresUsed(script: Script | null | undefined): Array<string> {
  const used: Record<string, true> = {};
  for (const section of (script?.sections ?? []) as Array<Section>) {
    for (const group of section?.groups ?? []) {
      for (const item of (group?.promptItems ?? []) as Array<PromptItem>) {
        if (item?.prefill !== undefined && item.prefill !== null) {
          used['prefill'] = true;
        }
        if (item?.playback !== undefined && item.playback !== null) {
          used['playback'] = true;
        }
      }
    }
  }
  return Object.keys(used).sort();
}

/** The highest floor the script's features imply, or null when nothing in it has one. */
export function minRecorderVersionFor(script: Script | null | undefined): string | null {
  let highest: string | null = null;
  for (const feature of featuresUsed(script)) {
    const version = FEATURE_VERSIONS[feature];
    if (version === undefined) {
      continue;
    }
    if (highest === null || compareVersions(version, highest) > 0) {
      highest = version;
    }
  }
  return highest;
}

/**
 * Whether a recorder of `version` can run the script: an absent floor is always runnable, and the
 * declared `minRecorderVersion` wins over the computed one (the server may know a newer floor than
 * this build's table).
 */
export function supportsRecorderVersion(script: Script | null | undefined, version: string = VERSION): boolean {
  const floor = script?.minRecorderVersion ?? minRecorderVersionFor(script);
  return floor === null || floor === undefined || compareVersions(version, floor) >= 0;
}
