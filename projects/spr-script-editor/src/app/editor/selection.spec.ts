import {
  SCRIPT_SELECTION,
  formatSelection,
  parseSelection,
  sanitiseSelection,
  selectionFromQuery,
  selectionPath,
} from './selection';

const script = {
  sections: [
    {groups: [{promptItems: [{itemcode: 'A'}, {itemcode: 'B'}]}]},
    {groups: []},
  ],
};

describe('selection: ?sel= parsing and formatting', () => {
  it('round-trips every kind', () => {
    const selections = [
      {kind: 'script'} as const,
      {kind: 'section', section: 2} as const,
      {kind: 'group', section: 2, group: 1} as const,
      {kind: 'item', section: 2, group: 0, item: 1} as const,
    ];
    for (const selection of selections) {
      expect(parseSelection(formatSelection(selection))).toEqual(selection);
    }
  });

  it('formats the documented strings', () => {
    expect(formatSelection({kind: 'script'})).toBe('script');
    expect(formatSelection({kind: 'section', section: 2})).toBe('s:2');
    expect(formatSelection({kind: 'group', section: 2, group: 1})).toBe('g:2:1');
    expect(formatSelection({kind: 'item', section: 2, group: 0, item: 1})).toBe('i:2:0:1');
  });

  it('rejects malformed and negative selections', () => {
    expect(parseSelection('')).toBeNull();
    expect(parseSelection('nonsense')).toBeNull();
    expect(parseSelection('s:-1')).toBeNull();
    expect(parseSelection('i:2:0')).toBeNull();
    expect(parseSelection('g:2:1:extra')).toBeNull();
  });

  it('parses an explicit script selection', () => {
    expect(parseSelection('script')).toEqual({kind: 'script'});
  });
});

describe('selection: sanitising against the draft', () => {
  it('falls back to the nearest existing ancestor', () => {
    expect(sanitiseSelection({kind: 'item', section: 0, group: 0, item: 9}, script))
      .toEqual({kind: 'group', section: 0, group: 0});
    expect(sanitiseSelection({kind: 'item', section: 0, group: 9, item: 0}, script))
      .toEqual({kind: 'section', section: 0});
    expect(sanitiseSelection({kind: 'group', section: 9, group: 0}, script))
      .toEqual(SCRIPT_SELECTION);
    expect(sanitiseSelection({kind: 'section', section: 9}, script))
      .toEqual(SCRIPT_SELECTION);
  });

  it('keeps a selection that exists', () => {
    expect(sanitiseSelection({kind: 'item', section: 0, group: 0, item: 1}, script))
      .toEqual({kind: 'item', section: 0, group: 0, item: 1});
  });

  it('turns a missing or malformed query into the script, with a fallback when out of range', () => {
    expect(selectionFromQuery(null, script)).toEqual(SCRIPT_SELECTION);
    expect(selectionFromQuery('', script)).toEqual(SCRIPT_SELECTION);
    expect(selectionFromQuery('i:0:0:9', script)).toEqual({kind: 'group', section: 0, group: 0});
    expect(selectionFromQuery('i:0:0:1', script)).toEqual({kind: 'item', section: 0, group: 0, item: 1});
  });
});

describe('selection: JSON paths', () => {
  it('mirrors the validation catalogue paths', () => {
    expect(selectionPath({kind: 'script'})).toBe('');
    expect(selectionPath({kind: 'section', section: 2})).toBe('sections[2]');
    expect(selectionPath({kind: 'group', section: 2, group: 1})).toBe('sections[2].groups[1]');
    expect(selectionPath({kind: 'item', section: 2, group: 0, item: 1}))
      .toBe('sections[2].groups[0].promptItems[1]');
  });
});
