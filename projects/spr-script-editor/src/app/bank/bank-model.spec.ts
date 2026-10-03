import {bankAudioUrl, codeRange, drawFilterOf, EMPTY_FILTER_FIELDS, fieldsOfFilter, groupBanks, isFilterEmpty, itemQueryOf} from './bank-model';

describe('bank filter model', () => {
  it('omits every empty clause from the persisted filter', () => {
    expect(drawFilterOf({...EMPTY_FILTER_FIELDS})).toEqual({});
    expect(isFilterEmpty({...EMPTY_FILTER_FIELDS})).toBe(true);
  });

  it('freezes the semantics: ANDed tags, inclusive bounds, exact category, tri-state audio', () => {
    const filter = drawFilterOf({
      category: 'sentence',
      minWords: '6',
      maxWords: '12',
      audio: 'with',
      tags: 'balanced, read',
      q: '  sea  ',
    });

    expect(filter).toEqual({
      category: 'sentence',
      words: [6, 12],
      hasAudio: true,
      tags: ['balanced', 'read'],
      q: 'sea',
    });
  });

  it('keeps hasAudio=false meaning “without a model recording”', () => {
    expect(drawFilterOf({...EMPTY_FILTER_FIELDS, audio: 'without'}).hasAudio).toBe(false);
    expect(drawFilterOf({...EMPTY_FILTER_FIELDS, audio: 'any'}).hasAudio).toBeUndefined();
  });

  it('opens an inclusive bound when only one end is given (the receiver’s shape)', () => {
    const minOnly = drawFilterOf({...EMPTY_FILTER_FIELDS, minWords: '4'}).words;
    const maxOnly = drawFilterOf({...EMPTY_FILTER_FIELDS, maxWords: '9'}).words;

    expect(minOnly?.[0]).toBe(4);
    expect(minOnly?.[1]).toBeUndefined();
    expect(maxOnly?.[0]).toBeUndefined();
    expect(maxOnly?.[1]).toBe(9);
  });

  it('serialises the wire query with the page, tags repeated by the service', () => {
    const query = itemQueryOf(
      {...EMPTY_FILTER_FIELDS, category: 'sentence', minWords: '6', maxWords: '12', audio: 'with', tags: 'x, y', q: 'sea'},
      {limit: 50, offset: 10},
    );

    expect(query).toEqual({
      category: 'sentence',
      minWords: 6,
      maxWords: 12,
      hasAudio: true,
      tags: ['x', 'y'],
      q: 'sea',
      limit: 50,
      offset: 10,
    });
  });

  it('round-trips a stored filter through the controls unchanged', () => {
    const filter = {category: 'vowel', words: [1, 2] as [number, number], hasAudio: false, tags: ['prompt'], q: 'a'};

    expect(drawFilterOf(fieldsOfFilter(filter))).toEqual(filter);
  });

  it('groups the banks by origin, never by name', () => {
    const project = {bankId: 'own', title: 'Own', source: 'PROJECT' as const};
    const builtin = {bankId: 'std', title: 'Standard', source: 'BUILTIN' as const};

    expect(groupBanks([builtin, project])).toEqual({project: [project], builtin: [builtin]});
  });

  it('builds the generated itemcode range, capped at 999, or nothing without a prefix', () => {
    expect(codeRange('RB', 2)).toEqual({first: 'RB001', last: 'RB002', count: 2});
    expect(codeRange('RB', 1000)).toEqual({first: 'RB001', last: 'RB999', count: 999});
    expect(codeRange('', 5)).toBeNull();
    expect(codeRange('RB', 0)).toBeNull();
  });

  it('resolves a model recording to a project resource URL', () => {
    expect(bankAudioUrl('api/v1/', 'Demo1', 'media/std-vowel-a.wav'))
      .toBe('api/v1/project/Demo1/media/std-vowel-a.wav');
    expect(bankAudioUrl('', 'Demo One', 'media/a b.wav'))
      .toBe('project/Demo%20One/media/a%20b.wav');
  });
});
