/**
 * Fixture builders shared by the catalogue specs. Kept out of the specs so a spec's `describe`
 * reads as the catalogue row it tests.
 */
import type {BankItem} from 'speechrecorderng';
import type {BankView, Draft, Finding, ValidationContext} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function item(overrides: Record<string, any> = {}): Draft {
  return {itemcode: '1', mediaitems: [{mimetype: 'text/plain', text: 'x'}], ...overrides};
}

export function group(overrides: Record<string, unknown> = {}): Draft {
  return {order: 'SEQUENTIAL', promptItems: [item()], ...overrides};
}

export function section(overrides: Record<string, unknown> = {}): Draft {
  return {mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false, groups: [group()], ...overrides};
}

export function script(overrides: Record<string, unknown> = {}): Draft {
  return {name: 'Test', sections: [section()], ...overrides};
}

export function bankView(bankId: string, items: BankItem[]): BankView {
  return {bankId, items};
}

/** A bank lookup over a plain `{id: BankView}` record; unknown ids are "does not exist". */
export function lookupOf(banks: Record<string, BankView>): ValidationContext['bankLookup'] {
  return (bankId: string) => banks[bankId] ?? null;
}

export function context(overrides: ValidationContext = {}): ValidationContext {
  return {...overrides};
}

export function ids(findings: ReadonlyArray<Finding>): string[] {
  return findings.map((finding) => finding.id);
}

export function paths(findings: ReadonlyArray<Finding>): string[] {
  return findings.map((finding) => finding.path);
}
