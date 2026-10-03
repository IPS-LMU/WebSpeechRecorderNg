import type {Finding} from '../core/validation';
import {drawnPlaceholder, drawnSource, hasWarning, isDrawnGroup, itemPlaysMedia} from './markers';

const finding = (path: string): Finding => ({id: 'E06', severity: 'error', path, message: 'x'});

describe('markers: warning from findings', () => {
  const findings = [finding('sections[0].groups[0].promptItems[1].itemcode')];

  it('marks a row whose own path carries a finding', () => {
    expect(hasWarning(findings, 'sections[0].groups[0].promptItems[1]')).toBe(true);
  });

  it('marks ancestors of the finding', () => {
    expect(hasWarning(findings, 'sections[0].groups[0]')).toBe(true);
    expect(hasWarning(findings, 'sections[0]')).toBe(true);
  });

  it('does not mark siblings or the script row', () => {
    expect(hasWarning(findings, 'sections[0].groups[1]')).toBe(false);
    expect(hasWarning(findings, 'sections[1]')).toBe(false);
    expect(hasWarning(findings, '')).toBe(false);
  });

  it('does not confuse a longer sibling index with a prefix match', () => {
    const broad = [finding('sections[10].groups[0].promptItems[0].itemcode')];
    expect(hasWarning(broad, 'sections[1]')).toBe(false);
    expect(hasWarning(broad, 'sections[10]')).toBe(true);
  });
});

describe('markers: media and drawn sources', () => {
  it('detects an item that plays media through any audio mediaitem', () => {
    expect(itemPlaysMedia({mediaitems: [{mimetype: 'text/plain', text: 'hi'}]})).toBe(false);
    expect(itemPlaysMedia({mediaitems: [{mimetype: 'image/png', src: 'a.png'}]})).toBe(false);
    expect(itemPlaysMedia({mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]})).toBe(true);
    expect(itemPlaysMedia({mediaitems: [{mimetype: 'text/plain'}, {mimetype: 'audio/wav'}]})).toBe(true);
  });

  it('reads the bank source of a placeholder item', () => {
    const source = {bank: 'demo', bankSource: 'PROJECT' as const, count: 2, itemcodePrefix: 'RB'};
    expect(drawnSource({prefill: {bank: source}})).toEqual(source);
    expect(drawnSource({itemcode: 'X'})).toBeNull();
  });

  it('recognises a drawn group and returns its placeholder', () => {
    const source = {bank: 'demo', bankSource: 'PROJECT' as const, count: 2, itemcodePrefix: 'RB'};
    const group = {promptItems: [{itemcode: 'X'}, {itemcode: 'RB', prefill: {bank: source}}]};
    expect(isDrawnGroup(group)).toBe(true);
    expect(drawnPlaceholder(group)?.itemcode).toBe('RB');
    expect(isDrawnGroup({promptItems: [{itemcode: 'X'}]})).toBe(false);
    expect(drawnPlaceholder({promptItems: []})).toBeNull();
  });
});
