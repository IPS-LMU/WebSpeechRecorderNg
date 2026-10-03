import type {Finding} from '../core/validation/types';
import {cardFor, fixChoices, groupCards, isDataFix} from './panel';
import {formatSelection, selectionFromPath, severityOfId, subjectOf} from './paths';

const DRAFT = {
  sections: [
    {
      name: 'Warm-up',
      groups: [
        {order: 'SEQUENTIAL', promptItems: [{itemcode: 'A1', mediaitems: [{mimetype: 'text/plain', text: 'Hi'}]}]},
      ],
    },
  ],
};

function finding(id: string, path: string, extra: Partial<Finding> = {}): Finding {
  return {id, path, severity: 'error', message: `${id} message`, ...extra};
}

describe('checks panel paths', () => {
  it('maps a finding path to the deepest selection', () => {
    expect(selectionFromPath('sections[2].groups[1].promptItems[0].itemcode')).toEqual({kind: 'item', section: 2, group: 1, item: 0});
    expect(selectionFromPath('sections[2].groups[1].promptItems')).toEqual({kind: 'group', section: 2, group: 1});
    expect(selectionFromPath('sections[2].groups')).toEqual({kind: 'section', section: 2});
    expect(selectionFromPath('name')).toEqual({kind: 'script'});
    expect(selectionFromPath('sections')).toEqual({kind: 'script'});
  });

  it('formats the editor ?sel= value', () => {
    expect(formatSelection({kind: 'script'})).toBe('script');
    expect(formatSelection({kind: 'section', section: 2})).toBe('s:2');
    expect(formatSelection({kind: 'group', section: 2, group: 1})).toBe('g:2:1');
    expect(formatSelection({kind: 'item', section: 2, group: 1, item: 0})).toBe('i:2:1:0');
  });

  it('labels the card subject as node · field', () => {
    expect(subjectOf(DRAFT, 'sections[0].groups[0].promptItems[0].itemcode')).toBe('Item A1 · itemcode');
    expect(subjectOf(DRAFT, 'sections[0].groups[0].promptItems[3].itemcode')).toBe('Item 1.1.4 · itemcode');
    expect(subjectOf(DRAFT, 'sections[0].groups')).toBe('Section 1 · groups');
    expect(subjectOf(DRAFT, 'sections[2].groups[0].prefill.bank.count')).toBe('Group 3.1 · prefill.bank.count');
  });

  it('derives a missing severity from the check id', () => {
    expect(severityOfId('E02')).toBe('error');
    expect(severityOfId('W11')).toBe('warning');
    expect(severityOfId('N04')).toBe('note');
    expect(severityOfId('X1')).toBe('warning');
  });
});

describe('checks panel cards', () => {
  const context = {draft: DRAFT, lineOf: () => 7, project: 'Demo1', scriptId: '1245', server: false};

  it('puts a suspended error in the warning group and keeps its consequence', () => {
    const card = cardFor(finding('E04', 'sections[0].groups[0].count', {suspended: true}), context);
    expect(card.severity).toBe('warning');
    expect(groupCards([card]).map((group) => group.severity)).toEqual(['warning']);
    expect(card.consequence).toBe('E04 message');
  });

  it('carries the line, the subject and the deep link into the editor', () => {
    const card = cardFor(finding('E01', 'sections[0].groups[0].promptItems[0].itemcode'), context);
    expect(card.line).toBe(7);
    expect(card.subject).toBe('Item A1 · itemcode');
    expect(card.link).toEqual(['/project', 'Demo1', 'script', '1245', 'edit']);
    expect(card.linkQuery).toEqual({sel: 'i:0:0:0'});
    expect(card.server).toBe(false);
  });

  it('offers the catalogue fixes and marks the UI kinds as no data fix', () => {
    expect(fixChoices(finding('E02', 'p', {fix: 'next-code'}))).toEqual([{label: 'Use the next free code', options: {}}]);
    expect(fixChoices(finding('N02', 'p', {fix: 'replace-order'}))).toEqual([
      {label: 'Use Random', options: {order: 'RANDOM'}},
      {label: 'Use Sequential', options: {order: 'SEQUENTIAL'}},
    ]);
    expect(fixChoices(finding('E08', 'p', {fix: 'keep-one-side'}))).toEqual([
      {label: 'Keep the fixed list', options: {keep: 'list'}},
      {label: 'Keep the draw rule', options: {keep: 'rule'}},
    ]);
    expect(fixChoices(finding('E01', 'p', {fix: 'focus'}))).toEqual([]);
    expect(fixChoices(finding('E01', 'p'))).toEqual([]);
    expect(isDataFix('clamp-count')).toBe(true);
    expect(isDataFix('focus')).toBe(false);
    expect(isDataFix(undefined)).toBe(false);
  });

  it('orders groups error → warning → note and drops empty groups', () => {
    const cards = [
      cardFor(finding('N03', 'name', {severity: 'note'}), context),
      cardFor(finding('E01', 'name'), context),
      cardFor(finding('W01', 'name', {severity: 'warning'}), context),
    ];
    expect(groupCards(cards).map((group) => group.severity)).toEqual(['error', 'warning', 'note']);
    expect(groupCards([cards[0]]).map((group) => group.severity)).toEqual(['note']);
  });
});
