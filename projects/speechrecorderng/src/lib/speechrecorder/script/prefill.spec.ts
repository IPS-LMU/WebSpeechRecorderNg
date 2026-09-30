import {Group, Mediaitem, PromptItem, Script, Section} from "./script";
import {PrefillChoices, PrefillSource, ScriptPrefillUtil} from "./prefill";

function item(itemcode: string, prefill?: PromptItem["prefill"]): PromptItem {
  return {itemcode, prerecdelay: 800, recduration: 30000, mediaitems: [{mimetype: "text/plain", text: "placeholder"}], prefill};
}

function wordList(id: string, entries: Array<string>): {id: string, entries: Array<string>} {
  return {id, entries};
}

function scriptWith(prefillItem: PromptItem, others: Array<PromptItem> = []): Script {
  const group: Group = {promptItems: [prefillItem, ...others], _shuffledPromptItems: []};
  const section: Section = {mode: "MANUAL", promptphase: "IDLE", training: false, groups: [group], _shuffledGroups: []};
  return {sections: [section]};
}

describe('ScriptPrefillUtil.specs', () => {

  it('finds the prefill declarations of a script in order', () => {
    const word = {itemcode: "6", mediaitems: [], prefill: {source: "words", select: "random" as const, itemcodeFormat: "6.{n}", mediaitems: []}};
    const sentence = {itemcode: "7", mediaitems: [], prefill: {source: "sentences", select: "random" as const, itemcodeFormat: "7.{n}", mediaitems: []}};
    const plain = {itemcode: "5", mediaitems: []};
    const specs = ScriptPrefillUtil.specs(scriptWith(word, [sentence, plain]));
    expect(specs.map((s) => s.itemcode)).toEqual(["6", "7"]);
    expect(specs[0].spec.source).toBe("words");
    expect(specs[1].spec.source).toBe("sentences");
  });

  it('ignores items without a prefill declaration and placeholder without itemcode', () => {
    const plain = {itemcode: "5", mediaitems: []};
    const anonymous = {mediaitems: [], prefill: {source: "words", select: "random" as const, itemcodeFormat: "{n}", mediaitems: []}};
    expect(ScriptPrefillUtil.specs(scriptWith(plain, [anonymous]))).toEqual([]);
  });

});

describe('ScriptPrefillUtil.itemcodeOf', () => {

  it('replaces every {n} by the 1-based position', () => {
    expect(ScriptPrefillUtil.itemcodeOf("6.{n}", 1)).toBe("6.1");
    expect(ScriptPrefillUtil.itemcodeOf("6.{n}", 33)).toBe("6.33");
    expect(ScriptPrefillUtil.itemcodeOf("{n}", 7)).toBe("7");
  });

  it('leaves a format without {n} unchanged (duplicate codes for all items)', () => {
    expect(ScriptPrefillUtil.itemcodeOf("STI", 3)).toBe("STI");
  });

});

describe('ScriptPrefillUtil.expand', () => {

  const words: PrefillSource = {lists: [wordList("w1", ["apa", "bil"]), wordList("w2", ["hus", "sol"])]};

  it('replaces a placeholder by one item per entry of the drawn list', () => {
    const script = scriptWith(item("6", {
      source: "words", select: "random", itemcodeFormat: "6.{n}", mediaitems: [{mimetype: "text/plain", text: "{entry}"}]
    }));
    const expanded = ScriptPrefillUtil.expand(script, new Map([["words", words]]), {"6": {source: "words", list: "w1"}});
    const items = expanded.sections[0].groups[0].promptItems;
    expect(items.length).toBe(2);
    expect(items.map((i) => i.itemcode)).toEqual(["6.1", "6.2"]);
    expect(items[0].mediaitems[0].text).toBe("apa");
    expect(items[1].mediaitems[0].text).toBe("bil");
  });

  it('carries the placeholder recording properties over to the generated items', () => {
    const script = scriptWith(item("6", {
      source: "words", select: "random", itemcodeFormat: "6.{n}", mediaitems: [{mimetype: "text/plain", text: "{entry}"}]
    }));
    const expanded = ScriptPrefillUtil.expand(script, new Map([["words", words]]), {"6": {source: "words", list: "w2"}});
    const generated = expanded.sections[0].groups[0].promptItems[0];
    expect(generated.prerecdelay).toBe(800);
    expect(generated.recduration).toBe(30000);
    expect(generated.prefill).toBeUndefined();
  });

  it('uses the prefill instruction for the generated items, the placeholder instruction otherwise', () => {
    const base = item("6", {
      source: "words", select: "random", itemcodeFormat: "6.{n}", mediaitems: [{mimetype: "text/plain", text: "{entry}"}]
    });
    base.recinstructions = {recinstructions: "placeholder instruction"};
    const withOwn = ScriptPrefillUtil.expand(scriptWith(base), new Map([["words", words]]), {"6": {source: "words", list: "w1"}});
    expect(withOwn.sections[0].groups[0].promptItems[0].recinstructions?.recinstructions).toBe("placeholder instruction");

    base.prefill = {...base.prefill!, recinstructions: "read the word"};
    const withSpec = ScriptPrefillUtil.expand(scriptWith(base), new Map([["words", words]]), {"6": {source: "words", list: "w1"}});
    expect(withSpec.sections[0].groups[0].promptItems[0].recinstructions?.recinstructions).toBe("read the word");
  });

  it('leaves items without a prefill declaration untouched', () => {
    const plain: PromptItem = {itemcode: "5", mediaitems: [{text: "hello"}]};
    const script = scriptWith(item("6", {
      source: "words", select: "random", itemcodeFormat: "6.{n}", mediaitems: [{mimetype: "text/plain", text: "{entry}"}]
    }), [plain]);
    const expanded = ScriptPrefillUtil.expand(script, new Map([["words", words]]), {"6": {source: "words", list: "w1"}});
    const items = expanded.sections[0].groups[0].promptItems;
    expect(items.length).toBe(3);
    expect(items[2]).toBe(plain);
  });

  it('keeps a stored choice only when it names the same source, otherwise draws randomly', () => {
    const script = scriptWith(item("6", {
      source: "words", select: "random", itemcodeFormat: "6.{n}", mediaitems: [{mimetype: "text/plain", text: "{entry}"}]
    }));
    spyOn(Math, 'random').and.returnValue(0.99);   // drawList: floor(0.99 * 2) = 1 -> w2
    const stale: PrefillChoices = {"6": {source: "sentences", list: "w1"}};
    const expanded = ScriptPrefillUtil.expand(script, new Map([["words", words]]), stale);
    // The list id w1 exists in the word source as well — a stale source must not pin it.
    const entries = expanded.sections[0].groups[0].promptItems.map((i) => i.mediaitems[0].text);
    expect(entries).toEqual(["hus", "sol"]);

    const valid: PrefillChoices = {"6": {source: "words", list: "w1"}};
    const pinned = ScriptPrefillUtil.expand(script, new Map([["words", words]]), valid);
    expect(pinned.sections[0].groups[0].promptItems.map((i) => i.mediaitems[0].text)).toEqual(["apa", "bil"]);
  });

  it('throws when the source of a declaration was not fetched', () => {
    const script = scriptWith(item("6", {
      source: "missing", select: "random", itemcodeFormat: "6.{n}", mediaitems: [{mimetype: "text/plain", text: "{entry}"}]
    }));
    expect(() => ScriptPrefillUtil.expand(script, new Map(), {})).toThrowError(/source 'missing'/);
  });

  it('throws when the drawn source holds no lists', () => {
    const script = scriptWith(item("6", {
      source: "empty", select: "random", itemcodeFormat: "6.{n}", mediaitems: [{mimetype: "text/plain", text: "{entry}"}]
    }));
    expect(() => ScriptPrefillUtil.expand(script, new Map([["empty", {lists: []}]]), {})).toThrowError(/holds no lists/);
  });

  it('fills {entry} in text, src and alt of the generated media items', () => {
    const script = scriptWith(item("6", {
      source: "words", select: "random", itemcodeFormat: "6.{n}",
      mediaitems: [{mimetype: "text/plain", text: "{entry}", src: "audio/{entry}.wav", alt: "bild av {entry}"}]
    }));
    const expanded = ScriptPrefillUtil.expand(script, new Map([["words", words]]), {"6": {source: "words", list: "w1"}});
    const mediaitem = expanded.sections[0].groups[0].promptItems[0].mediaitems[0];
    expect(mediaitem.text).toBe("apa");
    expect(mediaitem.src).toBe("audio/apa.wav");
    expect(mediaitem.alt).toBe("bild av apa");
  });

});

describe('ScriptPrefillUtil.drawList', () => {

  it('returns the list of a valid choice', () => {
    const source: PrefillSource = {lists: [wordList("a", ["x"]), wordList("b", ["y"])]};
    expect(ScriptPrefillUtil.drawList(source, {source: "s", list: "b"})?.id).toBe("b");
  });

  it('draws a random list when the choice names no list of the source', () => {
    const source: PrefillSource = {lists: [wordList("a", ["x"]), wordList("b", ["y"])]};
    for (let i = 0; i < 20; i++) {
      const drawn = ScriptPrefillUtil.drawList(source, {source: "s", list: "missing"});
      expect(drawn).not.toBeNull();
      expect(["a", "b"]).toContain(drawn!.id);
    }
  });

  it('returns null for a source without lists', () => {
    expect(ScriptPrefillUtil.drawList({lists: []}, null)).toBeNull();
  });

});
