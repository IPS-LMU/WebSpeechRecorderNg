/**
 * One `describe` per note id (N01–N06), each with the clean case and the triggering case
 * (doc/script-editor/validation.md).
 */
import {checkN01, checkN02, checkN03, checkN04, checkN05, checkN06, runChecks} from './index';
import {context, group, item, paths, script, section} from './test-helpers';

const ITEM0 = 'sections[0].groups[0].promptItems[0]';
const BASE = `${ITEM0}.prefill.bank`;

describe('N01 legacy delay key', () => {
  it('is clean when the modern key is set', () => {
    expect(checkN01(script({sections: [section({groups: [group({promptItems: [item({prerecording: 500, prerecdelay: 500})]})]})]}))).toEqual([]);
  });
  it('notes a legacy prerecording that is read as prerecdelay', () => {
    const findings = checkN01(script({sections: [section({groups: [group({promptItems: [item({prerecording: 500})]})]})]}));
    expect(paths(findings)).toEqual([`${ITEM0}.prerecording`]);
    expect(findings[0].fix).toBe('rename-modern');
  });
  it('notes the postrecording legacy key too', () => {
    const findings = checkN01(script({sections: [section({groups: [group({promptItems: [item({postrecording: 250})]})]})]}));
    expect(paths(findings)).toEqual([`${ITEM0}.postrecording`]);
  });
});

describe('N02 RANDOMIZED', () => {
  it('is clean for RANDOM and SEQUENTIAL', () => {
    expect(checkN02(script({sections: [section({order: 'RANDOM', groups: [group({order: 'SEQUENTIAL'})]})]}))).toEqual([]);
  });
  it('notes a RANDOMIZED order', () => {
    const findings = checkN02(script({sections: [section({order: 'RANDOMIZED', groups: [group()]})]}));
    expect(paths(findings)).toEqual(['sections[0].order']);
    expect(findings[0].fix).toBe('replace-order');
  });
});

describe('N03 draw totals', () => {
  it('is silent when the script has no draw rule', () => {
    expect(checkN03(script())).toEqual([]);
  });
  it('reports drawn and fixed totals', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [
      item({itemcode: 'RB', prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 5, itemcodePrefix: 'RB'}}}),
      item({itemcode: '2'}),
    ]})]})]});
    const findings = checkN03(draft);
    expect(paths(findings)).toEqual([BASE]);
    expect(findings[0].message).toContain('5 items are drawn per session, on top of 1 fixed items');
    expect(findings[0].message).toContain('6 items');
  });
});

describe('N04 lifted recorder floor', () => {
  it('is silent when the floor was already as high', () => {
    const playbackScript = script({sections: [section({groups: [group({promptItems: [item({playback: {when: 'BEFORE'}, mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]})]})]})]});
    expect(checkN04(playbackScript, context({previousDraft: playbackScript}))).toEqual([]);
  });
  it('notes when an edit lifts the floor', () => {
    const before = script();
    const after = script({sections: [section({groups: [group({promptItems: [item({playback: {when: 'BEFORE'}, mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]})]})]})]});
    const findings = checkN04(after, context({previousDraft: before}));
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain('playback');
  });
});

describe('N05 speaker-stable skip', () => {
  it('is silent when the draw is not speaker-stable', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB', fixedBy: 'SESSION', skipRecordedBySpeaker: true}}})]})]})]});
    expect(checkN05(draft)).toEqual([]);
  });
  it('notes the combination', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB', fixedBy: 'SPEAKER', skipRecordedBySpeaker: true}}})]})]})]});
    expect(paths(checkN05(draft))).toEqual([BASE]);
  });
});

describe('N06 legacy promptUnits', () => {
  it('is silent for a section that already has groups', () => {
    expect(checkN06(script())).toEqual([]);
  });
  it('notes a legacy section', () => {
    const draft = {name: 'Legacy', sections: [{mode: 'MANUAL', promptphase: 'IDLE', order: 'SEQUENTIAL', training: false, promptUnits: [{itemcode: 'I0', mediaitems: [{text: 'hi'}]}]}]};
    const findings = checkN06(draft);
    expect(paths(findings)).toEqual(['sections[0]']);
    expect(findings[0].fix).toBe('convert-groups');
  });
});

describe('the clean script', () => {
  it('has no notes', () => {
    expect(runChecks(script()).filter((finding) => finding.severity === 'note')).toEqual([]);
  });
});
