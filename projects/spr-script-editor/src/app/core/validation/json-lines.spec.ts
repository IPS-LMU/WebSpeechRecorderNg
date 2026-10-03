/**
 * D-E specs: JSON path → line mapping, escapes, tabs/CRLF, duplicate keys, unicode and a stable
 * serialisation.
 */
import {parseJsonSource, serialiseJson} from './json-lines';

describe('parseJsonSource', () => {
  it('maps each value to the line it starts on', () => {
    const text = '{\n  "a": 1,\n  "b": {\n    "c": "x"\n  }\n}';
    const parsed = parseJsonSource(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.lineOf('a')).toBe(2);
    expect(parsed.lineOf('b')).toBe(3);
    expect(parsed.lineOf('b.c')).toBe(4);
  });

  it('maps array entries by index', () => {
    const text = '{\n  "sections": [\n    {\n      "order": "RANDOM"\n    }\n  ]\n}';
    const parsed = parseJsonSource(text);
    expect(parsed.lineOf('sections')).toBe(2);
    expect(parsed.lineOf('sections[0]')).toBe(3);
    expect(parsed.lineOf('sections[0].order')).toBe(4);
  });

  it('decodes escapes exactly like JSON.parse and keeps later lines aligned', () => {
    const text = '{\n  "s": "a\\"b\\\\c\\/d\\be\\ff\\ng\\rh\\ti\\u00e5",\n  "n": 2\n}';
    const parsed = parseJsonSource(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.value).toEqual(JSON.parse(text));
    expect(parsed.lineOf('n')).toBe(3);
  });

  it('treats a CRLF pair as one line break', () => {
    const text = '{\r\n  "a": 1,\r\n  "b": 2\r\n}';
    const parsed = parseJsonSource(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.lineOf('a')).toBe(2);
    expect(parsed.lineOf('b')).toBe(3);
  });

  it('keeps raw unicode intact', () => {
    const text = '{\n  "å": "ä"\n}';
    const parsed = parseJsonSource(text);
    expect(parsed.value).toEqual({å: 'ä'});
  });

  it('handles duplicate keys with JSON.parse semantics and records the path', () => {
    const parsed = parseJsonSource('{"a":1,"a":2}');
    expect(parsed.ok).toBe(true);
    expect(parsed.value).toEqual({a: 2});
    expect(parsed.duplicates).toEqual(['a']);
  });

  it('reports a parse error with its line instead of throwing', () => {
    const parsed = parseJsonSource('{\n  "a": ,\n}');
    expect(parsed.ok).toBe(false);
    expect(parsed.error?.line).toBe(2);
  });

  it('reports an empty draft', () => {
    const parsed = parseJsonSource('   ');
    expect(parsed.ok).toBe(false);
    expect(parsed.error?.message).toContain('empty');
  });
});

describe('serialiseJson', () => {
  it('writes a stable key order', () => {
    expect(serialiseJson({b: 1, a: 2})).toBe('{\n  "a": 2,\n  "b": 1\n}');
  });

  it('is deterministic and round-trips without loss', () => {
    const value = {sections: [{order: 'RANDOM', promptItems: [{itemcode: '1', text: 'å'}]}], name: 'x'};
    const once = serialiseJson(value);
    expect(serialiseJson(value)).toBe(once);
    expect(JSON.parse(once)).toEqual(value);
  });

  it('preserves strings that need escapes', () => {
    const value = {text: 'a"b\\c\nd\te'};
    expect(JSON.parse(serialiseJson(value))).toEqual(value);
  });
});
