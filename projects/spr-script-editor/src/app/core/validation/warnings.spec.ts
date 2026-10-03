/**
 * One `describe` per warning id (W01–W13), each with the clean case and the triggering case
 * (doc/script-editor/validation.md).
 */
import {
  checkW01, checkW02, checkW03, checkW04, checkW05, checkW06, checkW07,
  checkW08, checkW09, checkW10, checkW11, checkW12, checkW13,
} from './index';
import {bankView, context, group, ids, item, lookupOf, paths, script, section} from './test-helpers';

const ITEM0 = 'sections[0].groups[0].promptItems[0]';
const BASE = `${ITEM0}.prefill.bank`;

describe('W01 AUTORECORDING without a duration', () => {
  it('is clean when the recording item has a recduration', () => {
    const draft = script({sections: [section({mode: 'AUTORECORDING', groups: [group({promptItems: [item({recduration: 4000})]})]})]});
    expect(checkW01(draft)).toEqual([]);
  });
  it('flags a recording item with no recduration', () => {
    const draft = script({sections: [section({mode: 'AUTORECORDING', groups: [group({promptItems: [item()]})]})]});
    expect(ids(checkW01(draft))).toEqual(['W01']);
  });
});

describe('W02 image without alt', () => {
  it('is clean when the image has alt text', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({mediaitems: [{mimetype: 'image/png', src: 'a.png', alt: 'a cat'}]})]})]})]});
    expect(checkW02(draft)).toEqual([]);
  });
  it('flags an image prompt with no alt', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({mediaitems: [{mimetype: 'image/png', src: 'a.png'}]})]})]})]});
    expect(paths(checkW02(draft))).toEqual([`${ITEM0}.mediaitems[0].alt`]);
  });
});

describe('W03 DURING without headphones', () => {
  it('is clean when headphones are required', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({playback: {when: 'DURING', headphones: true}, mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]})]})]})]});
    expect(checkW03(draft)).toEqual([]);
  });
  it('flags DURING playback on an item without headphones', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({playback: {when: 'DURING'}, mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]})]})]})]});
    expect(paths(checkW03(draft))).toEqual([`${ITEM0}.playback.headphones`]);
  });
  it('also scans a draw playback', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB', playback: {when: 'DURING'}}}}) ]})]})]});
    expect(paths(checkW03(draft))).toEqual([`${BASE}.playback.headphones`]);
  });
});

describe('W04 draw plays audio that some items lack', () => {
  const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 2, itemcodePrefix: 'RB', playBankAudio: true}}})]})]})]});
  it('is clean when every matching item has audio', () => {
    const banks = {small: bankView('small', [{bankItemId: 's1', text: 'a', audioSrc: 'a.wav'}, {bankItemId: 's2', text: 'b', audioSrc: 'b.wav'}])};
    expect(checkW04(draft, context({bankLookup: lookupOf(banks)}))).toEqual([]);
  });
  it('flags the items without a model recording', () => {
    const banks = {small: bankView('small', [{bankItemId: 's1', text: 'a', audioSrc: 'a.wav'}, {bankItemId: 's2', text: 'b'}])};
    expect(ids(checkW04(draft, context({bankLookup: lookupOf(banks)})))).toEqual(['W04']);
  });
});

describe('W05 clip longer than the pre-recording delay', () => {
  it('is clean when the delay covers the clip', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prerecdelay: 3000, playback: {when: 'PRERECORDING', repeats: 2, gap: 500, durationMs: 1000}, mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]})]})]})]});
    expect(checkW05(draft)).toEqual([]);
  });
  it('flags a clip that outlasts the delay', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({playback: {when: 'PRERECORDING', repeats: 2, gap: 500, durationMs: 1000}, mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]})]})]})]});
    expect(ids(checkW05(draft))).toEqual(['W05']);
  });
  it('suspends on a drawn group when clip durations are unknown', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB', playback: {when: 'PRERECORDING'}}}}) ]})]})]});
    const findings = checkW05(draft, context({bankLookup: lookupOf({small: bankView('small', [])})}));
    expect(findings.length).toBe(1);
    expect(findings[0].suspended).toBe(true);
  });
});

describe('W06 timing on the wrong item kind', () => {
  it('is clean when each field matches its kind', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({type: 'nonrecording', duration: 1000}), item({itemcode: '2', recduration: 1000})]})]})]});
    expect(checkW06(draft)).toEqual([]);
  });
  it('flags recduration on a non-recording item and duration on a recording item', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({type: 'nonrecording', recduration: 1000}), item({itemcode: '2', duration: 1000})]})]})]});
    expect(paths(checkW06(draft))).toEqual([`${ITEM0}.recduration`, 'sections[0].groups[0].promptItems[1].duration']);
  });
});

describe('W07 training section with a draw', () => {
  it('is clean when a training section only has fixed items', () => {
    expect(checkW07(script({sections: [section({training: true})]}))).toEqual([]);
  });
  it('flags a drawn group inside a training section', () => {
    const draft = script({sections: [section({training: true, groups: [group({promptItems: [item({prefill: {bank: {bank: 'small', bankSource: 'PROJECT', count: 1, itemcodePrefix: 'RB'}}})]})]})]});
    expect(ids(checkW07(draft))).toEqual(['W07']);
  });
});

describe('W08 more than one mediaitem', () => {
  it('is clean with a single mediaitem', () => {
    expect(checkW08(script())).toEqual([]);
  });
  it('flags extra mediaitems', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({mediaitems: [{text: 'a'}, {text: 'b'}]})]})]})]});
    const findings = checkW08(draft);
    expect(paths(findings)).toEqual([`${ITEM0}.mediaitems`]);
    expect(findings[0].fix).toBe('keep-first-mediaitem');
  });
});

describe('W09 unlimited replay in AUTORECORDING', () => {
  it('is clean when maxReplays caps the replay', () => {
    const draft = script({sections: [section({mode: 'AUTORECORDING', groups: [group({promptItems: [item({playback: {replayable: true, maxReplays: 2}, mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]})]})]})]});
    expect(checkW09(draft)).toEqual([]);
  });
  it('flags replayable without a cap', () => {
    const draft = script({sections: [section({mode: 'AUTORECORDING', groups: [group({promptItems: [item({playback: {replayable: true}, mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]})]})]})]});
    expect(paths(checkW09(draft))).toEqual([`${ITEM0}.playback.maxReplays`]);
  });
});

describe('W10 recorder version', () => {
  it('is clean when the deployment is new enough', () => {
    expect(checkW10(script({minRecorderVersion: '3.11'}), context({recorderVersion: '3.12'}))).toEqual([]);
  });
  it('flags a floor above the deployment version', () => {
    expect(ids(checkW10(script({minRecorderVersion: '3.12'}), context({recorderVersion: '3.11'})))).toEqual(['W10']);
  });
});

describe('W11 missing media', () => {
  const draft = script({sections: [section({groups: [group({promptItems: [item({mediaitems: [{mimetype: 'image/png', src: 'media/a.png', alt: 'x'}]})]})]})]});
  it('is clean when the file is in the media index', () => {
    expect(checkW11(draft, context({mediaIndex: ['media/a.png']}))).toEqual([]);
  });
  it('flags a reference missing from the media index', () => {
    expect(ids(checkW11(draft, context({mediaIndex: ['media/b.png']})))).toEqual(['W11']);
  });
  it('suspends when the media index cannot be fetched', () => {
    const findings = checkW11(draft, context({mediaIndex: null}));
    expect(findings[0].suspended).toBe(true);
  });
});

describe('W12 non-recording placement', () => {
  it('is clean for WITH_PROMPT on a non-recording item', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({type: 'nonrecording', playback: {when: 'WITH_PROMPT'}})]})]})]});
    expect(checkW12(draft)).toEqual([]);
  });
  it('flags PRERECORDING on a non-recording item', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({type: 'nonrecording', playback: {when: 'PRERECORDING'}})]})]})]});
    expect(paths(checkW12(draft))).toEqual([`${ITEM0}.playback.when`]);
  });
});

describe('W13 placement declared twice', () => {
  it('is clean when only playback is set', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({playback: {when: 'BEFORE'}, mediaitems: [{mimetype: 'audio/wav', src: 'a.wav'}]})]})]})]});
    expect(checkW13(draft)).toEqual([]);
  });
  it('flags playback together with a mediaitem flag', () => {
    const draft = script({sections: [section({groups: [group({promptItems: [item({playback: {when: 'BEFORE'}, mediaitems: [{mimetype: 'audio/wav', src: 'a.wav', autoplay: true}]})]})]})]});
    expect(paths(checkW13(draft))).toEqual([`${ITEM0}.playback`]);
  });
});
