import {Mediaitem, MediaitemUtil, PromptitemUtil} from "./script";

function mediaitem(mediaitem: Partial<Mediaitem>): Mediaitem {
  return mediaitem;
}

describe('MediaitemUtil', () => {

  it('reads a missing mimetype as plain text', () => {
    expect(MediaitemUtil.mimeType(mediaitem({text: 'hello'}))).toBe('text/plain');
    expect(MediaitemUtil.mimeType(mediaitem({mimetype: '  '}))).toBe('text/plain');
    expect(MediaitemUtil.kind(mediaitem({text: 'hello'}))).toBe('text');
  });

  it('classifies the kinds the stage renders', () => {
    expect(MediaitemUtil.kind(mediaitem({mimetype: 'text/plain'}))).toBe('text');
    expect(MediaitemUtil.kind(mediaitem({mimetype: 'text/x-prompt'}))).toBe('prompt');
    expect(MediaitemUtil.kind(mediaitem({mimetype: 'image/jpg'}))).toBe('image');
    expect(MediaitemUtil.kind(mediaitem({mimetype: 'audio/wav'}))).toBe('audio');
    expect(MediaitemUtil.kind(mediaitem({mimetype: 'audio/mpeg'}))).toBe('audio');
  });

  it('treats anything else as unsupported, and null as unsupported', () => {
    expect(MediaitemUtil.kind(mediaitem({mimetype: 'video/mp4'}))).toBe('unsupported');
    expect(MediaitemUtil.kind(mediaitem({mimetype: 'application/pdf'}))).toBe('unsupported');
    expect(MediaitemUtil.kind(null)).toBe('unsupported');
    expect(MediaitemUtil.kind(undefined)).toBe('unsupported');
  });

  it('plays a sound prompt unless the script turns autoplay off', () => {
    expect(MediaitemUtil.isAutoplayedAudio(mediaitem({mimetype: 'audio/wav'}))).toBe(true);
    expect(MediaitemUtil.isAutoplayedAudio(mediaitem({mimetype: 'audio/wav', autoplay: true}))).toBe(true);
    expect(MediaitemUtil.isAutoplayedAudio(mediaitem({mimetype: 'audio/wav', autoplay: false}))).toBe(false);
    expect(MediaitemUtil.isAutoplayedAudio(mediaitem({mimetype: 'text/plain'}))).toBe(false);
    expect(MediaitemUtil.isAutoplayedAudio(mediaitem({mimetype: 'image/jpg'}))).toBe(false);
  });

  it('offers a sound for a replay unless the script forbids it', () => {
    expect(MediaitemUtil.isReplayableAudio(mediaitem({mimetype: 'audio/wav'}))).toBe(true);
    expect(MediaitemUtil.isReplayableAudio(mediaitem({mimetype: 'audio/wav', replay: true}))).toBe(true);
    expect(MediaitemUtil.isReplayableAudio(mediaitem({mimetype: 'audio/wav', replay: false}))).toBe(false);
    expect(MediaitemUtil.isReplayableAudio(mediaitem({mimetype: 'text/plain'}))).toBe(false);
    expect(MediaitemUtil.isReplayableAudio(mediaitem({mimetype: 'image/jpg'}))).toBe(false);
    expect(MediaitemUtil.isReplayableAudio(null)).toBe(false);
  });

});

describe('PromptitemUtil.autoplayAudioitem', () => {

  it('finds the sound of a prompt', () => {
    const sound = mediaitem({mimetype: 'audio/wav', src: 'resources/audio/cue.wav'});
    expect(PromptitemUtil.autoplayAudioitem({itemcode: 'A0', mediaitems: [sound]})).toBe(sound);
  });

  it('returns null for prompts without a sound, and skips one that is not autoplayed', () => {
    expect(PromptitemUtil.autoplayAudioitem({itemcode: 'T0', mediaitems: [mediaitem({text: 'read'})]})).toBeNull();
    expect(PromptitemUtil.autoplayAudioitem({itemcode: 'T0', mediaitems: []})).toBeNull();
    expect(PromptitemUtil.autoplayAudioitem(null)).toBeNull();
    expect(PromptitemUtil.autoplayAudioitem({
      itemcode: 'A0',
      mediaitems: [mediaitem({mimetype: 'audio/wav', autoplay: false})]
    })).toBeNull();
  });

  it('picks the sound when a prompt carries a text and a sound item', () => {
    const text = mediaitem({mimetype: 'text/plain', text: 'repeat it'});
    const sound = mediaitem({mimetype: 'audio/wav', src: 'resources/audio/cue.wav'});
    expect(PromptitemUtil.autoplayAudioitem({itemcode: 'A0', mediaitems: [text, sound]})).toBe(sound);
  });

  it('finds a sound that is left to the play control, which the autoplay lookup skips', () => {
    const onDemand = mediaitem({mimetype: 'audio/wav', src: 'resources/audio/cue.wav', autoplay: false});
    const promptItem = {itemcode: 'A1', mediaitems: [onDemand]};
    expect(PromptitemUtil.autoplayAudioitem(promptItem)).toBeNull();
    expect(PromptitemUtil.replayAudioitem(promptItem)).toBe(onDemand);
  });

  it('offers no replay for a sound the script plays exactly once', () => {
    const once = mediaitem({mimetype: 'audio/wav', src: 'resources/audio/cue.wav', replay: false});
    const promptItem = {itemcode: 'A2', mediaitems: [once]};
    expect(PromptitemUtil.autoplayAudioitem(promptItem)).toBe(once);
    expect(PromptitemUtil.replayAudioitem(promptItem)).toBeNull();
  });

  it('has no lookup for a sound that is neither played nor replayable', () => {
    const silent = mediaitem({mimetype: 'audio/wav', src: 'resources/audio/cue.wav', autoplay: false, replay: false});
    const promptItem = {itemcode: 'A3', mediaitems: [silent]};
    expect(PromptitemUtil.autoplayAudioitem(promptItem)).toBeNull();
    expect(PromptitemUtil.replayAudioitem(promptItem)).toBeNull();
  });

});
