import type {Finding} from '../core/validation';
import {filterOutline, flattenOutline, sectionCounts} from './outline';

const script = {
  name: 'Demo',
  sections: [
    {
      name: 'Intro',
      training: true,
      groups: [{
        promptItems: [
          {itemcode: 'A1', mediaitems: [{mimetype: 'text/plain', text: 'Hello there'}]},
          {itemcode: 'A2', mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]},
        ],
      }],
    },
    {
      name: 'Draw',
      groups: [{
        promptItems: [{
          itemcode: 'RB',
          prefill: {bank: {bank: 'std', bankSource: 'BUILTIN', count: 3, itemcodePrefix: 'RB'}},
        }],
      }],
    },
  ],
};

const finding: Finding = {
  id: 'E06',
  severity: 'error',
  path: 'sections[0].groups[0].promptItems[1].itemcode',
  message: 'x',
};

const banks = new Map([['std', 'Standard passages']]);

describe('outline: flattening', () => {
  const rows = flattenOutline(script, [finding], {bankNames: banks});

  it('walks script, section, group, item in order', () => {
    expect(rows.map((row) => row.kind))
      .toEqual(['script', 'section', 'group', 'item', 'item', 'section', 'group']);
    expect(rows.map((row) => row.level)).toEqual([0, 1, 2, 3, 3, 1, 2]);
  });

  it('never lists fake children under a drawn group', () => {
    const drawn = rows[rows.length - 1];
    expect(drawn.markers.drawn).toEqual({count: 3, bank: 'Standard passages'});
    expect(rows.some((row) => row.parentKey === drawn.key)).toBe(false);
  });

  it('marks the training section, the media item and the warned item', () => {
    const intro = rows[1];
    const a1 = rows[3];
    const a2 = rows[4];
    expect(intro.markers.training).toBe(true);
    expect(a1.markers.playsMedia).toBe(false);
    expect(a2.markers.playsMedia).toBe(true);
    expect(a1.markers.warning).toBe(false);
    expect(a2.markers.warning).toBe(true);
  });

  it('carries the itemcode and the prompt as label and secondary text', () => {
    expect(rows[3].label).toBe('A1');
    expect(rows[3].secondary).toBe('Hello there');
    expect(rows[4].label).toBe('A2');
  });
});

describe('outline: filtering', () => {
  const rows = flattenOutline(script, [], {bankNames: banks});

  it('keeps everything for an empty query', () => {
    expect(filterOutline(rows, '').length).toBe(rows.length);
  });

  it('keeps the ancestors of an itemcode match', () => {
    expect(filterOutline(rows, 'a2').map((row) => row.key))
      .toEqual(['script', 's0', 's0.g0', 's0.g0.i1']);
  });

  it('matches prompt text', () => {
    expect(filterOutline(rows, 'hello').map((row) => row.key))
      .toEqual(['script', 's0', 's0.g0', 's0.g0.i0']);
  });

  it('matches a drawn group by its itemcode prefix', () => {
    expect(filterOutline(rows, 'rb').map((row) => row.key)).toEqual(['script', 's1', 's1.g0']);
  });

  it('returns nothing when no row matches', () => {
    expect(filterOutline(rows, 'zzz')).toEqual([]);
  });
});

describe('outline: section counts', () => {
  it('separates fixed items from per-session drawn items', () => {
    expect(sectionCounts(script.sections[0])).toEqual({fixed: 2, drawn: 0});
    expect(sectionCounts(script.sections[1])).toEqual({fixed: 0, drawn: 3});
  });
});

describe('outline: collapse state', () => {
  const script3 = {
    name: 'Demo',
    sections: [
      {name: 'One', mode: 'MANUAL', groups: [{promptItems: [{itemcode: 'A'}, {itemcode: 'B'}]}]},
      {name: 'Two', mode: 'MANUAL', groups: [{promptItems: [{itemcode: 'C'}]}]},
    ],
  };

  it('marks the rows that can and cannot be expanded', () => {
    const rows = flattenOutline(script3);
    const byKey = new Map(rows.map((row) => [row.key, row]));
    expect(byKey.get('script')?.hasChildren).toBe(true);
    expect(byKey.get('s0')?.hasChildren).toBe(true);
    expect(byKey.get('s0.g0')?.hasChildren).toBe(true);
    expect(byKey.get('s0.g0.i0')?.hasChildren).toBe(false);
  });

  it('hides the whole subtree of a collapsed key, but keeps the key itself', () => {
    const rows = flattenOutline(script3, [], {collapsed: new Set(['s0'])});
    expect(rows.map((row) => row.key)).toEqual(['script', 's0', 's1', 's1.g0', 's1.g0.i0']);
  });

  it('hides nested subtrees when a deep key is collapsed', () => {
    const rows = flattenOutline(script3, [], {collapsed: new Set(['s0.g0'])});
    expect(rows.map((row) => row.key)).toEqual(['script', 's0', 's0.g0', 's1', 's1.g0', 's1.g0.i0']);
  });

  it('returns the full tree for an empty or absent collapsed set', () => {
    const full = flattenOutline(script3);
    expect(flattenOutline(script3, [], {collapsed: new Set()})).toEqual(full);
    expect(flattenOutline(script3, [], {})).toEqual(full);
  });

  it('never hides the script row, which has no parent', () => {
    const rows = flattenOutline(script3, [], {collapsed: new Set(['script'])});
    expect(rows[0].key).toBe('script');
    expect(rows.some((row) => row.key === 's0')).toBe(false);
  });
});
