import {PromptItem} from 'speechrecorderng';
import {loadScript} from './load';
import {EditorGroup, EditorScript} from './script.model';

/**
 * `loadScript` must prepare the editor's read-only views without changing the script:
 * the shuffled arrays mirror the real ones (never a copy that could drift or reorder), unknown
 * keys survive, and a legacy `promptUnits` section is not given a fabricated `groups: []`
 * (data-model.md §4 invariant 10, A4/D-M).
 */
describe('loadScript', () => {
  it('fills _shuffledGroups and _shuffledPromptItems with the real arrays, verbatim', () => {
    const items: PromptItem[] = [
      {itemcode: 'A', mediaitems: []},
      {itemcode: 'B', mediaitems: []},
      {itemcode: 'C', mediaitems: []},
    ];
    const groups: EditorGroup[] = [{promptItems: items}];
    const script: EditorScript = {sections: [{groups}]};

    const loaded = loadScript(script);

    expect(loaded.sections?.[0]._shuffledGroups).toBe(groups);
    expect(loaded.sections?.[0].groups).toBe(groups);
    expect(loaded.sections?.[0]._shuffledGroups?.[0]._shuffledPromptItems).toBe(items);
    // Verbatim means the order is the draft's, not a shuffled permutation.
    expect(loaded.sections?.[0]._shuffledGroups?.[0]._shuffledPromptItems?.map((item) => item.itemcode))
      .toEqual(['A', 'B', 'C']);
  });

  it('keeps unknown JSON keys untouched', () => {
    const script: EditorScript = {
      scriptId: 1245,
      sections: [{name: 'Intro', speakerDisplay: true, groups: [{promptItems: []}]}],
    };

    const loaded = loadScript(script);

    expect((loaded.sections?.[0] as Record<string, unknown>)['speakerDisplay']).toBe(true);
    expect(loaded.sections?.[0].name).toBe('Intro');
  });

  it('never fabricates groups over a legacy promptUnits section', () => {
    const promptUnits: PromptItem[] = [{itemcode: 'I0', mediaitems: []}];
    const script: EditorScript = {sections: [{name: 'Legacy', promptUnits}]};

    const loaded = loadScript(script);

    expect('groups' in (loaded.sections?.[0] as object)).toBe(false);
    expect('_shuffledGroups' in (loaded.sections?.[0] as object)).toBe(false);
    expect(loaded.sections?.[0].promptUnits).toBe(promptUnits);
  });
});
