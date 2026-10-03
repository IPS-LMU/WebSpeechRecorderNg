import type {EditorScript} from '../core/script.model';
import type {Finding} from '../core/validation/types';
import {dotsByLine, draftTextOfModel, formatSourceJson, lineNumbers, sourceParseState} from './json-source-view';

function finding(id: string, path: string): Finding {
  return {id, path, severity: 'error', message: `${id} message`};
}

describe('sourceParseState', () => {
  it('accepts a JSON object', () => {
    expect(sourceParseState('{"a":1}')).toEqual({kind: 'ok', error: null, applicable: true});
  });

  it('reports a syntax error at its line', () => {
    const state = sourceParseState('{\n  "a": 1,\n  "b":\n}');
    expect(state.kind).toBe('syntax');
    expect(state.applicable).toBe(false);
    expect(state.error?.line).toBe(4);
  });

  it('rejects a value that parses but is not an object', () => {
    expect(sourceParseState('[1,2]')).toEqual({kind: 'shape', error: null, applicable: false});
    expect(sourceParseState('42').applicable).toBe(false);
  });
});

describe('lineNumbers', () => {
  it('lists one number per logical line', () => {
    expect(lineNumbers('a\nb\nc')).toEqual([1, 2, 3]);
    expect(lineNumbers('')).toEqual([1]);
  });
});

describe('dotsByLine', () => {
  const text = '{\n  "name": "x",\n  "sections": [\n    {"groups": []}\n  ]\n}';

  it('maps each finding to the line its path starts on', () => {
    const dots = dotsByLine(text, [
      finding('E01', 'name'),
      finding('E10', 'sections[0]'),
      finding('E10', 'sections[0].groups'),
    ]);
    expect([...dots.keys()].sort((a, b) => a - b)).toEqual([2, 4]);
    expect(dots.get(2)?.map((entry) => entry.id)).toEqual(['E01']);
    expect(dots.get(4)?.map((entry) => entry.id)).toEqual(['E10', 'E10']);
  });

  it('drops a path that no longer resolves', () => {
    const dots = dotsByLine(text, [finding('E01', 'sections[9].itemcode')]);
    expect(dots.size).toBe(0);
  });
});

describe('formatSourceJson', () => {
  it('re-indents without reordering keys', () => {
    const formatted = formatSourceJson('{"b":1,"a":{"d":2,"c":3}}');
    expect(formatted).toBe('{\n  "b": 1,\n  "a": {\n    "d": 2,\n    "c": 3\n  }\n}');
  });

  it('returns null for text that is not an object', () => {
    expect(formatSourceJson('{oops')).toBeNull();
    expect(formatSourceJson('[]')).toBeNull();
  });
});

describe('draftTextOfModel', () => {
  it('strips the _shuffled runtime mirrors before serialising', () => {
    // The runtime mirrors `load.ts` adds are typed on `EditorScript`; the fixture only needs the
    // shape, so it is asserted once here rather than built as a full PromptItem.
    const model = {
      name: 'x',
      sections: [{
        groups: [{promptItems: [], _shuffledPromptItems: [{}]}],
        _shuffledGroups: [{}],
      }],
    } as unknown as EditorScript;
    const text = draftTextOfModel(model);
    expect(text).not.toContain('_shuffled');
    expect(JSON.parse(text)).toEqual({name: 'x', sections: [{groups: [{promptItems: []}]}]});
  });
});
