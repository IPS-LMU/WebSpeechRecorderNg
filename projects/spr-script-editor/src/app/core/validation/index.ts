/**
 * The check catalogue's aggregation (doc/script-editor/validation.md): `runChecks` runs every
 * pure check in catalogue order and the publish-gate helpers count what the shell needs.
 */
import type {Draft, Finding, Severity, ValidationContext} from './types';
import {runErrorChecks} from './errors';
import {runWarningChecks} from './warnings';
import {runNoteChecks} from './notes';

export * from './types';
export {checkE01, checkE02, checkE03, checkE04, checkE05, checkE06, checkE07, checkE08, checkE09, checkE10, checkE11, TIMING_FIELDS} from './errors';
export {checkW01, checkW02, checkW03, checkW04, checkW05, checkW06, checkW07, checkW08, checkW09, checkW10, checkW11, checkW12, checkW13} from './warnings';
export {checkN01, checkN02, checkN03, checkN04, checkN05, checkN06} from './notes';
export {parseJsonSource, serialiseJson} from './json-lines';
export type {ParsedJsonSource, JsonLineError} from './json-lines';

/** Every finding for a draft, in catalogue order (E01…E11, W01…W13, N01…N06). */
export function runChecks(draft: Draft, context: ValidationContext = {}): Finding[] {
  return [
    ...runErrorChecks(draft, context),
    ...runWarningChecks(draft, context),
    ...runNoteChecks(draft, context),
  ];
}

export interface CheckCounts {
  errors: number;
  warnings: number;
  notes: number;
}

/**
 * Counts by severity. A *suspended* check never blocks: it is shown as a warning, so it cannot be
 * counted as an error even though its catalogue id is an error id (ui-spec §9).
 */
export function checkCounts(findings: ReadonlyArray<Finding>): CheckCounts {
  const counts: CheckCounts = {errors: 0, warnings: 0, notes: 0};
  for (const finding of findings) {
    if (finding.suspended === true) {
      counts.warnings++;
      continue;
    }
    counts[`${finding.severity}s` as keyof CheckCounts]++;
  }
  return counts;
}

export interface PublishGate extends CheckCounts {
  /** True when the error count blocks publishing. */
  blocked: boolean;
}

/** The publish gate of validation.md: errors block, warnings are confirmed. */
export function publishGate(findings: ReadonlyArray<Finding>): PublishGate {
  const counts = checkCounts(findings);
  return {...counts, blocked: counts.errors > 0};
}

/** Findings whose path is exactly `path` or a descendant of it (for outline markers). */
export function findingsUnder(findings: ReadonlyArray<Finding>, path: string): Finding[] {
  return findings.filter((finding) => finding.path === path || finding.path.startsWith(`${path}.`) || finding.path.startsWith(`${path}[`));
}

/** Groups findings by severity, for the checks panel. */
export function findingsBySeverity(findings: ReadonlyArray<Finding>): Record<Severity, Finding[]> {
  return {
    error: findings.filter((finding) => finding.severity === 'error' && finding.suspended !== true),
    warning: findings.filter((finding) => finding.severity === 'warning' || finding.suspended === true),
    note: findings.filter((finding) => finding.severity === 'note'),
  };
}
